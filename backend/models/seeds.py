"""
Seed Catalog Models
Track seed inventory with planting requirements
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Enum
from datetime import datetime
import enum

from .database import Base


class SeedCategory(enum.Enum):
    MEDICINAL = "medicinal"
    HERB = "herb"
    VEGETABLE = "vegetable"
    FRUIT = "fruit"
    FLOWER = "flower"
    NATIVE_FLORIDA = "native_florida"
    VINE = "vine"
    SHRUB = "shrub"
    TREE = "tree"
    OTHER = "other"


class SunRequirement(enum.Enum):
    FULL_SUN = "full_sun"
    PARTIAL_SUN = "partial_sun"
    PARTIAL_SHADE = "partial_shade"
    FULL_SHADE = "full_shade"


class WaterRequirement(enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class Seed(Base):
    __tablename__ = "seeds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    latin_name = Column(String(150))  # Scientific/botanical name
    variety = Column(String(100))
    category = Column(Enum(SeedCategory), default=SeedCategory.OTHER)

    # Inventory
    quantity = Column(String(50))  # e.g., "1 packet", "50 seeds", "1 oz"
    source = Column(String(200))  # Where purchased
    date_acquired = Column(DateTime)
    expiration_date = Column(DateTime)  # Seed viability

    # Planting Requirements
    days_to_germination = Column(String(50))  # e.g., "7-14 days"
    days_to_maturity = Column(String(50))  # e.g., "60-90 days"
    planting_depth = Column(String(50))  # e.g., "1/4 inch"
    spacing = Column(String(50))  # e.g., "12 inches"
    row_spacing = Column(String(50))  # e.g., "24 inches"
    optimal_germ_temp = Column(String(50))  # e.g., "70-85F"

    # Growing conditions
    sun_requirement = Column(Enum(SunRequirement), default=SunRequirement.FULL_SUN)
    light_to_germinate = Column(String(100))  # e.g., "Light required" or "Darkness needed"
    water_requirement = Column(Enum(WaterRequirement), default=WaterRequirement.MODERATE)
    soil_type = Column(String(100))  # e.g., "Well-drained, sandy loam"
    ph_range = Column(String(50))  # e.g., "6.0-7.0"
    grow_zones = Column(String(50))  # e.g., "8-11" or "4-9"

    # Florida Zone 9b specific
    spring_planting = Column(String(100))  # e.g., "Feb-Apr"
    fall_planting = Column(String(100))  # e.g., "Sep-Nov"
    sow_months = Column(String(100))  # e.g., "Jan-Mar, Sep-Nov"
    harvest_months = Column(String(100))  # e.g., "Apr-Jun, Nov-Dec"
    indoor_start = Column(String(100))  # e.g., "6 weeks before last frost"
    direct_sow = Column(Boolean, default=True)
    frost_sensitive = Column(Boolean, default=True)
    heat_tolerant = Column(Boolean, default=True)
    drought_tolerant = Column(Boolean, default=False)

    # Plant characteristics
    height = Column(String(50))  # e.g., "24-36 inches"
    spread = Column(String(50))  # e.g., "12-18 inches"
    is_perennial = Column(Boolean, default=False)
    is_native = Column(Boolean, default=False)
    attracts_pollinators = Column(Boolean, default=False)

    # Uses
    culinary_use = Column(Boolean, default=False)
    medicinal_use = Column(Boolean, default=False)
    ornamental_use = Column(Boolean, default=False)

    # Special planting requirements
    special_requirements = Column(String(200))  # e.g., "Scarification", "Cold stratification 30 days"

    # Description and Notes
    description = Column(Text)  # Detailed description of plant, uses, appearance
    growing_notes = Column(Text)
    harvest_notes = Column(Text)
    medicinal_notes = Column(Text)
    notes = Column(Text)

    # Photo
    photo_path = Column(String(255))

    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Seed {self.name}>"
