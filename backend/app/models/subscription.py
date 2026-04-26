from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base, GUID
import uuid


class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
