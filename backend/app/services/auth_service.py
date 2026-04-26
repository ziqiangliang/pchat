from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


async def get_user_by_email(db: AsyncSession, email: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, user_data: UserCreate) -> User:
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        raise ValueError("Email already registered")
    
    hashed_password = hash_password(user_data.password)
    
    user = User(
        email=user_data.email,
        password_hash=hashed_password,
        nickname=user_data.nickname
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await get_user_by_email(db, email)
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    return user
