from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID


class MessageItem(BaseModel):
    id: UUID
    role: str
    content: str
    dsl: Optional[Any] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConversationListItem(BaseModel):
    id: UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    id: UUID
    title: Optional[str]
    messages: List[MessageItem]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationListItem]


class UpdateConversationRequest(BaseModel):
    title: str
