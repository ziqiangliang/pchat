from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.chat import ChatRequest, ChatMessage
from app.services.chat_service import stream_chat
from app.services.usage_service import check_chat_limit, log_usage
from app.utils.dependencies import get_current_user
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.usage_log import UsageType

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not await check_chat_limit(db, str(current_user.id)):
        raise HTTPException(
            status_code=429,
            detail="Daily chat limit exceeded. Please upgrade to premium for unlimited access."
        )
    
    conversation = None
    
    if request.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == request.conversation_id,
                Conversation.user_id == current_user.id
            )
        )
        conversation = result.scalar_one_or_none()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = Conversation(
            user_id=current_user.id,
            title=request.message[:50] if len(request.message) > 50 else request.message
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)
    
    user_message = Message(
        conversation_id=conversation.id,
        role=MessageRole.user,
        content=request.message
    )
    db.add(user_message)
    await db.commit()
    
    result = await db.execute(
        select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
    )
    history_messages = result.scalars().all()
    
    chat_messages = [
        ChatMessage(role=msg.role.value, content=msg.content)
        for msg in history_messages
    ]
    
    async def generate():
        full_content = ""
        async for chunk in stream_chat(chat_messages):
            full_content += chunk
            yield f"data: {chunk}\n\n"
        
        assistant_message = Message(
            conversation_id=conversation.id,
            role=MessageRole.assistant,
            content=full_content
        )
        db.add(assistant_message)
        
        await log_usage(db, str(current_user.id), UsageType.chat, request.message[:100])
        
        await db.commit()
        
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Conversation-Id": str(conversation.id)
        }
    )
