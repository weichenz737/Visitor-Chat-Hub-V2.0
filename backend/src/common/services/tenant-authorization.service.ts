import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const TENANT_AUTH_KEYS = {
  allowDeleteMessages: 'allowDeleteMessages',
  allowDeleteSessions: 'allowDeleteSessions',
  allowDeleteFiles: 'allowDeleteFiles',
  allowEditMessages: 'allowEditMessages',
  allowAdminTransfer: 'allowAdminTransfer',
  allowAgentTransfer: 'allowAgentTransfer',
  maxAgentCount: 'maxAgentCount',
} as const;

export const TENANT_AUTH_DEFAULTS: Record<string, string> = {
  [TENANT_AUTH_KEYS.allowDeleteMessages]: 'true',
  [TENANT_AUTH_KEYS.allowDeleteSessions]: 'true',
  [TENANT_AUTH_KEYS.allowDeleteFiles]: 'true',
  [TENANT_AUTH_KEYS.allowEditMessages]: 'true',
  [TENANT_AUTH_KEYS.allowAdminTransfer]: 'true',
  [TENANT_AUTH_KEYS.allowAgentTransfer]: 'true',
  [TENANT_AUTH_KEYS.maxAgentCount]: '0',
};

export interface TenantAuthorizations {
  allowDeleteMessages: boolean;
  allowDeleteSessions: boolean;
  allowDeleteFiles: boolean;
  allowEditMessages: boolean;
  allowAdminTransfer: boolean;
  allowAgentTransfer: boolean;
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
      allowEditMessages: this.parseBool(
        map[TENANT_AUTH_KEYS.allowEditMessages],
        true,
      ),
      allowAdminTransfer: this.parseBool(
        map[TENANT_AUTH_KEYS.allowAdminTransfer],
        true,
      ),
      allowAgentTransfer: this.parseBool(
        map[TENANT_AUTH_KEYS.allowAgentTransfer],
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

  async assertAllowEditMessages(tenantId: string) {
    const auth = await this.getAuthorizations(tenantId);
    if (!auth.allowEditMessages) {
      throw new ForbiddenException('未授权编辑聊天记录');
    }
  }

  async assertAllowAdminTransfer(tenantId: string) {
    const auth = await this.getAuthorizations(tenantId);
    if (!auth.allowAdminTransfer) {
      throw new ForbiddenException('未授权企业后台转接客服');
    }
  }

  async assertAllowAgentTransfer(tenantId: string) {
    const auth = await this.getAuthorizations(tenantId);
    if (!auth.allowAgentTransfer) {
      throw new ForbiddenException('未授权客服转接');
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
