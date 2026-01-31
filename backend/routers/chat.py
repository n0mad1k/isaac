"""
AI Chat Router
Handles conversations with the Ollama-powered assistant and AI insights
"""

import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from models.database import get_db
from models.users import User
from models.chat import ChatConversation, ChatMessage, AiInsight, InsightPriority
from routers.auth import require_auth
from services.ollama_service import get_configured_service
from services.ai_context import detect_topic, gather_context, build_system_prompt


router = APIRouter(prefix="/api/chat", tags=["chat"])


# --- Pydantic Schemas ---

class ConversationCreate(BaseModel):
    topic: Optional[str] = Field(None, max_length=50)

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


# --- Health & Models ---

@router.get("/health/")
async def check_ai_health(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Check if Ollama is running and accessible"""
    try:
        service = await get_configured_service(db)
        healthy = await service.check_health()
        await service.close()
        return {
            "status": "online" if healthy else "offline",
            "model": service.model,
            "url": service.base_url,
        }
    except Exception as e:
        logger.error(f"AI health check failed: {e}")
        return {"status": "offline", "model": "", "url": ""}


@router.get("/models/")
async def list_ai_models(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """List available Ollama models"""
    try:
        service = await get_configured_service(db)
        models = await service.list_models()
        await service.close()
        return {"models": models}
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail="Failed to list AI models")


# --- Conversations ---

@router.post("/conversations/")
async def create_conversation(
    data: ConversationCreate,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation"""
    conversation = ChatConversation(
        title="New Chat",
        topic=data.topic,
    )
    db.add(conversation)
    await db.flush()
    await db.refresh(conversation)

    return {
        "id": conversation.id,
        "title": conversation.title,
        "topic": conversation.topic,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
    }


@router.get("/conversations/")
async def list_conversations(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
):
    """List all conversations, newest first"""
    result = await db.execute(
        select(ChatConversation)
        .order_by(desc(ChatConversation.updated_at))
        .limit(limit)
    )
    conversations = result.scalars().all()

    return {
        "conversations": [
            {
                "id": c.id,
                "title": c.title,
                "topic": c.topic,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in conversations
        ]
    }


@router.get("/conversations/{conversation_id}/")
async def get_conversation(
    conversation_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get a conversation with all its messages"""
    result = await db.execute(
        select(ChatConversation).where(ChatConversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()

    return {
        "id": conversation.id,
        "title": conversation.title,
        "topic": conversation.topic,
        "created_at": conversation.created_at.isoformat() if conversation.created_at else None,
        "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else None,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "context_summary": m.context_summary,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }


@router.delete("/conversations/{conversation_id}/")
async def delete_conversation(
    conversation_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversation and all its messages"""
    result = await db.execute(
        select(ChatConversation).where(ChatConversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.delete(conversation)
    return {"status": "deleted"}


# --- Messages (SSE Streaming) ---

@router.post("/conversations/{conversation_id}/messages/")
async def send_message(
    conversation_id: int,
    data: MessageCreate,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Send a message and get a streamed AI response via SSE"""
    # Verify conversation exists
    result = await db.execute(
        select(ChatConversation).where(ChatConversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if AI is enabled
    from services.ollama_service import get_setting_value
    ai_enabled = await get_setting_value(db, "ai_enabled", "true")
    if ai_enabled != "true":
        raise HTTPException(status_code=503, detail="AI assistant is disabled in settings")

    # Save user message
    user_msg = ChatMessage(
        conversation_id=conversation_id,
        role="user",
        content=data.content,
    )
    db.add(user_msg)

    # Detect topic from current message
    topic = detect_topic(data.content)
    if topic and not conversation.topic:
        conversation.topic = topic
    elif topic:
        # Update topic if a new one is detected
        conversation.topic = topic

    # Update conversation title from first message if still default
    if conversation.title == "New Chat":
        conversation.title = data.content[:80] + ("..." if len(data.content) > 80 else "")

    conversation.updated_at = datetime.utcnow()
    await db.commit()

    # Gather context for the detected topic
    effective_topic = topic or conversation.topic
    context_data = await gather_context(db, effective_topic)
    system_prompt = build_system_prompt(effective_topic)

    # Build conversation history (last N messages for context)
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation_id)
        .where(ChatMessage.role.in_(["user", "assistant"]))
        .order_by(desc(ChatMessage.created_at))
        .limit(10)
    )
    recent_messages = result.scalars().all()
    # Reverse to chronological order, exclude the current message (already sent as prompt)
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(recent_messages)
        if m.id != user_msg.id
    ]

    # Get configured Ollama service
    service = await get_configured_service(db)

    # Create the SSE streaming response
    async def event_stream():
        full_response = []
        try:
            async for token in service.generate_stream(
                prompt=data.content,
                system_prompt=system_prompt,
                context=context_data,
                history=history,
            ):
                full_response.append(token)
                # SSE format: data: {json}\n\n
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Send done signal
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            error_msg = "I encountered an error generating a response."
            full_response.append(error_msg)
            yield f"data: {json.dumps({'token': error_msg, 'error': True})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        finally:
            # Save complete assistant response to DB
            try:
                from models.database import async_session
                async with async_session() as save_db:
                    complete_text = "".join(full_response)
                    if complete_text.strip():
                        assistant_msg = ChatMessage(
                            conversation_id=conversation_id,
                            role="assistant",
                            content=complete_text,
                            context_summary=f"topic={effective_topic}" if effective_topic else None,
                        )
                        save_db.add(assistant_msg)
                        await save_db.commit()
            except Exception as e:
                logger.error(f"Failed to save assistant response: {e}")

            await service.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --- Insights ---

@router.get("/insights/")
async def list_insights(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    domain: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    limit: int = Query(default=50, ge=1, le=200),
):
    """List AI insights, optionally filtered"""
    query = select(AiInsight).where(AiInsight.is_dismissed == False)

    if domain:
        query = query.where(AiInsight.domain == domain)
    if unread_only:
        query = query.where(AiInsight.is_read == False)

    query = query.order_by(desc(AiInsight.created_at)).limit(limit)
    result = await db.execute(query)
    insights = result.scalars().all()

    return {
        "insights": [
            {
                "id": i.id,
                "domain": i.domain,
                "insight_type": i.insight_type,
                "title": i.title,
                "content": i.content,
                "priority": i.priority.value if i.priority else "medium",
                "is_read": i.is_read,
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "expires_at": i.expires_at.isoformat() if i.expires_at else None,
            }
            for i in insights
        ]
    }


@router.get("/insights/unread-count/")
async def get_unread_count(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get count of unread, non-dismissed insights"""
    from sqlalchemy import func
    result = await db.execute(
        select(func.count(AiInsight.id))
        .where(AiInsight.is_read == False)
        .where(AiInsight.is_dismissed == False)
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.put("/insights/{insight_id}/read/")
async def mark_insight_read(
    insight_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Mark an insight as read"""
    result = await db.execute(
        select(AiInsight).where(AiInsight.id == insight_id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    insight.is_read = True
    return {"status": "read"}


@router.put("/insights/{insight_id}/dismiss/")
async def dismiss_insight(
    insight_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Dismiss an insight (hides it)"""
    result = await db.execute(
        select(AiInsight).where(AiInsight.id == insight_id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    insight.is_dismissed = True
    return {"status": "dismissed"}
