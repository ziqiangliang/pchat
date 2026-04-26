from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.usage_log import UsageLog, UsageType
from app.models.user import User
from app.schemas.usage import UsageResponse, ChatUsage, TTSUsage, UsageLimits

FREE_CHAT_LIMIT = 5
FREE_TTS_CHARS_LIMIT = 500
PAID_TTS_CHARS_LIMIT = 10000


async def get_user_usage(db: AsyncSession, user_id: str) -> UsageResponse:
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    
    chat_today_result = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.user_id == user_id,
            UsageLog.type == UsageType.chat,
            UsageLog.created_at >= today_start
        )
    )
    chat_today = chat_today_result.scalar() or 0
    
    chat_total_result = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.user_id == user_id,
            UsageLog.type == UsageType.chat
        )
    )
    chat_total = chat_total_result.scalar() or 0
    
    tts_today_result = await db.execute(
        select(func.sum(func.length(UsageLog.content))).where(
            UsageLog.user_id == user_id,
            UsageLog.type == UsageType.tts,
            UsageLog.created_at >= today_start
        )
    )
    tts_today_chars = tts_today_result.scalar() or 0
    
    tts_total_result = await db.execute(
        select(func.sum(func.length(UsageLog.content))).where(
            UsageLog.user_id == user_id,
            UsageLog.type == UsageType.tts
        )
    )
    tts_total_chars = tts_total_result.scalar() or 0
    
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    is_paid = user and user.subscription_type != "free"
    
    limits = UsageLimits(
        chat_per_day=-1 if is_paid else FREE_CHAT_LIMIT,
        tts_chars_per_day=PAID_TTS_CHARS_LIMIT if is_paid else FREE_TTS_CHARS_LIMIT
    )
    
    return UsageResponse(
        chat=ChatUsage(today=chat_today, total=chat_total),
        tts=TTSUsage(today_chars=tts_today_chars, total_chars=tts_total_chars),
        limits=limits
    )


async def check_chat_limit(db: AsyncSession, user_id: str) -> bool:
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    if user and user.subscription_type != "free":
        return True
    
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    
    result = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.user_id == user_id,
            UsageLog.type == UsageType.chat,
            UsageLog.created_at >= today_start
        )
    )
    count = result.scalar() or 0
    
    return count < FREE_CHAT_LIMIT


async def check_tts_limit(db: AsyncSession, user_id: str, chars: int) -> bool:
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    
    limit = PAID_TTS_CHARS_LIMIT if (user and user.subscription_type != "free") else FREE_TTS_CHARS_LIMIT
    
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    
    result = await db.execute(
        select(func.sum(func.length(UsageLog.content))).where(
            UsageLog.user_id == user_id,
            UsageLog.type == UsageType.tts,
            UsageLog.created_at >= today_start
        )
    )
    used_chars = result.scalar() or 0
    
    return (used_chars + chars) <= limit


async def log_usage(db: AsyncSession, user_id: str, usage_type: UsageType, content: str = None, tokens: int = 0):
    log = UsageLog(
        user_id=user_id,
        type=usage_type,
        content=content,
        tokens_used=tokens
    )
    db.add(log)
    await db.commit()
