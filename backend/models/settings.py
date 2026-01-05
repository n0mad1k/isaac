"""
Application Settings Model
Stores runtime-configurable settings in the database
"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime

from .database import Base


class AppSetting(Base):
    """Key-value store for application settings"""
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<AppSetting {self.key}={self.value}>"
