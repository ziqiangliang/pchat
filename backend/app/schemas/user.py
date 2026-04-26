from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserCreate(BaseModel):
    email: str
    password: str
    nickname: Optional[str] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        if not v or '@' not in v:
            raise ValueError('Invalid email format')
        return v.lower().strip()


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    nickname: Optional[str]
    subscription_type: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    success: bool = True
    token: str
    user: UserResponse


class RegisterResponse(BaseModel):
    success: bool = True
    user: UserResponse
