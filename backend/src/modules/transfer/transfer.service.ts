import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { AgentService } from '../agent/agent.service';

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly agentService: AgentService,
  ) {}

  async transfer(
    tenantId: string,
    sessionId: string,
    fromAgentId: string,
    toAgentId: string,
    reason?: string,
  ) {
    if (fromAgentId === toAgentId) {
      throw new BadRequestException('Cannot transfer to the same agent');
    }

    const session = await this.sessionService.findById(tenantId, sessionId);
    if (session.status === 'CLOSED') {
      throw new BadRequestException('Session is closed');
    }
    if (session.status === 'REMOVED') {
      throw new BadRequestException('Session is removed');
    }

    await this.agentService.findById(tenantId, toAgentId);

    const [transfer, updatedSession] = await this.prisma.$transaction([
      this.prisma.transfer.create({
        data: {
          tenantId,
          sessionId,
          fromAgentId,
          toAgentId,
          reason,
        },
      }),
      this.prisma.session.update({
        where: { id: sessionId },
        data: { agentId: toAgentId, status: 'ACTIVE' },
        include: {
          user: { select: { id: true, nickname: true } },
          agent: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { transfer, session: updatedSession };
  }

  /** Tenant admin: assign or transfer session to another agent */
  async adminTransfer(
    tenantId: string,
    sessionId: string,
    toAgentId: string,
    reason?: string,
  ) {
    const session = await this.sessionService.findById(tenantId, sessionId);
    if (session.status === 'CLOSED') {
      throw new BadRequestException('Session is closed');
    }
    if (session.status === 'REMOVED') {
      throw new BadRequestException('Session is removed');
    }

    const fromAgentId = session.agentId;
    if (fromAgentId === toAgentId) {
      throw new BadRequestException('Cannot transfer to the same agent');
    }

    const toAgent = await this.agentService.findById(tenantId, toAgentId);
    if (toAgent.role !== 'AGENT') {
      throw new BadRequestException('只能转接给客服角色的用户');
    }

    return this.prisma.$transaction(async (tx) => {
      let transfer = null;
      if (fromAgentId) {
        transfer = await tx.transfer.create({
          data: {
            tenantId,
            sessionId,
            fromAgentId,
            toAgentId,
            reason,
          },
        });
      }
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: { agentId: toAgentId, status: 'ACTIVE' },
        include: {
          user: { select: { id: true, nickname: true } },
          agent: { select: { id: true, name: true } },
        },
      });
      return { transfer, session: updatedSession };
    });
  }

  async listBySession(tenantId: string, sessionId: string) {
    await this.sessionService.findById(tenantId, sessionId);
    return this.prisma.transfer.findMany({
      where: { tenantId, sessionId },
      include: {
        fromAgent: { select: { id: true, name: true } },
        toAgent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
