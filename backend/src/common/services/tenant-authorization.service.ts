import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const TENANT_AUTH_KEYS = {
  allowDeleteMessages: 'allowDeleteMessages',
  allowDeleteSessions: 'allowDeleteSessions',
  allowDeleteFiles: 'allowDeleteFiles',
  maxAgentCount: 'maxAgentCount',
} as const;

export const TENANT_AUTH_DEFAULTS: Record<string, string> = {
  [TENANT_AUTH_KEYS.allowDeleteMessages]: 'true',
  [TENANT_AUTH_KEYS.allowDeleteSessions]: 'true',
  [TENANT_AUTH_KEYS.allowDeleteFiles]: 'true',
  [TENANT_AUTH_KEYS.maxAgentCount]: '0',
};

export interface TenantAuthorizations {
  allowDeleteMessages: boolean;
  allowDeleteSessions: boolean;
  allowDeleteFiles: boolean;
  maxAgentCount: number;
  currentAgentCount: number;
  canCreateAgent: boolean;
}

@Injectable()
export class TenantAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  private parseBool(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    return value === 'true' || value === '1';
  }

  private parseMaxAgentCount(value: string | undefined): number {
    const n = parseInt(value ?? '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async getAuthorizations(tenantId: string): Promise<TenantAuthorizations> {
    const rows = await this.prisma.tenantSetting.findMany({
      where: {
        tenantId,
        key: { in: Object.values(TENANT_AUTH_KEYS) },
      },
    });
    const map = { ...TENANT_AUTH_DEFAULTS };
    rows.forEach((r) => {
      map[r.key] = r.value;
    });

    const currentAgentCount = await this.prisma.agent.count({ where: { tenantId } });
    const maxAgentCount = this.parseMaxAgentCount(map[TENANT_AUTH_KEYS.maxAgentCount]);
    const canCreateAgent =
      maxAgentCount === 0 || currentAgentCount < maxAgentCount;

    return {
      allowDeleteMessages: this.parseBool(
        map[TENANT_AUTH_KEYS.allowDeleteMessages],
        true,
      ),
      allowDeleteSessions: this.parseBool(
        map[TENANT_AUTH_KEYS.allowDeleteSessions],
        true,
      ),
      allowDeleteFiles: this.parseBool(
        map[TENANT_AUTH_KEYS.allowDeleteFiles],
        true,
      ),
      maxAgentCount,
      currentAgentCount,
      canCreateAgent,
    };
  }

  async assertAllowDeleteMessages(tenantId: string) {
    const auth = await this.getAuthorizations(tenantId);
    if (!auth.allowDeleteMessages) {
      throw new ForbiddenException('未授权删除聊天记录');
    }
  }

  async assertAllowDeleteSessions(tenantId: string) {
    const auth = await this.getAuthorizations(tenantId);
    if (!auth.allowDeleteSessions) {
      throw new ForbiddenException('未授权删除访客会话');
    }
  }

  async assertAllowDeleteFiles(tenantId: string) {
    const auth = await this.getAuthorizations(tenantId);
    if (!auth.allowDeleteFiles) {
      throw new ForbiddenException('未授权删除文件');
    }
  }

  async assertCanCreateAgent(tenantId: string) {
    const auth = await this.getAuthorizations(tenantId);
    if (!auth.canCreateAgent) {
      throw new ForbiddenException(
        `已达到授权客服数量上限（${auth.maxAgentCount}）`,
      );
    }
  }
}
