"""
Farm Production Models
Tracks livestock processing records and plant harvests
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Date, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum

from .database import Base


class HarvestQuality(enum.Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class LivestockProduction(Base):
    """Records for processed/archived livestock animals"""
    __tablename__ = "livestock_productions"

    id = Column(Integer, primary_key=True, index=True)

    # Animal info (copied at archive time for historical record)
    animal_id = Column(Integer, nullable=True)  # Original animal ID (may be deleted)
    animal_name = Column(String(100), nullable=False)
    animal_type = Column(String(50), nullable=False)  # cattle, pig, chicken, etc.
    breed = Column(String(100))
    sex = Column(String(20))
    birth_date = Column(Date)

    # Processing info
    slaughter_date = Column(Date)
    processor = Column(String(200))  # Butcher/processor name
    pickup_date = Column(Date)

    # Weights (all in lbs)
    live_weight = Column(Float)  # Weight before slaughter
    hanging_weight = Column(Float)  # Carcass weight after slaughter
    final_weight = Column(Float)  # Packaged meat weight from butcher

    # Cost tracking
    total_expenses = Column(Float)  # Total expenses copied from animal
    processing_cost = Column(Float)  # Cost of processing/butchering

    # Calculated properties stored for quick access
    cost_per_pound = Column(Float)  # total_expenses / final_weight

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<LivestockProduction {self.animal_name} ({self.animal_type})>"


class PlantHarvest(Base):
    """Records for plant harvests"""
    __tablename__ = "plant_harvests"

    id = Column(Integer, primary_key=True, index=True)

    # Plant reference (keep FK for active plants)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True)

    # Plant info (copied for historical record if plant is deleted)
    plant_name = Column(String(100), nullable=False)
    plant_variety = Column(String(100))

    # Harvest details
    harvest_date = Column(Date, default=date.today)
    quantity = Column(Float, nullable=False)  # Amount harvested
    unit = Column(String(50), default="lbs")  # lbs, count, bunches, pints, quarts, etc.

    quality = Column(Enum(HarvestQuality), default=HarvestQuality.GOOD)

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    plant = relationship("Plant", backref="harvests")

    def __repr__(self):
        return f"<PlantHarvest {self.quantity} {self.unit} of {self.plant_name}>"
