"""
Supply Request Model
Allows workers to request supplies/items they need
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum
from datetime import datetime
import enum

from .database import Base


class RequestStatus(enum.Enum):
    PENDING = "pending"       # Waiting for review
    APPROVED = "approved"     # Approved, will be purchased
    PURCHASED = "purchased"   # Item has been bought
    DELIVERED = "delivered"   # Item delivered to worker
    DENIED = "denied"         # Request denied


class SupplyRequest(Base):
    """Supply requests from workers"""
    __tablename__ = "supply_requests"

    id = Column(Integer, primary_key=True, index=True)

    # Who requested it
    worker_id = Column(Integer, ForeignKey('workers.id'), nullable=False)

    # What they need
    item_name = Column(String(200), nullable=False)
    quantity = Column(Integer, default=1)
    notes = Column(Text, nullable=True)  # Additional details about the request

    # Status tracking
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)

    # Admin response
    admin_notes = Column(Text, nullable=True)  # Notes from admin (e.g., "ordered from Amazon")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<SupplyRequest {self.item_name} by worker {self.worker_id}>"
