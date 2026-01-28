"""
Farm Expense Model
Standalone expense tracking for costs not tied to individual animals
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Date, Enum, Boolean
from datetime import datetime, date
import enum

from .database import Base


class ExpenseCategory(enum.Enum):
    FEED = "feed"
    VET = "vet"
    PROCESSING = "processing"
    SEEDS = "seeds"
    EQUIPMENT = "equipment"
    UTILITIES = "utilities"
    FUEL = "fuel"
    SUPPLIES = "supplies"
    LABOR = "labor"
    INSURANCE = "insurance"
    TAXES = "taxes"
    FENCING = "fencing"
    BEDDING = "bedding"
    OTHER = "other"


class ExpenseScope(enum.Enum):
    BUSINESS = "business"
    HOMESTEAD = "homestead"
    SHARED = "shared"


class FarmExpense(Base):
    """Standalone farm expenses not tied to individual animals"""
    __tablename__ = "farm_expenses"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(Enum(ExpenseCategory), nullable=False)
    scope = Column(Enum(ExpenseScope), nullable=False, default=ExpenseScope.BUSINESS)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False, default=date.today)
    description = Column(String(500), nullable=False)
    vendor = Column(String(200))
    notes = Column(Text)

    # For shared expenses: what % goes to business (rest goes to homestead)
    business_split_pct = Column(Float, default=100.0)  # 0-100, only used when scope=SHARED

    # Recurring expense tracking
    is_recurring = Column(Boolean, default=False)
    recurring_interval = Column(String(20))  # monthly, quarterly, annually

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<FarmExpense {self.category.value} - ${self.amount}>"
