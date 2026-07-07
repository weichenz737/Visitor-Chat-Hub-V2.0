import type { Rule } from 'antd/es/form';

/** 账号规则：支持英文字母、数字和常用符号，不强制邮箱格式 */
export const accountRules: Rule[] = [
  { required: true, message: '请输入账号' },
  { min: 2, max: 64, message: '账号长度为 2-64 个字符' },
  {
    pattern: /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':",.<>?/\\|`~]+$/,
    message: '账号仅支持英文字母、数字和符号',
  },
];
