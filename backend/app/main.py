from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.routers import auth, chat, tts, conversations, usage
from app.models.user import User
from app.services.auth_service import hash_password

app = FastAPI(
    title="PChat API",
    description="PChat 后端 API 服务",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(tts.router)
app.include_router(conversations.router)
app.include_router(usage.router)


async def create_default_admin():
    if not settings.has_default_admin:
        print("No default admin configured, skipping...")
        return
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == settings.DEFAULT_ADMIN_EMAIL))
        existing_admin = result.scalar_one_or_none()
        
        if not existing_admin:
            admin_user = User(
                email=settings.DEFAULT_ADMIN_EMAIL,
                password_hash=hash_password(settings.DEFAULT_ADMIN_PASSWORD),
                nickname=settings.DEFAULT_ADMIN_NICKNAME,
                subscription_type="paid"
            )
            session.add(admin_user)
            await session.commit()
            print(f"Default admin user created: {settings.DEFAULT_ADMIN_EMAIL} / {settings.DEFAULT_ADMIN_PASSWORD}")


@app.on_event("startup")
async def startup():
    await init_db()
    await create_default_admin()


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/")
async def root():
    return {"message": "PChat API", "docs": "/docs"}
