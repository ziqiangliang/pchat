import httpx
from typing import Optional
from app.config import settings


async def synthesize(text: str, voice: str = "xiaoyun", speed: float = 1.0) -> bytes:
    if not settings.ALIYUN_TTS_APP_KEY or not settings.ALIYUN_TTS_TOKEN:
        raise ValueError("Aliyun TTS not configured")
    
    speech_rate = int((speed - 1.0) * 500)
    
    params = {
        "appkey": settings.ALIYUN_TTS_APP_KEY,
        "token": settings.ALIYUN_TTS_TOKEN,
        "text": text,
        "voice": voice,
        "volume": "50",
        "speech_rate": str(speech_rate),
        "pitch_rate": "0",
        "format": "mp3",
    }
    
    url = "https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params)
        
        if response.status_code != 200:
            raise ValueError(f"TTS API error: {response.status_code}")
        
        return response.content
