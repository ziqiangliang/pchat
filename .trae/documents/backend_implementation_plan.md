# PChat 后端实现计划

## 概述

按照 `backend/BACKEND_PLAN.md` 中的规划，使用 Python FastAPI 实现 PChat 后端服务。

---

## Phase 1: 项目初始化 + 数据库模型

### 1.1 创建项目结构

创建以下目录和文件：
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   │   └── __init__.py
│   ├── schemas/
│   │   └── __init__.py
│   ├── routers/
│   │   └── __init__.py
│   ├── services/
│   │   └── __init__.py
│   └── utils/
│       └── __init__.py
├── requirements.txt
├── .env.example
└── README.md
```

### 1.2 创建 requirements.txt

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
asyncpg==0.29.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
pydantic==2.5.3
pydantic-settings==2.1.0
python-multipart==0.0.6
httpx==0.26.0
aiocache==0.12.2
```

### 1.3 创建 config.py

实现配置管理类，读取环境变量：
- DATABASE_URL
- JWT_SECRET
- JWT_ALGORITHM
- JWT_EXPIRE_HOURS
- DEEPSEEK_API_KEY
- DEEPSEEK_BASE_URL
- ALIYUN_TTS_APP_KEY
- ALIYUN_TTS_TOKEN

### 1.4 创建 database.py

实现数据库连接：
- 异步 SQLAlchemy 引擎
- 会话管理
- get_db 依赖函数

### 1.5 创建数据库模型

#### models/user.py
- User 模型
- 字段: id, email, password_hash, nickname, subscription_type, created_at, updated_at

#### models/conversation.py
- Conversation 模型
- 字段: id, user_id, title, created_at, updated_at

#### models/message.py
- Message 模型
- 字段: id, conversation_id, role, content, dsl, created_at

#### models/usage_log.py
- UsageLog 模型
- 字段: id, user_id, type, content, tokens_used, created_at

#### models/subscription.py
- Subscription 模型
- 字段: id, user_id, plan, status, expires_at, created_at, updated_at

### 1.6 创建 main.py

- 初始化 FastAPI 应用
- 配置 CORS
- 注册路由（占位）
- 健康检查端点

---

## Phase 2: 用户注册/登录 + JWT

### 2.1 创建 schemas/user.py

- UserCreate (email, password, nickname)
- UserLogin (email, password)
- UserResponse (id, email, nickname)
- TokenResponse (token, user)

### 2.2 创建 utils/jwt.py

- create_access_token(user_id) -> str
- verify_token(token) -> dict

### 2.3 创建 utils/dependencies.py

- get_current_user(db, token) -> User
- 验证 JWT 并返回当前用户

### 2.4 创建 services/auth_service.py

- hash_password(password) -> str
- verify_password(plain, hashed) -> bool
- register_user(db, user_data) -> User
- authenticate_user(db, email, password) -> User

### 2.5 创建 routers/auth.py

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me (获取当前用户信息)

---

## Phase 3: AI 对话代理 + 消息存储

### 3.1 创建 schemas/chat.py

- ChatRequest (conversation_id, message)
- ChatStreamResponse (text, dsl, done)

### 3.2 创建 services/chat_service.py

- stream_chat(messages, user_id) -> AsyncGenerator
- 调用 DeepSeek API 流式响应
- 解析 DSL
- 记录用量

### 3.3 创建 routers/chat.py

- POST /api/chat
- SSE 流式响应
- 自动创建会话（如果 conversation_id 为空）
- 保存用户消息和 AI 回复
- 更新会话标题（首次对话）

---

## Phase 4: TTS 代理

### 4.1 创建 schemas/tts.py

- TTSRequest (text, voice, speed)
- TTSResponse (audio_url 或直接返回音频流)

### 4.2 创建 services/tts_service.py

- synthesize(text, voice, speed) -> bytes
- 调用阿里云 TTS API
- 返回音频数据

### 4.3 创建 routers/tts.py

- POST /api/tts
- 返回音频流 (audio/mpeg)
- 记录用量（字符数）

---

## Phase 5: 会话列表/详情 API

### 5.1 创建 schemas/conversation.py

- ConversationListItem (id, title, created_at, updated_at)
- ConversationDetail (id, title, messages, created_at, updated_at)
- MessageItem (id, role, content, dsl, created_at)

### 5.2 创建 routers/conversations.py

- GET /api/conversations
  - 返回用户所有会话列表
  - 按更新时间倒序

- GET /api/conversations/{id}
  - 返回会话详情和所有消息

- DELETE /api/conversations/{id}
  - 删除会话及所有消息

- PATCH /api/conversations/{id}
  - 更新会话标题

---

## Phase 6: 用量记录 + 限制

### 6.1 创建 schemas/usage.py

- UsageResponse (chat, tts, limits)
- ChatUsage (today, total)
- TTSUsage (today_chars, total_chars)
- UsageLimits (chat_per_day, tts_chars_per_day)

### 6.2 创建 services/usage_service.py

- get_user_usage(db, user_id) -> UsageResponse
- check_chat_limit(db, user_id) -> bool
- check_tts_limit(db, user_id, chars) -> bool
- log_usage(db, user_id, type, content, tokens)

### 6.3 创建 routers/usage.py

- GET /api/usage
  - 返回用户用量统计

### 6.4 集成用量限制

- 在 chat 路由中检查 chat 限制
- 在 tts 路由中检查 tts 限制
- 免费用户: 5次chat/天, 500字符tts/天
- 付费用户: 无限chat, 10000字符tts/天

---

## 实现顺序

1. **Phase 1** - 项目初始化 + 数据库模型
2. **Phase 2** - 用户注册/登录 + JWT
3. **Phase 3** - AI 对话代理 + 消息存储
4. **Phase 4** - TTS 代理
5. **Phase 5** - 会话列表/详情 API
6. **Phase 6** - 用量记录 + 限制

---

## 文件清单

| 文件路径 | 说明 |
|----------|------|
| `backend/requirements.txt` | Python 依赖 |
| `backend/.env.example` | 环境变量示例 |
| `backend/app/__init__.py` | 包初始化 |
| `backend/app/main.py` | FastAPI 入口 |
| `backend/app/config.py` | 配置管理 |
| `backend/app/database.py` | 数据库连接 |
| `backend/app/models/__init__.py` | 模型包 |
| `backend/app/models/user.py` | 用户模型 |
| `backend/app/models/conversation.py` | 会话模型 |
| `backend/app/models/message.py` | 消息模型 |
| `backend/app/models/usage_log.py` | 用量日志模型 |
| `backend/app/models/subscription.py` | 订阅模型 |
| `backend/app/schemas/__init__.py` | Schema 包 |
| `backend/app/schemas/user.py` | 用户 Schema |
| `backend/app/schemas/chat.py` | 聊天 Schema |
| `backend/app/schemas/tts.py` | TTS Schema |
| `backend/app/schemas/conversation.py` | 会话 Schema |
| `backend/app/schemas/usage.py` | 用量 Schema |
| `backend/app/routers/__init__.py` | 路由包 |
| `backend/app/routers/auth.py` | 认证路由 |
| `backend/app/routers/chat.py` | 聊天路由 |
| `backend/app/routers/tts.py` | TTS 路由 |
| `backend/app/routers/conversations.py` | 会话路由 |
| `backend/app/routers/usage.py` | 用量路由 |
| `backend/app/services/__init__.py` | 服务包 |
| `backend/app/services/auth_service.py` | 认证服务 |
| `backend/app/services/chat_service.py` | 聊天服务 |
| `backend/app/services/tts_service.py` | TTS 服务 |
| `backend/app/services/usage_service.py` | 用量服务 |
| `backend/app/utils/__init__.py` | 工具包 |
| `backend/app/utils/jwt.py` | JWT 工具 |
| `backend/app/utils/dependencies.py` | FastAPI 依赖 |
