import { BadRequestException } from '@nestjs/common';

export function formatVisitorName(visitorNo: number) {
  return `访客${String(visitorNo).padStart(6, '0')}`;
}

export function validateAgentPassword(password: string) {
  if (password.length < 8 || password.length > 20) {
    throw new BadRequestException('新密码长度需为 8~20 位');
  }
  if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) {
    throw new BadRequestException('新密码需同时包含数字和字母');
  }
}

export type UserSourceMeta = {
  pageUrl?: string;
  referer?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export function parseUserMetadata(raw: unknown): UserSourceMeta & Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  return raw as UserSourceMeta & Record<string, unknown>;
}
