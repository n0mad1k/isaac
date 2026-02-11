"""
Worker Model
Represents external workers (maids, contractors, farm hands) who can be assigned tasks
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from models.database import Base


class VisitStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


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

    # Relationships
    standard_tasks = relationship("WorkerStandardTask", back_populates="worker", cascade="all, delete-orphan")
    visits = relationship("WorkerVisit", back_populates="worker", cascade="all, delete-orphan")


class WorkerStandardTask(Base):
    """
    Standard/recurring tasks for a worker that reset each visit.
    These are templates - actual tasks are copied to WorkerVisitTask when a visit starts.
    """
    __tablename__ = "worker_standard_tasks"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)  # Priority order (lower = do first)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    worker = relationship("Worker", back_populates="standard_tasks")


class WorkerVisit(Base):
    """
    Record of a worker's visit. Contains both standard tasks (copied from templates)
    and one-off tasks specific to this visit.
    """
    __tablename__ = "worker_visits"

    id = Column(Integer, primary_key=True, index=True)
    worker_id = Column(Integer, ForeignKey("workers.id", ondelete="CASCADE"), nullable=False)

    visit_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    status = Column(SQLEnum(VisitStatus), default=VisitStatus.IN_PROGRESS)
    notes = Column(Text, nullable=True)

    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    worker = relationship("Worker", back_populates="visits")
    tasks = relationship("WorkerVisitTask", back_populates="visit", cascade="all, delete-orphan")


class WorkerVisitTask(Base):
    """
    Individual task for a specific visit.
    Can be from a standard task template or a one-off task.
    """
    __tablename__ = "worker_visit_tasks"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("worker_visits.id", ondelete="CASCADE"), nullable=False)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)  # Priority order (lower = do first)

    is_standard = Column(Boolean, default=False)  # True if from standard task template
    standard_task_id = Column(Integer, nullable=True)  # Reference to template (for tracking)

    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    visit = relationship("WorkerVisit", back_populates="tasks")
