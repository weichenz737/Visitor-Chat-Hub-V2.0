import type { Rule } from 'antd/es/form';

export const accountRules: Rule[] = [
  { required: true, message: '请输入账号' },
  { min: 2, max: 64, message: '账号长度 2-64' },
];
