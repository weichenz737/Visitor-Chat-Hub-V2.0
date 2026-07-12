import { BadRequestException } from '@nestjs/common';
import { MessageService } from './message.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionService } from '../session/session.service';
import type { SessionAuthorizationService } from '../session/session-authorization.service';
import type { FileService } from '../file/file.service';

describe('MessageService payload validation', () => {
  const prisma = {} as unknown as PrismaService;
  const sessionService = {} as unknown as SessionService;
  const sessionAuthorization = {
    assertCanSend: jest.fn(),
  } as unknown as SessionAuthorizationService;
  const fileService = {} as unknown as FileService;
  const service = new MessageService(
    prisma,
    sessionService,
    sessionAuthorization,
    fileService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects TEXT messages that embed a data URI', async () => {
    await expect(
      service.create('tenant-1', {
        sessionId: 'session-1',
        senderType: 'USER',
        senderId: 'user-1',
        type: 'TEXT',
        content: 'data:image/png;base64,iVBORw0KGgo=',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(sessionAuthorization.assertCanSend).not.toHaveBeenCalled();
  });

  it('rejects TEXT messages containing base64 payloads', async () => {
    await expect(
      service.create('tenant-1', {
        sessionId: 'session-1',
        senderType: 'USER',
        senderId: 'user-1',
        content: 'prefix;base64,AAAA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects IMAGE messages that are not http(s) URLs', async () => {
    await expect(
      service.create('tenant-1', {
        sessionId: 'session-1',
        senderType: 'USER',
        senderId: 'user-1',
        type: 'IMAGE',
        content: 'ftp://example.com/a.png',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
