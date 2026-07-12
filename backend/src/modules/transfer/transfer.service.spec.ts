import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TransferService } from './transfer.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionService } from '../session/session.service';
import type { AgentService } from '../agent/agent.service';
import type { SessionAuthorizationService } from '../session/session-authorization.service';

describe('TransferService', () => {
  const assertAssignedAgent = jest.fn();
  const findSession = jest.fn();
  const findAgent = jest.fn();
  const createTransfer = jest.fn();
  const updateSession = jest.fn();
  const transaction = jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));

  const prisma = {
    $transaction: transaction,
    transfer: { create: createTransfer },
    session: { update: updateSession },
  } as unknown as PrismaService;

  const sessionService = {
    findById: findSession,
  } as unknown as SessionService;

  const agentService = {
    findById: findAgent,
  } as unknown as AgentService;

  const sessionAuthorization = {
    assertAssignedAgent,
  } as unknown as SessionAuthorizationService;

  const service = new TransferService(
    prisma,
    sessionService,
    sessionAuthorization,
    agentService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    assertAssignedAgent.mockResolvedValue({
      id: 'session-1',
      agentId: 'agent-1',
    });
    findSession.mockResolvedValue({
      id: 'session-1',
      status: 'ACTIVE',
      agentId: 'agent-1',
    });
  });

  it('rejects transfer when caller is not the assigned agent', async () => {
    assertAssignedAgent.mockRejectedValue(new ForbiddenException());

    await expect(
      service.transfer('tenant-1', 'session-1', 'agent-x', 'agent-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(findAgent).not.toHaveBeenCalled();
  });

  it('rejects transferring to a non-AGENT role', async () => {
    findAgent.mockResolvedValue({
      id: 'admin-1',
      role: 'TENANT_ADMIN',
    });

    await expect(
      service.transfer('tenant-1', 'session-1', 'agent-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('transfers when target role is AGENT', async () => {
    findAgent.mockResolvedValue({ id: 'agent-2', role: 'AGENT' });
    createTransfer.mockResolvedValue({ id: 'transfer-1' });
    updateSession.mockResolvedValue({ id: 'session-1', agentId: 'agent-2' });

    await expect(
      service.transfer('tenant-1', 'session-1', 'agent-1', 'agent-2'),
    ).resolves.toMatchObject({
      transfer: { id: 'transfer-1' },
      session: { agentId: 'agent-2' },
    });

    expect(createTransfer).toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalled();
  });
});
