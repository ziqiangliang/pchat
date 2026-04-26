# PChat Backend

PChat 后端 API 服务，基于 FastAPI 构建。

## 快速开始

### 1. 安装依赖

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

**本地开发默认使用 SQLite**，无需额外配置数据库。

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## LLM API 配置

后端支持所有 OpenAI 兼容格式的 API：

### OpenAI

```env
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
```

### DeepSeek

```env
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```

### Claude (通过兼容层)

```env
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.anthropic.com/v1
LLM_MODEL=claude-3-opus-20240229
```

### 本地模型 (Ollama / LM Studio)

```env
LLM_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3
```

### 其他兼容服务

任何支持 OpenAI Chat Completions API 格式的服务都可以使用：
- 智谱 AI (GLM)
- 月之暗面 (Kimi)
- 阿里云 (通义千问)
- 百度 (文心一言)
- 等等...

## 数据库

| 环境 | 数据库 | 说明 |
|------|--------|------|
| 本地开发 | SQLite | 默认，无需安装 |
| 生产环境 | PostgreSQL | 推荐 Supabase 托管 |

数据库会自动创建表结构，首次启动即可使用。

## API 接口

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| GET | /api/auth/me | 获取当前用户 |

### AI 对话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/chat | AI 对话（流式响应） |

### TTS

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/tts | 文本转语音 |

### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/conversations | 获取会话列表 |
| GET | /api/conversations/{id} | 获取会话详情 |
| PATCH | /api/conversations/{id} | 更新会话标题 |
| DELETE | /api/conversations/{id} | 删除会话 |

### 用量查询

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/usage | 查询用量统计 |

## 用量限制

| 用户类型 | Chat 次数/天 | TTS 字符数/天 |
|----------|-------------|---------------|
| 免费用户 | 5 次 | 500 字符 |
| 付费用户 | 无限 | 10000 字符 |

## 项目结构

```
backend/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接
│   ├── models/              # SQLAlchemy 模型
│   ├── schemas/             # Pydantic 模型
│   ├── routers/             # API 路由
│   ├── services/            # 业务逻辑
│   └── utils/               # 工具函数
├── requirements.txt
├── .env.example
└── README.md
```

## 部署

### Railway

```bash
railway login
railway init
railway up
```

### Docker

```bash
docker build -t pchat-backend .
docker run -p 8000:8000 pchat-backend
```
