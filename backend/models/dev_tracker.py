"""
Dev Tracker Models - For tracking QA testing and feature requests
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


class ItemType(enum.Enum):
    TEST = "test"           # Item to test from current release
    FEATURE = "feature"     # New feature request
    IMPROVEMENT = "improvement"  # Enhancement to existing feature
    BUG = "bug"            # Bug report


class ItemPriority(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ItemStatus(enum.Enum):
    PENDING = "pending"         # Not started
    IN_PROGRESS = "in_progress" # Being worked on
    TESTING = "testing"         # Ready for testing
    VERIFIED = "verified"       # Tested and confirmed working
    FAILED = "failed"           # Test failed, needs fix
    DONE = "done"               # Complete
    BACKLOG = "backlog"         # Deferred for later


class DevTrackerMetrics(Base):
    """Store daily metrics for historical tracking"""
    __tablename__ = "dev_tracker_metrics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, nullable=False, unique=True)  # Date of metrics

    # Counts for the day
    items_completed = Column(Integer, default=0)
    items_created = Column(Integer, default=0)
    items_failed = Column(Integer, default=0)

    # Running totals at end of day
    total_pending = Column(Integer, default=0)
    total_testing = Column(Integer, default=0)
    total_verified = Column(Integer, default=0)

    # Priority breakdown of completed items
    critical_completed = Column(Integer, default=0)
    high_completed = Column(Integer, default=0)
    medium_completed = Column(Integer, default=0)
    low_completed = Column(Integer, default=0)


class DevTrackerItem(Base):
    """Track QA items, feature requests, and bugs"""
    __tablename__ = "dev_tracker_items"

    id = Column(Integer, primary_key=True, index=True)

    # Type and classification
    item_type = Column(Enum(ItemType), default=ItemType.TEST)
    priority = Column(Enum(ItemPriority), default=ItemPriority.MEDIUM)
    status = Column(Enum(ItemStatus), default=ItemStatus.PENDING)

    # Content
    title = Column(Text, nullable=False)  # Allow long descriptions
    description = Column(Text)  # Detailed description or steps to test

    # For release tracking
    version = Column(String(20))  # e.g., "1.3.0"

    # Testing notes
    test_notes = Column(Text)  # Notes from testing

    # Failure tracking
    fail_note = Column(Text)  # Current failure reason (shown below title)
    fail_count = Column(Integer, default=0)  # Number of times failed
    fail_note_history = Column(Text)  # JSON array of past fail notes with timestamps

    # Collaboration flag - when True, Claude must work through this interactively with user
    requires_collab = Column(Boolean, default=False)  # Set when kicking back if needs step-by-step fixing

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Archive tracking (soft delete after 30 days)
    is_archived = Column(Boolean, default=False)
    archived_at = Column(DateTime, nullable=True)

    # Relationships
    images = relationship("DevTrackerImage", back_populates="item", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self):
        return f"<DevTrackerItem {self.item_type.value}: {self.title}>"


class DevTrackerImage(Base):
    """Images attached to dev tracker items"""
    __tablename__ = "dev_tracker_images"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("dev_tracker_items.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)  # Stored filename (UUID-based)
    original_name = Column(String(255))  # Original file name
    content_type = Column(String(100))  # MIME type
    file_size = Column(Integer)  # Size in bytes
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    item = relationship("DevTrackerItem", back_populates="images")

    def __repr__(self):
        return f"<DevTrackerImage {self.original_name} for item {self.item_id}>"
