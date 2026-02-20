"""
AI Chat and Insights Models
Supports Ollama-powered assistant conversations and proactive insights
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


class ChatConversation(Base):
    """A conversation thread with the AI assistant"""
    __tablename__ = "chat_conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=True)
    topic = Column(String(50), nullable=True)  # garden, fitness, budget, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")


class ChatMessage(Base):
    """A single message in a conversation"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    context_summary = Column(Text, nullable=True)  # what data was injected for this exchange
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("ChatConversation", back_populates="messages")


class InsightPriority(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AiInsight(Base):
    """Proactive AI-generated insights"""
    __tablename__ = "ai_insights"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(50), nullable=False)  # garden, fitness, budget, production, animals, weather, tasks
    insight_type = Column(String(50), nullable=False)  # suggestion, alert, analysis, digest
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    priority = Column(Enum(InsightPriority), default=InsightPriority.MEDIUM)
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    related_entity_type = Column(String(50), nullable=True)
    related_entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
