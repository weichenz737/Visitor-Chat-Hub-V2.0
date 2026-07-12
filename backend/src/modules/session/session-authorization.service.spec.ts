import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionAuthorizationService } from './session-authorization.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('SessionAuthorizationService', () => {
  const findSession = jest.fn();
  const findMessage = jest.fn();
  const prisma = {
    session: { findFirst: findSession },
    message: { findFirst: findMessage },
  } as unknown as PrismaService;
  const service = new SessionAuthorizationService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a visitor accessing another visitor session', async () => {
    findSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-2',
      agentId: null,
      preferredAgentId: null,
      status: 'WAITING',
    });

    await expect(
      service.assertUserAccess('tenant-1', 'session-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an agent accessing a session assigned to another agent', async () => {
    findSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      agentId: 'agent-2',
      preferredAgentId: null,
      status: 'ACTIVE',
    });

    await expect(
      service.assertAgentAccess('tenant-1', 'session-1', 'agent-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the preferred agent to access an unassigned waiting session', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      agentId: null,
      preferredAgentId: 'agent-1',
      status: 'WAITING',
    };
    findSession.mockResolvedValue(session);

    await expect(
      service.assertAgentAccess('tenant-1', 'session-1', 'agent-1'),
    ).resolves.toEqual(session);
  });

  it('requires the current assigned agent for send and transfer operations', async () => {
    findSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      agentId: 'agent-2',
      preferredAgentId: null,
      status: 'ACTIVE',
    });

    await expect(
      service.assertAssignedAgent('tenant-1', 'session-1', 'agent-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal access for a missing session', async () => {
    findSession.mockResolvedValue(null);

    await expect(
      service.assertUserAccess('tenant-1', 'missing', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
