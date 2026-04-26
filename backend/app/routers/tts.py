from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.tts import TTSRequest
from app.services.tts_service import synthesize
from app.services.usage_service import check_tts_limit, log_usage
from app.utils.dependencies import get_current_user
from app.models.user import User
from app.models.usage_log import UsageType

router = APIRouter(prefix="/api/tts", tags=["tts"])


@router.post("")
async def text_to_speech(
    request: TTSRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    text_length = len(request.text)
    
    if not await check_tts_limit(db, str(current_user.id), text_length):
        raise HTTPException(
            status_code=429,
            detail="Daily TTS character limit exceeded. Please upgrade to premium for more characters."
        )
    
    try:
        audio_data = await synthesize(request.text, request.voice, request.speed)
        
        await log_usage(db, str(current_user.id), UsageType.tts, request.text)
        
        return Response(
            content=audio_data,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "attachment; filename=speech.mp3"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")
