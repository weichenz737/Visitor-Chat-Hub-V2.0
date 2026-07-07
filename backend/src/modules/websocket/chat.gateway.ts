import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessageService } from '../message/message.service';
import { SessionService } from '../session/session.service';
import { ConversationService } from '../conversation/conversation.service';
import { TransferService } from '../transfer/transfer.service';
import { AgentService } from '../agent/agent.service';
import { RedisService } from '../../redis/redis.service';
import { AuthPayload } from '../../common/decorators/auth.decorator';
import { MessageType } from '@prisma/client';

interface WsAuthPayload extends AuthPayload {
  sessionId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly messageService: MessageService,
    private readonly sessionService: SessionService,
    private readonly conversationService: ConversationService,
    private readonly transferService: TransferService,
    private readonly agentService: AgentService,
    private readonly redis: RedisService,
  ) {}

  private roomName(tenantId: string, sessionId: string) {
    return `tenant:${tenantId}:session:${sessionId}`;
  }

  private tenantRoom(tenantId: string) {
    return `tenant:${tenantId}:agents`;
  }

  private authenticate(socket: Socket): WsAuthPayload | null {
    const token =
      (socket.handshake.auth?.token as string) ||
      (socket.handshake.query?.token as string);
    if (!token) return null;
    try {
      return this.jwtService.verify<WsAuthPayload>(token);
    } catch {
      return null;
    }
  }

  async handleConnection(socket: Socket) {
    const user = this.authenticate(socket);
    if (!user?.tenantId) {
      socket.disconnect();
      return;
    }
    socket.data.user = user;
  }

  async handleDisconnect(socket: Socket) {
    const user = socket.data.user as WsAuthPayload | undefined;
    if (!user?.tenantId) return;

    if (user.role === 'user') {
      await this.redis
        .getClient()
        .srem(this.redis.tenantOnlineUsersKey(user.tenantId), user.sub);
    }
    if (user.role === 'agent') {
      await this.unregisterAgentConnection(user.tenantId, user.sub, socket.id);
      socket.leave(this.tenantRoom(user.tenantId));
    }
  }

  private async registerAgentConnection(
    tenantId: string,
    agentId: string,
    socketId: string,
  ) {
    const key = this.redis.agentConnectionsKey(agentId);
    const added = await this.redis.getClient().sadd(key, socketId);
    await this.agentService.updateStatus(tenantId, agentId, 'ONLINE');
    if (added === 1) {
      const agent = await this.agentService.findById(tenantId, agentId);
      this.server.to(this.tenantRoom(tenantId)).emit('agent_presence', {
        agentId,
        status: 'ONLINE',
        name: agent.name,
      });
    }
  }

  private async unregisterAgentConnection(
    tenantId: string,
    agentId: string,
    socketId: string,
  ) {
    const key = this.redis.agentConnectionsKey(agentId);
    await this.redis.getClient().srem(key, socketId);
    const remaining = await this.redis.getClient().scard(key);
    if (remaining === 0) {
      await this.agentService.updateStatus(tenantId, agentId, 'OFFLINE');
      this.server.to(this.tenantRoom(tenantId)).emit('agent_presence', {
        agentId,
        status: 'OFFLINE',
      });
    }
  }

  @SubscribeMessage('user_connect')
  async handleUserConnect(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { sessionId: string },
  ) {
    const user = socket.data.user as WsAuthPayload;
    if (user.role !== 'user') return { error: 'Unauthorized' };

    const session = await this.sessionService.findById(
      user.tenantId!,
      body.sessionId,
    );
    socket.join(this.roomName(user.tenantId!, body.sessionId));
    user.sessionId = body.sessionId;
    socket.data.user = user;

    await this.redis
      .getClient()
      .sadd(this.redis.tenantOnlineUsersKey(user.tenantId!), user.sub);

    if (session.status === 'WAITING') {
      const assigned = await this.sessionService.autoAssign(
        user.tenantId!,
        body.sessionId,
      );
      if (assigned.agentId) {
        const payload = {
          sessionId: body.sessionId,
          agent: assigned.agent,
          status: 'ACTIVE' as const,
        };
        this.server
          .to(this.tenantRoom(user.tenantId!))
          .emit('session_assigned', payload);
        this.server
          .to(this.roomName(user.tenantId!, body.sessionId))
          .emit('session_assigned', payload);
        this.server.to(this.roomName(user.tenantId!, body.sessionId)).emit(
          'session_status',
          { sessionId: body.sessionId, status: 'ACTIVE' },
        );
      }
    }

    return { ok: true, session };
  }

  @SubscribeMessage('agent_connect')
  async handleAgentConnect(@ConnectedSocket() socket: Socket) {
    const user = socket.data.user as WsAuthPayload;
    if (user.role !== 'agent') return { error: 'Unauthorized' };

    await this.registerAgentConnection(user.tenantId!, user.sub, socket.id);
    socket.join(this.tenantRoom(user.tenantId!));

    const conversations = await this.conversationService.listForAgent(
      user.tenantId!,
      user.sub,
      { page: 1, limit: 50 },
    );

    return { ok: true, conversations: conversations.items };
  }

  @SubscribeMessage('join_session')
  async handleJoinSession(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { sessionId: string },
  ) {
    const user = socket.data.user as WsAuthPayload;
    if (!user?.tenantId) return { error: 'Unauthorized' };

    await this.sessionService.findById(user.tenantId, body.sessionId);
    socket.join(this.roomName(user.tenantId, body.sessionId));
    return { ok: true };
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: {
      sessionId: string;
      type?: MessageType;
      content: string;
      file_name?: string;
      file_size?: number;
      metadata?: Record<string, unknown>;
    },
  ) {
    const user = socket.data.user as WsAuthPayload;
    if (!user?.tenantId) return { error: 'Unauthorized' };

    const result = await this.messageService.create(user.tenantId, {
      sessionId: body.sessionId,
      senderType: user.role === 'agent' ? 'AGENT' : 'USER',
      senderId: user.sub,
      type: body.type ?? 'TEXT',
      content: body.content,
      fileName: body.file_name,
      fileSize: body.file_size,
      metadata: body.metadata,
    });

    const { message, session } = result;
    const payload = { event: 'message', data: message };
    const sessionRoom = this.roomName(user.tenantId, session.id);
    const agentsRoom = this.tenantRoom(user.tenantId);
    this.server.to(sessionRoom).emit('message', message);
    this.server.to(agentsRoom).emit('message', message);

    if (session.id !== body.sessionId) {
      socket.join(this.roomName(user.tenantId, session.id));
      this.server
        .to(this.roomName(user.tenantId, session.id))
        .emit('session_resume', {
          conversationId: session.conversationId,
          session,
        });
      if (session.status === 'WAITING') {
        const assigned = await this.sessionService.autoAssign(
          user.tenantId,
          session.id,
        );
        if (assigned.agentId) {
          const assignPayload = {
            sessionId: session.id,
            agent: assigned.agent,
            status: 'ACTIVE' as const,
          };
          this.server
            .to(this.tenantRoom(user.tenantId))
            .emit('session_assigned', assignPayload);
          this.server
            .to(this.roomName(user.tenantId, session.id))
            .emit('session_assigned', assignPayload);
        }
      }
    }

    await this.redis.getClient().publish(
      this.redis.wsChannel(user.tenantId, session.id),
      JSON.stringify(payload),
    );

    return { ok: true, message, session };
  }

  @SubscribeMessage('transfer_session')
  async handleTransfer(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { sessionId: string; toAgentId: string; reason?: string },
  ) {
    const user = socket.data.user as WsAuthPayload;
    if (user.role !== 'agent') return { error: 'Unauthorized' };

    const result = await this.transferService.transfer(
      user.tenantId!,
      body.sessionId,
      user.sub,
      body.toAgentId,
      body.reason,
    );

    this.server
      .to(this.roomName(user.tenantId!, body.sessionId))
      .emit('transfer_session', { session: result.session });

    return { ok: true, ...result };
  }

  @SubscribeMessage('read_receipt')
  async handleReadReceipt(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { messageId: string; sessionId: string },
  ) {
    const user = socket.data.user as WsAuthPayload;
    const message = await this.messageService.markRead(
      user.tenantId!,
      body.messageId,
    );

    this.server
      .to(this.roomName(user.tenantId!, body.sessionId))
      .emit('read_receipt', { messageId: body.messageId, readAt: message.readAt });

    return { ok: true };
  }

  @SubscribeMessage('session_status')
  async handleSessionStatus(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: { sessionId: string; status: 'WAITING' | 'ACTIVE' | 'CLOSED' },
  ) {
    const user = socket.data.user as WsAuthPayload;
    if (body.status === 'CLOSED') {
      return { error: '请使用结束会话接口' };
    }
    const session = await this.sessionService.updateStatus(
      user.tenantId!,
      body.sessionId,
      body.status,
    );

    this.server
      .to(this.roomName(user.tenantId!, body.sessionId))
      .emit('session_status', { sessionId: body.sessionId, status: body.status });

    if (body.status === 'ACTIVE' && session.agent) {
      this.server
        .to(this.roomName(user.tenantId!, body.sessionId))
        .emit('session_assigned', {
          sessionId: body.sessionId,
          agent: session.agent,
          status: 'ACTIVE',
        });
    }

    return { ok: true, session };
  }

  notifySessionClose(
    tenantId: string,
    session: {
      id: string;
      conversationId?: string;
      status: string;
      closedBy?: string | null;
      closedReason?: string | null;
      closedAt?: Date | null;
      user?: { id: string; nickname: string | null } | null;
      agent?: { id: string; name: string } | null;
    },
    closedBy: 'USER' | 'AGENT' | 'SYSTEM',
  ) {
    const payload = {
      type: 'session_close' as const,
      sessionId: session.id,
      conversationId: session.conversationId,
      closedBy,
      session,
    };
    this.server
      .to(this.roomName(tenantId, session.id))
      .emit('session_close', payload);
    this.server.to(this.tenantRoom(tenantId)).emit('session_close', payload);
    this.server
      .to(this.roomName(tenantId, session.id))
      .emit('session_status', { sessionId: session.id, status: session.status });
  }

  notifySessionAssigned(
    tenantId: string,
    session: { id: string; status: string; agent?: { id: string; name: string } | null },
  ) {
    const payload = {
      sessionId: session.id,
      agent: session.agent,
      status: session.status,
    };
    this.server
      .to(this.roomName(tenantId, session.id))
      .emit('session_assigned', payload);
    this.server.to(this.tenantRoom(tenantId)).emit('session_assigned', payload);
  }

  notifyTransferSession(
    tenantId: string,
    session: { id: string; agent?: { id: string; name: string } | null; user?: { id: string; nickname: string | null } | null; status: string },
  ) {
    this.server
      .to(this.roomName(tenantId, session.id))
      .emit('transfer_session', { session });
    this.server.to(this.tenantRoom(tenantId)).emit('transfer_session', { session });
    if (session.agent) {
      this.notifySessionAssigned(tenantId, session);
    }
  }

  async notifyUserProfileUpdated(
    tenantId: string,
    userId: string,
    data: { nickname: string; originalName?: string | null },
  ) {
    const payload = {
      userId,
      nickname: data.nickname,
      originalName: data.originalName,
    };
    this.server.to(this.tenantRoom(tenantId)).emit('user_profile_updated', payload);

    const sessions = await this.sessionService.listForUser(tenantId, userId);
    for (const session of sessions) {
      if (session.status !== 'CLOSED') {
        this.server
          .to(this.roomName(tenantId, session.id))
          .emit('user_profile_updated', payload);
      }
    }
  }
}
