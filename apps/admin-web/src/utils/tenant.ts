import type { Rule } from 'antd/es/form';

/** 企业编码：业务主标识，创建后不可修改 */
export const tenantCodeRules: Rule[] = [
  { required: true, message: '请输入企业编码' },
  { min: 2, max: 32, message: '长度为 2-32 个字符' },
  {
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: '仅支持英文字母、数字、下划线和连字符',
  },
];

/** Slug：URL 可读标识 */
export const slugRules: Rule[] = [
  { required: true, message: '请输入 Slug' },
  { min: 2, max: 48, message: '长度为 2-48 个字符' },
  {
    pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    message: '仅支持小写字母、数字和连字符',
  },
];
