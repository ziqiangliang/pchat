# PChat 后端规划文档

## 概述

为 PChat 添加 Python 后端服务，支持用户认证、AI 对话代理、TTS 服务、对话记录存储等功能。

## 技术选型

| 组件 | 选择 | 说明 |
|------|------|------|
| 框架 | FastAPI | 快速开发，自带 API 文档 |
| 数据库 | PostgreSQL | Supabase 托管 |
| ORM | SQLAlchemy | 成熟的 Python ORM |
| 认证 | JWT | 无状态认证 |
| TTS | 阿里云 NLS | 高质量中文语音 |

## 架构

```
┌─────────────────────────────────────────────────┐
│              前端 (现有 React 应用)               │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              后端 API (FastAPI)                  │
│                                                 │
│  POST /api/auth/register     # 注册             │
│  POST /api/auth/login        # 登录             │
│  POST /api/chat              # AI 对话代理       │
│  POST /api/tts               # TTS 语音合成      │
│  GET  /api/conversations     # 获取会话列表      │
│  GET  /api/conversations/:id # 获取会话详情      │
│  DELETE /api/conversations/:id # 删除会话       │
│  GET  /api/usage             # 查询用量         │
│  POST /api/payment/webhook   # 支付回调         │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              数据库 (PostgreSQL)                 │
│                                                 │
│  users           # 用户表                       │
│  conversations   # 会话表                       │
│  messages        # 消息表                       │
│  usage_logs      # 用量记录                     │
│  subscriptions   # 订阅记录                     │
└─────────────────────────────────────────────────┘
```

## 数据库表结构

### users 表
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    subscription_type VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### conversations 表
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### messages 表
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    dsl JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### usage_logs 表
```sql
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('chat', 'tts')),
    content TEXT,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### subscriptions 表
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API 接口详情

### 认证相关

#### POST /api/auth/register
注册新用户

**请求：**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "nickname": "用户昵称"
}
```

**响应：**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "用户昵称"
  }
}
```

#### POST /api/auth/login
用户登录

**请求：**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应：**
```json
{
  "success": true,
  "token": "jwt_token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "nickname": "用户昵称"
  }
}
```

### AI 对话

#### POST /api/chat
AI 对话代理（支持流式响应）

**请求：**
```json
{
  "conversation_id": "uuid",
  "message": "什么是等边三角形？"
}
```

**响应：**
流式 SSE 响应，包含 AI 回复和 DSL

### TTS 服务

#### POST /api/tts
文本转语音

**请求：**
```json
{
  "text": "这是一段要朗读的文字",
  "voice": "xiaoyun",
  "speed": 1.0
}
```

**响应：**
音频流 (audio/mpeg)

### 会话管理

#### GET /api/conversations
获取用户会话列表

**响应：**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "等边三角形的性质",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:35:00Z"
    }
  ]
}
```

#### GET /api/conversations/:id
获取会话详情

**响应：**
```json
{
  "id": "uuid",
  "title": "等边三角形的性质",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "什么是等边三角形？",
      "created_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "...",
      "dsl": {},
      "created_at": "2024-01-15T10:30:05Z"
    }
  ]
}
```

#### DELETE /api/conversations/:id
删除会话

### 用量查询

#### GET /api/usage
查询用户用量

**响应：**
```json
{
  "chat": {
    "today": 3,
    "total": 150
  },
  "tts": {
    "today_chars": 500,
    "total_chars": 10000
  },
  "limits": {
    "chat_per_day": 5,
    "tts_chars_per_day": 500
  }
}
```

## 用量限制策略

| 用户类型 | Chat 次数/天 | TTS 字符数/天 |
|----------|-------------|---------------|
| 免费用户 | 5 次 | 500 字符 |
| 付费用户 | 无限 | 10000 字符 |

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── models/              # SQLAlchemy 模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── conversation.py
│   │   ├── message.py
│   │   └── usage_log.py
│   ├── schemas/             # Pydantic 模型
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── chat.py
│   │   └── tts.py
│   ├── routers/             # API 路由
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── chat.py
│   │   ├── tts.py
│   │   ├── conversations.py
│   │   └── usage.py
│   ├── services/            # 业务逻辑
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── chat_service.py
│   │   └── tts_service.py
│   └── utils/               # 工具函数
│       ├── __init__.py
│       ├── jwt.py
│       └── dependencies.py
├── requirements.txt
├── .env.example
└── README.md
```

## 开发计划

| 阶段 | 内容 | 时间 |
|------|------|------|
| Phase 1 | 项目初始化 + 数据库模型 | 1 天 |
| Phase 2 | 用户注册/登录 + JWT | 1 天 |
| Phase 3 | AI 对话代理 + 消息存储 | 1-2 天 |
| Phase 4 | TTS 代理 | 1 天 |
| Phase 5 | 会话列表/详情 API | 1 天 |
| Phase 6 | 用量记录 + 限制 | 1 天 |
| Phase 7 | 支付集成（后期） | - |

## 环境变量

```env
DATABASE_URL=postgresql://user:password@host:5432/pchat
JWT_SECRET=your_jwt_secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=168

DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

ALIYUN_TTS_APP_KEY=your_app_key
ALIYUN_TTS_TOKEN=your_token
```
