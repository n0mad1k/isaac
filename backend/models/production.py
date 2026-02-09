"""
Farm Production Models
Tracks livestock processing records, plant harvests, orders, and allocations
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Date, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum

from .database import Base


class HarvestQuality(enum.Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class SaleCategory(enum.Enum):
    LIVESTOCK = "livestock"    # Live animal or meat sales
    PLANT = "plant"            # Nursery plant sales
    PRODUCE = "produce"        # Eggs, milk, harvest produce
    OTHER = "other"            # Miscellaneous farm sales


class OrderStatus(enum.Enum):
    RESERVED = "reserved"           # Customer has reserved, waiting for animal
    IN_PROGRESS = "in_progress"     # Animal at processor
    READY = "ready"                 # Ready for pickup/delivery
    COMPLETED = "completed"         # Delivered and fully paid
    CANCELLED = "cancelled"         # Order cancelled


class PaymentType(enum.Enum):
    DEPOSIT = "deposit"             # Initial deposit
    PARTIAL = "partial"             # Mid-order payment
    FINAL = "final"                 # Final payment
    REFUND = "refund"               # Refund to customer


class PaymentMethod(enum.Enum):
    CASH = "cash"
    CHECK = "check"
    VENMO = "venmo"
    ZELLE = "zelle"
    CARD = "card"
    OTHER = "other"


class AllocationType(enum.Enum):
    SALE = "sale"                   # Sold to customer
    PERSONAL = "personal"           # Kept for personal use
    GIFT = "gift"                   # Given away
    LOSS = "loss"                   # Spoiled/lost


class HarvestUseType(enum.Enum):
    SOLD = "sold"                   # Sold to customers
    CONSUMED = "consumed"           # Personal consumption
    GIFTED = "gifted"               # Given away
    PRESERVED = "preserved"         # Canned, frozen, etc.
    SPOILED = "spoiled"             # Lost to spoilage


class PortionType(enum.Enum):
    WHOLE = "whole"
    HALF = "half"
    QUARTER = "quarter"
    CUSTOM = "custom"


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

    # Relationships for allocations and orders
    allocations = relationship("ProductionAllocation", back_populates="livestock_production", cascade="all, delete-orphan", lazy="dynamic")
    orders = relationship("LivestockOrder", back_populates="livestock_production", lazy="dynamic")

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

    # Relationships
    plant = relationship("Plant", backref="harvests")
    allocations = relationship("HarvestAllocation", back_populates="harvest", cascade="all, delete-orphan", lazy="dynamic")

    def __repr__(self):
        return f"<PlantHarvest {self.quantity} {self.unit} of {self.plant_name}>"


class Sale(Base):
    """Records for farm product sales"""
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)

    # Sale details
    category = Column(Enum(SaleCategory), nullable=False)
    item_name = Column(String(200), nullable=False)  # "Beef - Ground", "Tomato Seedling", "Eggs"
    description = Column(Text)  # Optional notes

    # Quantity and pricing
    quantity = Column(Float, nullable=False)  # Amount sold
    unit = Column(String(50), default="each")  # lbs, dozen, each, gallon, flat, etc.
    unit_price = Column(Float, nullable=False)  # Price per unit
    total_price = Column(Float)  # Calculated: quantity * unit_price

    # Timing
    sale_date = Column(Date, nullable=False, default=date.today)

    # Optional entity links (for traceability)
    animal_id = Column(Integer, ForeignKey("animals.id", ondelete="SET NULL"), nullable=True)
    plant_id = Column(Integer, ForeignKey("plants.id", ondelete="SET NULL"), nullable=True)
    harvest_id = Column(Integer, ForeignKey("plant_harvests.id", ondelete="SET NULL"), nullable=True)
    livestock_production_id = Column(Integer, ForeignKey("livestock_productions.id", ondelete="SET NULL"), nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Customer info (for direct sales / receipts)
    customer_name = Column(String(200), nullable=True)
    customer_email = Column(String(200), nullable=True)

    # Customer relationship (optional)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)

    def __repr__(self):
        return f"<Sale {self.item_name} - ${self.total_price}>"


class Customer(Base):
    """Customer records for farm product sales"""
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200))
    phone = Column(String(50))
    address = Column(Text)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    orders = relationship("LivestockOrder", back_populates="customer", lazy="dynamic")
    sales = relationship("Sale", backref="customer", lazy="dynamic")

    def __repr__(self):
        return f"<Customer {self.name}>"


class LivestockOrder(Base):
    """Multi-payment livestock sales orders"""
    __tablename__ = "livestock_orders"

    id = Column(Integer, primary_key=True, index=True)

    # Customer info
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_name = Column(String(200))  # Denormalized for historical record

    # Livestock link
    livestock_production_id = Column(Integer, ForeignKey("livestock_productions.id", ondelete="SET NULL"), nullable=True)

    # Order details
    description = Column(Text)  # e.g., "1/2 Beef - Brody"
    portion_type = Column(Enum(PortionType), default=PortionType.WHOLE)
    portion_percentage = Column(Float, default=100.0)  # Custom percentage (e.g., 50 for half)

    # Weights
    estimated_weight = Column(Float)  # Expected weight in lbs
    actual_weight = Column(Float)     # Final weight from butcher

    # Pricing
    price_per_pound = Column(Float)
    estimated_total = Column(Float)   # Price * estimated_weight
    final_total = Column(Float)       # Price * actual_weight

    # Payment tracking
    total_paid = Column(Float, default=0.0)
    balance_due = Column(Float, default=0.0)

    # Status
    status = Column(Enum(OrderStatus), default=OrderStatus.RESERVED)

    # Dates
    order_date = Column(Date, default=date.today)
    expected_ready_date = Column(Date)
    completed_date = Column(Date)

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="orders")
    livestock_production = relationship("LivestockProduction", back_populates="orders")
    payments = relationship("OrderPayment", back_populates="order", cascade="all, delete-orphan", lazy="dynamic")
    scheduled_invoices = relationship("ScheduledInvoice", back_populates="order", cascade="all, delete-orphan", lazy="dynamic")

    def __repr__(self):
        return f"<LivestockOrder {self.id} - {self.customer_name} ({self.status.value})>"


class OrderPayment(Base):
    """Payment records for livestock orders"""
    __tablename__ = "order_payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("livestock_orders.id", ondelete="CASCADE"), nullable=False)

    payment_type = Column(Enum(PaymentType), nullable=False)
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.CASH)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date, default=date.today)
    reference = Column(String(200))  # Check number, Venmo ID, etc.
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    order = relationship("LivestockOrder", back_populates="payments")

    def __repr__(self):
        return f"<OrderPayment {self.payment_type.value} - ${self.amount}>"


class ScheduledInvoice(Base):
    """Scheduled invoice/payment reminder emails for orders"""
    __tablename__ = "scheduled_invoices"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("livestock_orders.id", ondelete="CASCADE"), nullable=False)

    # When to send
    scheduled_date = Column(Date, nullable=False)

    # What type of payment this is for
    payment_type = Column(Enum(PaymentType), default=PaymentType.PARTIAL)

    # Amount due for this scheduled payment
    amount_due = Column(Float, nullable=False)

    # Description/message to include
    description = Column(Text)  # e.g., "Feed switch payment due"

    # Tracking
    is_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    order = relationship("LivestockOrder", back_populates="scheduled_invoices")

    def __repr__(self):
        return f"<ScheduledInvoice {self.payment_type.value} - ${self.amount_due} on {self.scheduled_date}>"


class ProductionAllocation(Base):
    """How livestock production is allocated (sold, personal, gift, loss)"""
    __tablename__ = "production_allocations"

    id = Column(Integer, primary_key=True, index=True)
    livestock_production_id = Column(Integer, ForeignKey("livestock_productions.id", ondelete="CASCADE"), nullable=False)

    allocation_type = Column(Enum(AllocationType), nullable=False)
    percentage = Column(Float)           # Percentage of total
    weight = Column(Float)               # Weight in lbs
    allocated_cost = Column(Float)       # Calculated: total_cost * percentage

    # Optional link to order if sale type
    order_id = Column(Integer, ForeignKey("livestock_orders.id", ondelete="SET NULL"), nullable=True)

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    livestock_production = relationship("LivestockProduction", back_populates="allocations")
    order = relationship("LivestockOrder", backref="allocation")

    def __repr__(self):
        return f"<ProductionAllocation {self.allocation_type.value} - {self.percentage}%>"


class HarvestAllocation(Base):
    """How plant harvests are used (sold, consumed, gifted, preserved, spoiled)"""
    __tablename__ = "harvest_allocations"

    id = Column(Integer, primary_key=True, index=True)
    harvest_id = Column(Integer, ForeignKey("plant_harvests.id", ondelete="CASCADE"), nullable=False)

    use_type = Column(Enum(HarvestUseType), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String(50))  # Same unit as harvest

    # Optional link to sale if sold type
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="SET NULL"), nullable=True)

    notes = Column(Text)
    allocation_date = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    harvest = relationship("PlantHarvest", back_populates="allocations")
    sale = relationship("Sale", backref="harvest_allocations")

    def __repr__(self):
        return f"<HarvestAllocation {self.use_type.value} - {self.quantity}>"
