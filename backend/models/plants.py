"""
Plant and Tree Models
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Table
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import enum

from .database import Base


# Association table for plant tags (many-to-many)
plant_tags = Table(
    'plant_tags',
    Base.metadata,
    Column('plant_id', Integer, ForeignKey('plants.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)


class Tag(Base):
    """Tags for categorizing plants (edible, medicinal, native, etc.)"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    color = Column(String(20), default="gray")  # For UI display

    plants = relationship("Plant", secondary=plant_tags, back_populates="tags")


class GrowthRate(enum.Enum):
    SLOW = "slow"
    MODERATE = "moderate"
    FAST = "fast"
    VERY_FAST = "very_fast"


class SunRequirement(enum.Enum):
    FULL_SUN = "full_sun"
    PARTIAL_SUN = "partial_sun"
    PARTIAL_SHADE = "partial_shade"
    FULL_SHADE = "full_shade"


class Plant(Base):
    __tablename__ = "plants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    latin_name = Column(String(150))  # Scientific name
    variety = Column(String(100))
    description = Column(Text)  # Informative description

    # Location
    location = Column(String(200))  # e.g., "North orchard, Row 3"
    latitude = Column(Float)
    longitude = Column(Float)
    farm_area_id = Column(Integer, ForeignKey("farm_areas.id"), nullable=True)

    # Planting info
    date_planted = Column(DateTime)
    date_acquired = Column(DateTime)
    source = Column(String(200))  # Where purchased/obtained

    # Growing requirements
    grow_zones = Column(String(50))  # e.g., "9-11"
    sun_requirement = Column(Enum(SunRequirement), default=SunRequirement.FULL_SUN)
    soil_requirements = Column(String(200))  # e.g., "Well-drained, acidic pH 5.5-6.5"
    plant_spacing = Column(String(100))  # e.g., "15-20 feet apart"

    # Size & Growth
    size_full_grown = Column(String(100))  # e.g., "20-30 ft tall, 15-20 ft spread"
    growth_rate = Column(Enum(GrowthRate), default=GrowthRate.MODERATE)

    # Cold tolerance
    min_temp = Column(Float)  # Minimum temperature plant can survive
    frost_sensitive = Column(Boolean, default=False)
    needs_cover_below_temp = Column(Float)  # Cover if temp drops below this

    # Heat/drought tolerance
    heat_tolerant = Column(Boolean, default=True)
    drought_tolerant = Column(Boolean, default=False)
    salt_tolerant = Column(Boolean, default=False)
    needs_shade_above_temp = Column(Float)  # Shade if temp goes above this

    # Watering schedule (seasonal - stored as JSON-like string)
    # Format: "summer:3,winter:10,spring:5,fall:7" (days between watering)
    water_schedule = Column(String(200))
    last_watered = Column(DateTime)

    # Fertilizing schedule (seasonal)
    # Format: "spring:30,summer:45,fall:60,winter:0" (days between, 0=none)
    fertilize_schedule = Column(String(200))
    last_fertilized = Column(DateTime)

    # Pruning
    prune_frequency = Column(String(100))  # e.g., "Yearly after fruiting"
    prune_months = Column(String(50))  # e.g., "Feb-Mar"
    last_pruned = Column(DateTime)

    # Production
    produces_months = Column(String(100))  # e.g., "Jun-Aug"
    harvest_frequency = Column(String(100))  # e.g., "Weekly during season"
    how_to_harvest = Column(Text)

    # Propagation & Uses
    uses = Column(Text)  # e.g., "Fresh eating, jams, baking"
    propagation_methods = Column(String(200))  # e.g., "Cuttings, grafting, seed"
    cultivation_details = Column(Text)  # Growing conditions, care tips, etc.

    # Warnings & Special considerations
    known_hazards = Column(Text)  # e.g., "Thorns, toxic to pets"
    special_considerations = Column(Text)  # e.g., "Needs hand pollination"

    # Status
    is_active = Column(Boolean, default=True)
    notes = Column(Text)
    references = Column(Text)  # Source URLs and bibliography

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    care_logs = relationship("PlantCareLog", back_populates="plant", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=plant_tags, back_populates="plants")
    farm_area = relationship("FarmArea", back_populates="plants")

    @property
    def age_years(self):
        """Calculate plant age in years"""
        if not self.date_planted:
            return None
        delta = datetime.utcnow() - self.date_planted
        return round(delta.days / 365.25, 1)

    def get_water_days_for_season(self, season=None):
        """Get watering frequency for current/specified season"""
        if not self.water_schedule:
            return 7  # Default
        if not season:
            month = datetime.utcnow().month
            if month in [12, 1, 2]:
                season = 'winter'
            elif month in [3, 4, 5]:
                season = 'spring'
            elif month in [6, 7, 8]:
                season = 'summer'
            else:
                season = 'fall'

        try:
            schedule = dict(item.split(':') for item in self.water_schedule.split(','))
            return int(schedule.get(season, 7))
        except:
            return 7

    def get_fertilize_days_for_season(self, season=None):
        """Get fertilizing frequency for current/specified season"""
        if not self.fertilize_schedule:
            return None
        if not season:
            month = datetime.utcnow().month
            if month in [12, 1, 2]:
                season = 'winter'
            elif month in [3, 4, 5]:
                season = 'spring'
            elif month in [6, 7, 8]:
                season = 'summer'
            else:
                season = 'fall'

        try:
            schedule = dict(item.split(':') for item in self.fertilize_schedule.split(','))
            days = int(schedule.get(season, 0))
            return days if days > 0 else None
        except:
            return None

    @property
    def next_watering(self):
        """Calculate next watering date"""
        if not self.last_watered:
            return None
        days = self.get_water_days_for_season()
        return self.last_watered + timedelta(days=days)

    @property
    def next_fertilizing(self):
        """Calculate next fertilizing date"""
        if not self.last_fertilized:
            return None
        days = self.get_fertilize_days_for_season()
        if not days:
            return None
        return self.last_fertilized + timedelta(days=days)

    def __repr__(self):
        return f"<Plant {self.name} ({self.variety})>"


class PlantCareLog(Base):
    __tablename__ = "plant_care_logs"

    id = Column(Integer, primary_key=True, index=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)

    care_type = Column(String(50), nullable=False)  # watered, fertilized, pruned, treated, harvested
    notes = Column(Text)
    quantity = Column(String(50))  # e.g., "2 gallons", "5 lbs harvested"

    performed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    plant = relationship("Plant", back_populates="care_logs")

    def __repr__(self):
        return f"<PlantCareLog {self.care_type} for plant {self.plant_id}>"
