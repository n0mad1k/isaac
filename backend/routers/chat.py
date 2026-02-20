"""
AI Chat Router
Handles conversations with the Claude-powered assistant and AI insights
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
from routers.auth import require_auth, require_admin
from services.ollama_service import get_configured_service
from services.ai_context import detect_topic, gather_context, build_system_prompt


router = APIRouter(prefix="/chat", tags=["chat"])


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
    """Check if AI provider is healthy (Ollama running, or API key valid)"""
    from fastapi.responses import JSONResponse
    try:
        service = await get_configured_service(db)
        logger.debug(f"AI health check: service type={type(service).__name__}, provider={service.provider}, model={service.model}")
        healthy = await service.check_health()
        await service.close()
        # Return with no-cache headers to ensure fresh data on each check
        return JSONResponse(
            content={
                "status": "online" if healthy else "offline",
                "model": service.model,
                "provider": service.provider,
            },
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    except Exception as e:
        logger.error(f"AI health check failed: {e}")
        return JSONResponse(
            content={"status": "offline", "model": "", "provider": ""},
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )


@router.get("/models/")
async def list_ai_models(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Return the configured AI model"""
    try:
        service = await get_configured_service(db)
        return {"models": [{"name": service.model, "provider": service.provider}]}
    except Exception as e:
        logger.error(f"Failed to get model info: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI model info")


# --- Knowledge Base ---

@router.get("/knowledge-base/status/")
async def get_kb_status(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get knowledge base status and statistics"""
    from services.knowledge_base import get_kb_stats
    from services.ollama_service import get_setting_value

    enabled = await get_setting_value(db, "knowledge_base_enabled", "false")
    stats = get_kb_stats()

    return {
        "enabled": enabled == "true",
        "available": stats is not None,
        "stats": stats,
    }


# --- AI Restrictions Status ---

@router.get("/restrictions/")
async def get_ai_restrictions_status(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Get current AI restriction settings for display in the UI"""
    from services.ollama_service import get_setting_value

    blocked_topics = await get_setting_value(db, "ai_blocked_topics", "")
    topics_list = [t.strip() for t in blocked_topics.split(",") if t.strip()] if blocked_topics else []

    return {
        "read_only": (await get_setting_value(db, "ai_read_only", "false")) == "true",
        "require_confirmation": (await get_setting_value(db, "ai_require_confirmation", "false")) == "true",
        "max_tokens": int(await get_setting_value(db, "ai_max_response_tokens", "2000")),
        "guardrails_enabled": (await get_setting_value(db, "ai_guardrails_enabled", "true")) == "true",
        "blocked_topics": topics_list,
        "knowledge_base_read_only": True,  # KB is always read-only by design
    }


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


# --- AI Guardrails ---

async def check_guardrails(db: AsyncSession, message: str) -> Optional[str]:
    """
    Check message against AI guardrails. Returns an error message if blocked, None if OK.
    """
    from services.ollama_service import get_setting_value

    # Check if guardrails are enabled
    guardrails_enabled = await get_setting_value(db, "ai_guardrails_enabled", "true")
    if guardrails_enabled != "true":
        return None

    # Check blocked topics
    blocked_topics = await get_setting_value(db, "ai_blocked_topics", "")
    if blocked_topics:
        topics = [t.strip().lower() for t in blocked_topics.split(",") if t.strip()]
        message_lower = message.lower()
        for topic in topics:
            if topic in message_lower:
                return f"I'm configured to not discuss topics related to '{topic}'. Please ask about something else."

    return None


async def get_ai_restrictions(db: AsyncSession) -> dict:
    """Get current AI restriction settings."""
    from services.ollama_service import get_setting_value

    return {
        "read_only": (await get_setting_value(db, "ai_read_only", "false")) == "true",
        "require_confirmation": (await get_setting_value(db, "ai_require_confirmation", "false")) == "true",
        "max_tokens": int(await get_setting_value(db, "ai_max_response_tokens", "2000")),
        "guardrails_enabled": (await get_setting_value(db, "ai_guardrails_enabled", "true")) == "true",
        "can_create_tasks": (await get_setting_value(db, "ai_can_create_tasks", "false")) == "true",
    }


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
    from services.ollama_service import get_setting_value  # helper still lives here
    ai_enabled = await get_setting_value(db, "ai_enabled", "true")
    if ai_enabled != "true":
        raise HTTPException(status_code=503, detail="AI assistant is disabled in settings")

    # Check guardrails
    guardrail_error = await check_guardrails(db, data.content)
    if guardrail_error:
        # Return a polite refusal instead of an error
        async def blocked_stream():
            yield f"data: {json.dumps({'token': guardrail_error})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        return StreamingResponse(blocked_stream(), media_type="text/event-stream")

    # Get AI restrictions
    restrictions = await get_ai_restrictions(db)

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

    # Search knowledge base for relevant reference material
    from services.knowledge_base import search_knowledge_base
    kb_context = await search_knowledge_base(db, data.content)
    if kb_context:
        context_data = context_data + "\n\n" + kb_context if context_data else kb_context

    # Pass task creation capability (only if not read-only)
    can_create = restrictions["can_create_tasks"] and not restrictions["read_only"]
    system_prompt = build_system_prompt(effective_topic, can_create_tasks=can_create)

    # Add restriction notices to system prompt
    if restrictions["read_only"]:
        system_prompt += "\n\nIMPORTANT: You are in READ-ONLY mode. You can answer questions and provide information, but you CANNOT create, modify, or delete any data. If the user asks you to make changes, politely explain that you're in read-only mode and can only provide guidance."
    if restrictions["require_confirmation"]:
        system_prompt += "\n\nIMPORTANT: All actions that modify data require explicit user confirmation. Always ask 'Would you like me to proceed with this change?' before taking any action."

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

    # Get configured Claude service
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


# --- Task Creation from Chat ---

class ChatTaskCreate(BaseModel):
    """Create a task from AI chat suggestion"""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    due_date: Optional[str] = Field(None, pattern=r'^\d{4}-\d{2}-\d{2}$')  # YYYY-MM-DD
    due_time: Optional[str] = Field(None, pattern=r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$')  # HH:MM


@router.post("/create-task/")
async def create_task_from_chat(
    data: ChatTaskCreate,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Create a task from an AI chat suggestion"""
    from services.ollama_service import get_setting_value
    from models.tasks import Task, TaskType, TaskCategory, TaskRecurrence
    from datetime import date as date_type

    # Check if AI can create tasks
    can_create = await get_setting_value(db, "ai_can_create_tasks", "false")
    if can_create != "true":
        raise HTTPException(status_code=403, detail="AI task creation is not enabled in settings")

    # Check if read-only mode
    read_only = await get_setting_value(db, "ai_read_only", "false")
    if read_only == "true":
        raise HTTPException(status_code=403, detail="AI is in read-only mode")

    # Parse due date if provided
    parsed_date = None
    if data.due_date:
        try:
            parsed_date = date_type.fromisoformat(data.due_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Create task
    task = Task(
        title=data.title,
        description=data.description,
        task_type=TaskType.REMINDER,
        category=TaskCategory.CUSTOM,
        due_date=parsed_date,
        due_time=data.due_time,
        recurrence=TaskRecurrence.ONCE,
        priority=2,
        notes="ai:chat",  # Mark as created from AI chat
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    logger.info(f"AI created task: {task.title} (ID: {task.id})")
    return {
        "id": task.id,
        "title": task.title,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "due_time": task.due_time,
        "status": "created",
    }


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


# --- Insight Management (CRUD) ---

class InsightCreate(BaseModel):
    """Create a new manual insight"""
    domain: str = Field(..., max_length=50)
    insight_type: str = Field(default="analysis", max_length=50)
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1, max_length=10000)
    priority: str = Field(default="medium")  # low, medium, high
    expires_hours: Optional[int] = Field(default=168, ge=1, le=8760)  # default 1 week, max 1 year


class InsightUpdate(BaseModel):
    """Update an existing insight"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=10000)
    priority: Optional[str] = Field(None)
    is_read: Optional[bool] = None
    is_dismissed: Optional[bool] = None


@router.get("/insights/all/")
async def list_all_insights(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
):
    """List ALL insights including dismissed (for management UI)"""
    query = select(AiInsight).order_by(desc(AiInsight.created_at)).limit(limit)
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
                "is_dismissed": i.is_dismissed,
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "expires_at": i.expires_at.isoformat() if i.expires_at else None,
            }
            for i in insights
        ]
    }


@router.post("/insights/")
async def create_insight(
    data: InsightCreate,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Create a manual insight"""
    from datetime import timedelta

    # Validate priority
    try:
        priority = InsightPriority(data.priority.lower())
    except ValueError:
        priority = InsightPriority.MEDIUM

    insight = AiInsight(
        domain=data.domain,
        insight_type=data.insight_type,
        title=data.title,
        content=data.content,
        priority=priority,
        expires_at=datetime.utcnow() + timedelta(hours=data.expires_hours) if data.expires_hours else None,
    )
    db.add(insight)
    await db.commit()
    await db.refresh(insight)

    logger.info(f"Manual insight created: {insight.title}")
    return {
        "id": insight.id,
        "title": insight.title,
        "status": "created",
    }


@router.put("/insights/{insight_id}/")
async def update_insight(
    insight_id: int,
    data: InsightUpdate,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing insight"""
    result = await db.execute(
        select(AiInsight).where(AiInsight.id == insight_id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    if data.title is not None:
        insight.title = data.title
    if data.content is not None:
        insight.content = data.content
    if data.priority is not None:
        try:
            insight.priority = InsightPriority(data.priority.lower())
        except ValueError:
            pass
    if data.is_read is not None:
        insight.is_read = data.is_read
    if data.is_dismissed is not None:
        insight.is_dismissed = data.is_dismissed

    await db.commit()
    logger.info(f"Insight updated: {insight.id}")
    return {"status": "updated", "id": insight.id}


@router.delete("/insights/{insight_id}/")
async def delete_insight(
    insight_id: int,
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete an insight"""
    from sqlalchemy import delete

    result = await db.execute(
        select(AiInsight).where(AiInsight.id == insight_id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")

    await db.execute(delete(AiInsight).where(AiInsight.id == insight_id))
    await db.commit()
    logger.info(f"Insight deleted: {insight_id}")
    return {"status": "deleted", "id": insight_id}


@router.post("/insights/regenerate/")
async def regenerate_insights(
    user: User = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
    insight_type: Optional[str] = Query(None, description="Type to regenerate: digest, fitness, garden, budget, or 'all'"),
):
    """Regenerate AI insights on demand"""
    from services.ai_insights import (
        generate_morning_digest,
        generate_weekly_fitness_review,
        generate_monthly_garden_review,
        generate_weekly_budget_review,
    )

    generated = []
    errors = []

    types_to_run = []
    if insight_type == "all" or insight_type is None:
        types_to_run = ["digest", "fitness", "garden", "budget"]
    else:
        types_to_run = [insight_type]

    for t in types_to_run:
        try:
            if t == "digest":
                await generate_morning_digest()
                generated.append("Morning Digest")
            elif t == "fitness":
                await generate_weekly_fitness_review()
                generated.append("Weekly Fitness Review")
            elif t == "garden":
                await generate_monthly_garden_review()
                generated.append("Monthly Garden Review")
            elif t == "budget":
                await generate_weekly_budget_review()
                generated.append("Weekly Budget Review")
            else:
                errors.append(f"Unknown type: {t}")
        except Exception as e:
            logger.error(f"Failed to regenerate {t}: {e}")
            errors.append(f"{t}: {str(e)}")

    return {
        "status": "completed",
        "generated": generated,
        "errors": errors if errors else None,
    }


@router.get("/insights/debug-context/")
async def debug_insight_context(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    """Show raw context data that would be used for AI insights.

    This helps diagnose data issues by showing exactly what the AI sees.
    """
    from services.ai_context import (
        gather_tasks_context,
        gather_weather_context,
        gather_animals_context,
        gather_garden_context,
    )
    from routers.settings import get_setting
    from datetime import datetime, date

    # Get shared domains
    shared_str = await get_setting(db, "ai_shared_domains")
    allowed = [d.strip().lower() for d in shared_str.split(",")] if shared_str else []

    # Gather context from each domain
    result = {
        "timestamp": datetime.now().isoformat(),
        "date_today": date.today().isoformat(),
        "shared_domains_setting": shared_str,
        "allowed_domains": allowed,
        "context": {}
    }

    if "tasks" in allowed:
        result["context"]["tasks"] = await gather_tasks_context(db)
    if "weather" in allowed:
        result["context"]["weather"] = await gather_weather_context(db)
    if "animals" in allowed:
        result["context"]["animals"] = await gather_animals_context(db)
    if "garden" in allowed:
        result["context"]["garden"] = await gather_garden_context(db)

    # Also show counts for validation
    from models.tasks import Task
    from sqlalchemy import select, func

    today = date.today()

    # Count pending tasks
    pending_result = await db.execute(
        select(func.count(Task.id))
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
    )
    result["task_counts"] = {
        "total_pending": pending_result.scalar(),
    }

    # Count overdue
    overdue_result = await db.execute(
        select(func.count(Task.id))
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .where(Task.due_date < today)
        .where(Task.due_date.isnot(None))
    )
    result["task_counts"]["overdue"] = overdue_result.scalar()

    # Count due today
    today_result = await db.execute(
        select(func.count(Task.id))
        .where(Task.is_active == True)
        .where(Task.is_completed == False)
        .where(Task.due_date == today)
    )
    result["task_counts"]["due_today"] = today_result.scalar()

    return result
