"""
Translation cache model for persistent translation storage
"""

from sqlalchemy import Column, Integer, String, DateTime, Index
from datetime import datetime

from .database import Base


class TranslationCache(Base):
    """Database model for persistent translation cache"""
    __tablename__ = "translation_cache"

    id = Column(Integer, primary_key=True)
    source_text = Column(String(500), nullable=False)
    target_lang = Column(String(10), nullable=False)
    translated_text = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Composite index for fast lookups
    __table_args__ = (
        Index('ix_translation_lookup', 'source_text', 'target_lang'),
    )
