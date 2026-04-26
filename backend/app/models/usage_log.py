from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.sql import func
from app.database import Base, GUID
import uuid
import enum


class UsageType(str, enum.Enum):
    chat = "chat"
    tts = "tts"


class UsageLog(Base):
    __tablename__ = "usage_logs"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(UsageType), nullable=False)
    content = Column(Text, nullable=True)
    tokens_used = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
