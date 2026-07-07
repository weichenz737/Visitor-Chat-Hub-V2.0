import { Message, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface SenderContext {
  userNickname?: string | null;
  visitorNo?: number | null;
}

function formatVisitorName(nickname?: string | null, visitorNo?: number | null) {
  if (nickname) return nickname;
  if (visitorNo) return `访客#${visitorNo}`;
  return '访客';
}

function resolveSenderName(
  message: Pick<Message, 'senderType' | 'senderId'>,
  agentMap: Map<string, string>,
  userMap: Map<string, string>,
  fallbackUserName: string,
) {
  if (message.senderType === MessageSenderType.SYSTEM) return '系统';
  if (message.senderType === MessageSenderType.AGENT) {
    return (message.senderId && agentMap.get(message.senderId)) || '客服';
  }
  if (message.senderType === MessageSenderType.USER) {
    return (message.senderId && userMap.get(message.senderId)) || fallbackUserName;
  }
  return message.senderType;
}

export async function enrichMessagesWithSenderNames<T extends Message>(
  prisma: PrismaService,
  tenantId: string,
  messages: T[],
  context?: SenderContext,
) {
  if (!messages.length) return [];

  const agentIds = new Set<string>();
  const userIds = new Set<string>();
  for (const m of messages) {
    if (m.senderType === MessageSenderType.AGENT && m.senderId) {
      agentIds.add(m.senderId);
    }
    if (m.senderType === MessageSenderType.USER && m.senderId) {
      userIds.add(m.senderId);
    }
  }

  const [agents, users] = await Promise.all([
    agentIds.size
      ? prisma.agent.findMany({
          where: { tenantId, id: { in: [...agentIds] } },
          select: { id: true, name: true },
        })
      : [],
    userIds.size
      ? prisma.user.findMany({
          where: { tenantId, id: { in: [...userIds] } },
          select: { id: true, nickname: true, visitorNo: true },
        })
      : [],
  ]);

  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const userMap = new Map(
    users.map((u) => [u.id, formatVisitorName(u.nickname, u.visitorNo)]),
  );
  const fallbackUserName = formatVisitorName(context?.userNickname, context?.visitorNo);

  return messages.map((m) => ({
    ...m,
    senderName: resolveSenderName(m, agentMap, userMap, fallbackUserName),
  }));
}
