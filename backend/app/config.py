from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./pchat.db"
    JWT_SECRET: str = "your_jwt_secret_here"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 168
    
    LLM_API_KEY: Optional[str] = None
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o"
    
    ALIYUN_TTS_APP_KEY: Optional[str] = None
    ALIYUN_TTS_TOKEN: Optional[str] = None
    
    DEFAULT_ADMIN_EMAIL: str = "admin@gmail.com"
    DEFAULT_ADMIN_PASSWORD: str = "admin"
    DEFAULT_ADMIN_NICKNAME: str = "Administrator"
    
    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL
    
    @property
    def has_default_admin(self) -> bool:
        return bool(self.DEFAULT_ADMIN_EMAIL and self.DEFAULT_ADMIN_PASSWORD)
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
