"""
Supply Request Model
Allows workers and team members to request supplies/items they need
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .database import Base


class RequestStatus(enum.Enum):
    PENDING = "pending"       # Waiting for review
    APPROVED = "approved"     # Approved, will be purchased
    PURCHASED = "purchased"   # Item has been bought
    DELIVERED = "delivered"   # Item delivered to worker/member
    DENIED = "denied"         # Request denied


class RequestPriority(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class SupplyRequest(Base):
    """Supply requests from workers or team members"""
    __tablename__ = "supply_requests"

    id = Column(Integer, primary_key=True, index=True)

    # Who requested it (one of these must be set)
    worker_id = Column(Integer, ForeignKey('workers.id'), nullable=True)
    member_id = Column(Integer, ForeignKey('team_members.id'), nullable=True)

    # What they need
    item_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)  # Detailed description
    category = Column(String(100), nullable=True)  # "Gear", "Medical", "Equipment", etc.
    quantity = Column(Integer, default=1)

    # Purchase info
    link = Column(Text, nullable=True)  # Product URL
    price = Column(Float, nullable=True)  # Unit price
    vendor = Column(String(200), nullable=True)  # Where to buy

    # Priority
    priority = Column(Enum(RequestPriority), default=RequestPriority.MEDIUM)
    reason = Column(Text, nullable=True)  # Why needed

    notes = Column(Text, nullable=True)  # Additional details about the request

    # Status tracking
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING)

    # Admin response
    admin_notes = Column(Text, nullable=True)  # Notes from admin (e.g., "ordered from Amazon")
    approved_by = Column(String(100), nullable=True)  # Who approved
    approved_date = Column(DateTime, nullable=True)
    ordered_date = Column(DateTime, nullable=True)
    delivered_date = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    member = relationship("TeamMember", back_populates="supply_requests", foreign_keys=[member_id])

    def __repr__(self):
        requester = f"worker {self.worker_id}" if self.worker_id else f"member {self.member_id}"
        return f"<SupplyRequest {self.item_name} by {requester}>"

    @property
    def total_price(self):
        """Calculate total price"""
        if self.price and self.quantity:
            return self.price * self.quantity
        return None
