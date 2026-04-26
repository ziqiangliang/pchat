from pydantic import BaseModel
from typing import Optional


class ChatUsage(BaseModel):
    today: int
    total: int


class TTSUsage(BaseModel):
    today_chars: int
    total_chars: int


class UsageLimits(BaseModel):
    chat_per_day: int
    tts_chars_per_day: int


class UsageResponse(BaseModel):
    chat: ChatUsage
    tts: TTSUsage
    limits: UsageLimits
