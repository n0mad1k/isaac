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


class JournalEntry(Base):
    """Garden journal entries for tracking observations, notes, and progress"""
    __tablename__ = "garden_journal"

    id = Column(Integer, primary_key=True, index=True)
    entry_date = Column(Date, nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True)
    seed_id = Column(Integer, ForeignKey("seeds.id"), nullable=True)
    photo_path = Column(String(500))
    tags = Column(String(500))  # CSV string
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    plant = relationship("Plant", lazy="selectin")
    seed = relationship("Seed", lazy="selectin")

    def __repr__(self):
        return f"<JournalEntry {self.title} {self.entry_date}>"


class GardenBed(Base):
    """Garden bed layout and configuration"""
    __tablename__ = "garden_beds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    bed_type = Column(String(30), default="raised_bed")  # raised_bed, in_ground, container, row, greenhouse
    width_inches = Column(Integer, default=48)
    length_inches = Column(Integer, default=96)
    x_position = Column(Float, default=0)
    y_position = Column(Float, default=0)
    rotation = Column(Float, default=0)
    spacing_type = Column(String(20), default="square_foot")  # row, square_foot, custom
    row_spacing_inches = Column(Integer, default=12)
    plant_spacing_inches = Column(Integer, default=12)
    farm_area_id = Column(Integer, ForeignKey("farm_areas.id"), nullable=True)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    plantings = relationship("BedPlanting", back_populates="bed", lazy="selectin")

    def __repr__(self):
        return f"<GardenBed {self.name} ({self.bed_type})>"


class BedPlanting(Base):
    """Individual plant/seed placement within a garden bed"""
    __tablename__ = "bed_plantings"

    id = Column(Integer, primary_key=True, index=True)
    bed_id = Column(Integer, ForeignKey("garden_beds.id"), nullable=False)
    seed_id = Column(Integer, ForeignKey("seeds.id"), nullable=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True)
    grid_row = Column(Integer, default=0)
    grid_col = Column(Integer, default=0)
    planted_date = Column(Date)
    expected_harvest_date = Column(Date)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    bed = relationship("GardenBed", back_populates="plantings")
    seed = relationship("Seed", lazy="selectin")
    plant = relationship("Plant", lazy="selectin")

    def __repr__(self):
        return f"<BedPlanting bed={self.bed_id} row={self.grid_row} col={self.grid_col}>"
