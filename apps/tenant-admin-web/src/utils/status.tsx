import { Tag } from 'antd';

export const agentRoleMap = {
  TENANT_ADMIN: '企业管理员',
  SUPERVISOR: '客服主管',
  AGENT: '客服',
} as const;

export const agentAccountStatusMap = {
  ACTIVE: { label: '启用', color: 'green' },
  SUSPENDED: { label: '冻结', color: 'red' },
} as const;

export function StatusTag({
  value,
  map,
}: {
  value: string;
  map: Record<string, { label: string; color: string }>;
}) {
  const item = map[value];
  return item ? <Tag color={item.color}>{item.label}</Tag> : <Tag>{value}</Tag>;
}

export const sessionStatusMap = {
  WAITING: { label: '等待中', color: 'orange' },
  ACTIVE: { label: '进行中', color: 'green' },
  CLOSED: { label: '已结束', color: 'default' },
  REMOVED: { label: '已移除', color: 'red' },
} as const;
