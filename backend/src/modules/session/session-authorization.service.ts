import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AppRole } from '../../common/decorators/auth.decorator';

@Injectable()
export class SessionAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  private async findSession(tenantId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, tenantId },
      select: {
        id: true,
        userId: true,
        agentId: true,
        preferredAgentId: true,
        status: true,
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async assertUserAccess(
    tenantId: string,
    sessionId: string,
    userId: string,
  ) {
    const session = await this.findSession(tenantId, sessionId);
    if (session.userId !== userId) {
      throw new ForbiddenException('无权访问此会话');
    }
    return session;
  }

  async assertAgentAccess(
    tenantId: string,
    sessionId: string,
    agentId: string,
  ) {
    const session = await this.findSession(tenantId, sessionId);
    const canClaimWaitingSession =
      session.status === 'WAITING' &&
      !session.agentId &&
      (!session.preferredAgentId || session.preferredAgentId === agentId);
    if (session.agentId !== agentId && !canClaimWaitingSession) {
      throw new ForbiddenException('无权访问此会话');
    }
    return session;
  }

  async assertAssignedAgent(
    tenantId: string,
    sessionId: string,
    agentId: string,
  ) {
    const session = await this.findSession(tenantId, sessionId);
    if (session.agentId !== agentId) {
      throw new ForbiddenException('只有当前接待客服可以执行此操作');
    }
    return session;
  }

  async assertActorAccess(
    tenantId: string,
    sessionId: string,
    role: AppRole,
    actorId: string,
  ) {
    if (role === 'user') {
      return this.assertUserAccess(tenantId, sessionId, actorId);
    }
    if (role === 'agent') {
      return this.assertAgentAccess(tenantId, sessionId, actorId);
    }
    throw new ForbiddenException('无权访问此会话');
  }

  async assertCanSend(
    tenantId: string,
    sessionId: string,
    role: AppRole,
    actorId: string,
  ) {
    if (role === 'user') {
      return this.assertUserAccess(tenantId, sessionId, actorId);
    }
    if (role === 'agent') {
      return this.assertAssignedAgent(tenantId, sessionId, actorId);
    }
    throw new ForbiddenException('无权发送消息');
  }

  async assertMessageAccess(
    tenantId: string,
    messageId: string,
    role: AppRole,
    actorId: string,
  ) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, tenantId },
      select: { sessionId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    await this.assertActorAccess(tenantId, message.sessionId, role, actorId);
    return message;
  }
}
