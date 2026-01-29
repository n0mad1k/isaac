"""
Garden Planning Models
Planting events, journal entries, garden beds
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import Base


class PlantingEvent(Base):
    """User-created planting calendar events"""
    __tablename__ = "planting_events"

    id = Column(Integer, primary_key=True, index=True)
    seed_id = Column(Integer, ForeignKey("seeds.id"), nullable=False)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True)

    # Activity type: start_indoors, direct_sow, transplant, harvest, other
    activity_type = Column(String(30), nullable=False)

    # Schedule
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)

    # Succession planting
    succession_group_id = Column(String(50))  # Groups related succession plantings
    succession_number = Column(Integer)       # 1st, 2nd, 3rd in series
    succession_interval_weeks = Column(Integer)  # Weeks between plantings

    # Status
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime)

    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    seed = relationship("Seed", lazy="selectin")
    plant = relationship("Plant", lazy="selectin")

    def __repr__(self):
        return f"<PlantingEvent {self.activity_type} seed={self.seed_id} {self.start_date}>"
