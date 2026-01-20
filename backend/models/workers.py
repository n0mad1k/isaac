"""
Worker Model
Represents external workers (maids, contractors, farm hands) who can be assigned tasks
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from datetime import datetime
from models.database import Base


class Worker(Base):
    __tablename__ = "workers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=True)  # "Maid", "Farm Hand", "Contractor", etc.
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    language = Column(String(10), default="en")  # "en", "es", etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
