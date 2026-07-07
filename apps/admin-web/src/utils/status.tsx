import { Tag } from 'antd';

export const tenantStatusMap = {
  ACTIVE: { text: '启用', color: 'success' },
  SUSPENDED: { text: '冻结', color: 'warning' },
  DISABLED: { text: '已停用', color: 'default' },
} as const;

export const agentAccountStatusMap = {
  ACTIVE: { text: '启用', color: 'success' },
  SUSPENDED: { text: '冻结', color: 'error' },
} as const;

export const agentRoleMap = {
  TENANT_ADMIN: '企业管理员',
  AGENT: '客服',
  SUPERVISOR: '客服主管',
} as const;

export const sessionStatusMap = {
  WAITING: { text: '等待中', color: 'warning' },
  ACTIVE: { text: '进行中', color: 'processing' },
  CLOSED: { text: '已结束', color: 'default' },
} as const;

export function StatusTag({
  value,
  map,
}: {
  value: string;
  map: Record<string, { text: string; color: string }>;
}) {
  const item = map[value] ?? { text: value, color: 'default' };
  return <Tag color={item.color}>{item.text}</Tag>;
}

export function formatDuration(seconds: number) {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}分${s}秒` : `${m}分钟`;
}
