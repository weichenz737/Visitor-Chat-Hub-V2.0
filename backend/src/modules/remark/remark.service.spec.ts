import { ForbiddenException } from '@nestjs/common';
import { RemarkService } from './remark.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UserService } from '../user/user.service';

describe('RemarkService authorization', () => {
  const findUser = jest.fn();
  const findSession = jest.fn();
  const upsert = jest.fn();
  const findMany = jest.fn();

  const prisma = {
    session: { findFirst: findSession },
    remark: { upsert, findMany, findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  } as unknown as PrismaService;

  const userService = {
    findById: findUser,
  } as unknown as UserService;

  const service = new RemarkService(prisma, userService);

  beforeEach(() => {
    jest.clearAllMocks();
    findUser.mockResolvedValue({ id: 'user-1' });
  });

  it('rejects remarks when the agent never served the visitor', async () => {
    findSession.mockResolvedValue(null);

    await expect(
      service.upsertForAgent('tenant-1', 'user-1', 'agent-1', {
        content: 'vip',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(upsert).not.toHaveBeenCalled();
  });

  it('allows remarks after the agent has served the visitor', async () => {
    findSession.mockResolvedValue({ id: 'session-1' });
    upsert.mockResolvedValue({ id: 'remark-1', content: 'vip' });

    await expect(
      service.upsertForAgent('tenant-1', 'user-1', 'agent-1', {
        content: 'vip',
      }),
    ).resolves.toMatchObject({ id: 'remark-1' });

    expect(findSession).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
        }),
      }),
    );
  });

  it('blocks listing remarks for agents without a session relationship', async () => {
    findSession.mockResolvedValue(null);

    await expect(
      service.listByUser('tenant-1', 'user-1', 'agent-2'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(findMany).not.toHaveBeenCalled();
  });
});
