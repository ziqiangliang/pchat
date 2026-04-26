from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.usage import UsageResponse
from app.services.usage_service import get_user_usage
from app.utils.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/usage", tags=["usage"])


@router.get("", response_model=UsageResponse)
async def get_usage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_user_usage(db, str(current_user.id))
