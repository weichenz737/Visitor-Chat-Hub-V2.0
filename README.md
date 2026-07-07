# Visitor Chat Hub V2.0

企业级 SaaS 多租户在线客服系统（Visitor Chat Hub V2.0）。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | NestJS + Prisma + PostgreSQL |
| 实时通信 | WebSocket (Socket.IO) |
| 缓存 | Redis |
| 前端 | React + TypeScript + Zustand + Ant Design |
| 文件存储 | 本地存储 / OSS（可扩展） |

## 项目结构

```
├── backend/              # NestJS API + WebSocket Gateway
├── apps/
│   ├── user-web/         # 访客端 (5173)
│   ├── agent-web/        # 客服工作台 (5174)
│   ├── admin-web/        # 平台管理后台 (5175)
│   └── tenant-admin-web/ # 企业后台 (5177)
├── sdk/                  # 嵌入式 Widget SDK (5176)
├── packages/shared/      # 共享类型、API、状态管理
├── deploy/               # 阿里云 ECS 部署脚本
└── doc/                  # 设计文档
```

## 快速开始

### 1. 启动基础设施

```bash
docker compose up -d
```

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化数据库

```bash
cd backend
npx prisma migrate dev
npm run prisma:seed
```

### 4. 启动服务

```bash
npm run dev:backend   # API :3000
npm run dev:user      # 访客端 :5173
npm run dev:agent     # 客服端 :5174
npm run dev:admin     # 平台后台 :5175
npm run dev:tenant    # 企业后台 :5177
npm run dev:sdk       # SDK 演示 :5176
```

## 演示账号

| 角色 | 账号 | 密码 | 入口 |
|------|------|------|------|
| 平台管理员 | admin@example.com | admin123 | :5175 |
| 企业管理员 | admin@demo.com | agent123 | :5177 |
| 客服主管 | supervisor@demo.com | supervisor123 | :5174 |
| 客服 | agent@demo.com | agent123 | :5174 |

租户代码：`demo001`

## V2.0 主要能力

- SaaS 多租户隔离（全表 `tenant_id`）
- WebSocket 实时消息、转接、已读回执
- 平台后台：租户/客服/会话/文件管理
- 企业后台：客服管理、会话列表筛选、转接客服
- 文件独立上传，消息仅传 URL
- 嵌入式 SDK Widget

## 生产部署（阿里云 ECS）

```bash
# 服务器目录
/opt/customer-service-chat

# 首次部署
bash deploy/remote-start.sh

# 更新代码后重新部署
bash deploy/redeploy.sh
```

使用 `docker-compose.aliyun.yml`，需配置 `.env.aliyun`：

```
PUBLIC_BASE_URL=http://your-server-ip
POSTGRES_PASSWORD=...
JWT_SECRET=...
CORS_ORIGINS=http://your-server-ip:5173,...
```

## WebSocket 事件

| 事件 | 说明 |
|------|------|
| `user_connect` | 访客连接会话 |
| `agent_connect` | 客服上线 |
| `message` | 消息收发 |
| `transfer_session` | 会话转接 |
| `read_receipt` | 已读回执 |
| `session_assigned` | 会话分配 |

## SDK 嵌入

```html
<div id="cs-widget-root"></div>
<script src="http://localhost:5176/dist/cs-widget.iife.js"></script>
<script>
  CSWidget.init('your_tenant_api_key', 'cs-widget-root');
</script>
```

## License

MIT
