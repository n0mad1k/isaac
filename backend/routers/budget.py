"""
Budget & Finance API Routes
Personal budget tracking with bi-weekly pay periods, statement import, and auto-categorization
"""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract, update, delete as delete_stmt
from typing import List, Optional
from datetime import date, datetime
from calendar import monthrange
from pydantic import BaseModel, Field, field_validator
import logging

from models.database import get_db
from models.budget import (
    BudgetAccount, BudgetCategory, BudgetTransaction, BudgetCategoryRule, BudgetIncome,
    BudgetPeriodSnapshot, AccountBucket,
    AccountType, CategoryType, TransactionType, TransactionSource, MatchType, IncomeFrequency
)
from models.users import User
from services.permissions import require_view, require_create, require_edit, require_delete
from services.statement_parser import parse_chase_statement, auto_categorize_transaction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budget", tags=["Budget"])


# ========================
# Pydantic Schemas
# ========================

# --- Account Schemas ---
class AccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    account_type: AccountType = AccountType.CHECKING
    institution: Optional[str] = Field(None, max_length=100)
    last_four: Optional[str] = Field(None, max_length=4, min_length=4)
    is_active: bool = True
    sort_order: int = 0
    initial_balance: Optional[float] = Field(0.0)
    balance_as_of: Optional[str] = Field(None, max_length=10)

class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    account_type: Optional[AccountType] = None
    institution: Optional[str] = Field(None, max_length=100)
    last_four: Optional[str] = Field(None, max_length=4, min_length=4)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    initial_balance: Optional[float] = None
    balance_as_of: Optional[str] = Field(None, max_length=10)

class AccountResponse(BaseModel):
    id: int
    name: str
    account_type: AccountType
    institution: Optional[str]
    last_four: Optional[str]
    is_active: bool
    sort_order: int
    initial_balance: Optional[float] = 0.0
    balance_as_of: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AccountWithBalanceResponse(BaseModel):
    id: int
    name: str
    account_type: AccountType
    institution: Optional[str]
    last_four: Optional[str]
    is_active: bool
    sort_order: int
    initial_balance: float
    balance_as_of: Optional[str]
    current_balance: float
    created_at: datetime

    class Config:
        from_attributes = True


# --- Bucket Schemas (pots of money within an account) ---
class BucketCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    balance: float = 0.0
    sort_order: int = 0

class BucketUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    balance: Optional[float] = None
    sort_order: Optional[int] = None

class BucketResponse(BaseModel):
    id: int
    account_id: int
    name: str
    balance: float
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True

class AllocationResponse(BaseModel):
    id: int
    name: str
    starting_balance: Optional[float]
    current_balance: float
    budget_amount: float

    class Config:
        from_attributes = True

class AccountDetailResponse(BaseModel):
    id: int
    name: str
    account_type: AccountType
    institution: Optional[str]
    last_four: Optional[str]
    is_active: bool
    sort_order: int
    initial_balance: float
    balance_as_of: Optional[str]
    current_balance: float
    budget_deposit_per_period: float
    allocations: List[AllocationResponse]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Category Schemas ---
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category_type: CategoryType = CategoryType.VARIABLE
    budget_amount: float = Field(0.0, ge=0)
    monthly_budget: Optional[float] = Field(None, ge=0)
    color: str = Field("#6B7280", max_length=20)
    icon: Optional[str] = Field(None, max_length=50)
    is_active: bool = True
    show_on_dashboard: bool = False
    bill_day: Optional[int] = Field(None, ge=1, le=31)
    owner: Optional[str] = Field(None, max_length=20)
    billing_months: Optional[str] = Field(None, max_length=50)
    account_id: Optional[int] = Field(None, ge=1)
    destination_account_id: Optional[int] = Field(None, ge=1)  # For transfers: destination spending account
    start_date: Optional[str] = Field(None, max_length=10)
    end_date: Optional[str] = Field(None, max_length=10)
    sort_order: int = 0

    @field_validator('owner', mode='before')
    @classmethod
    def normalize_owner(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category_type: Optional[CategoryType] = None
    budget_amount: Optional[float] = Field(None, ge=0)
    monthly_budget: Optional[float] = Field(None, ge=0)
    color: Optional[str] = Field(None, max_length=20)
    icon: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None
    show_on_dashboard: Optional[bool] = None
    bill_day: Optional[int] = Field(None, ge=1, le=31)
    owner: Optional[str] = Field(None, max_length=20)
    billing_months: Optional[str] = Field(None, max_length=50)
    account_id: Optional[int] = None
    destination_account_id: Optional[int] = None  # For transfers: destination spending account
    start_date: Optional[str] = Field(None, max_length=10)
    end_date: Optional[str] = Field(None, max_length=10)
    starting_balance: Optional[float] = None
    sort_order: Optional[int] = None

    @field_validator('owner', mode='before')
    @classmethod
    def normalize_owner(cls, v):
        if isinstance(v, str):
            return v.lower().strip()
        return v

class CategoryResponse(BaseModel):
    id: int
    name: str
    category_type: CategoryType
    budget_amount: float
    monthly_budget: Optional[float]
    color: str
    icon: Optional[str]
    is_active: bool
    show_on_dashboard: bool
    bill_day: Optional[int]
    owner: Optional[str]
    billing_months: Optional[str]
    account_id: Optional[int]
    destination_account_id: Optional[int]  # For transfers: destination spending account
    start_date: Optional[str]
    end_date: Optional[str]
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- Transaction Schemas ---
class TransactionCreate(BaseModel):
    account_id: int = Field(..., ge=1)
    category_id: Optional[int] = Field(None, ge=1)
    transaction_date: date
    description: str = Field(..., min_length=1, max_length=500)
    amount: float
    transaction_type: TransactionType = TransactionType.DEBIT
    is_pending: bool = False
    notes: Optional[str] = Field(None, max_length=5000)

class TransactionUpdate(BaseModel):
    account_id: Optional[int] = Field(None, ge=1)
    category_id: Optional[int] = None  # Allow setting to null
    transaction_date: Optional[date] = None
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    amount: Optional[float] = None
    transaction_type: Optional[TransactionType] = None
    is_pending: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=5000)

class TransactionResponse(BaseModel):
    id: int
    account_id: int
    account_name: Optional[str] = None
    category_id: Optional[int]
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    transaction_date: date
    description: str
    original_description: Optional[str]
    amount: float
    transaction_type: TransactionType
    is_pending: bool
    source: TransactionSource
    source_reference_id: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Rule Schemas ---
class RuleCreate(BaseModel):
    pattern: str = Field(..., min_length=1, max_length=200)
    match_type: MatchType = MatchType.CONTAINS
    category_id: int = Field(..., ge=1)
    priority: int = Field(0, ge=0, le=1000)
    is_active: bool = True

class RuleUpdate(BaseModel):
    pattern: Optional[str] = Field(None, min_length=1, max_length=200)
    match_type: Optional[MatchType] = None
    category_id: Optional[int] = Field(None, ge=1)
    priority: Optional[int] = Field(None, ge=0, le=1000)
    is_active: Optional[bool] = None

class RuleResponse(BaseModel):
    id: int
    pattern: str
    match_type: MatchType
    category_id: int
    category_name: Optional[str] = None
    priority: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Income Schemas ---
class IncomeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    amount: float = Field(..., gt=0)
    frequency: IncomeFrequency = IncomeFrequency.MONTHLY
    pay_day: int = Field(..., ge=0, le=31)
    account_id: int = Field(..., ge=1)
    is_active: bool = True

class IncomeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    amount: Optional[float] = Field(None, gt=0)
    frequency: Optional[IncomeFrequency] = None
    pay_day: Optional[int] = Field(None, ge=0, le=31)
    account_id: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None

class IncomeResponse(BaseModel):
    id: int
    name: str
    amount: float
    frequency: IncomeFrequency
    pay_day: int
    account_id: int
    account_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Import Schemas ---
class ImportPreviewTransaction(BaseModel):
    date: str
    description: str
    original_description: str
    amount: float
    transaction_type: str
    import_hash: str
    suggested_category_id: Optional[int] = None
    suggested_category_name: Optional[str] = None
    is_duplicate: bool = False

class ImportConfirmTransaction(BaseModel):
    date: str
    description: str
    original_description: str
    amount: float
    transaction_type: str
    import_hash: str
    category_id: Optional[int] = None
    account_id: int

class ImportConfirmRequest(BaseModel):
    transactions: List[ImportConfirmTransaction]


# ========================
# Account Endpoints
# ========================

@router.get("/accounts/", response_model=List[AccountResponse])
async def list_accounts(
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(BudgetAccount).order_by(BudgetAccount.sort_order, BudgetAccount.name)
        )
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error listing budget accounts: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/accounts/", response_model=AccountResponse)
async def create_account(
    data: AccountCreate,
    user: User = Depends(require_create("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        account = BudgetAccount(**data.model_dump())
        db.add(account)
        await db.flush()
        await db.refresh(account)
        return account
    except Exception as e:
        logger.error(f"Error creating budget account: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.put("/accounts/{account_id}/", response_model=AccountResponse)
async def update_account(
    account_id: int,
    data: AccountUpdate,
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetAccount).where(BudgetAccount.id == account_id))
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(account, key, value)
        await db.flush()
        await db.refresh(account)
        return account
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating budget account {account_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.delete("/accounts/{account_id}/")
async def delete_account(
    account_id: int,
    user: User = Depends(require_delete("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetAccount).where(BudgetAccount.id == account_id))
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        await db.delete(account)
        return {"message": "Account deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting budget account {account_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


async def _calculate_account_balance(account: BudgetAccount, db: AsyncSession) -> float:
    """Calculate current balance for an account based on initial_balance + transactions after balance_as_of"""
    initial = account.initial_balance or 0.0

    # Build query for transactions
    query = select(func.sum(BudgetTransaction.amount)).where(
        BudgetTransaction.account_id == account.id
    )

    # If balance_as_of is set, only sum transactions after that date
    if account.balance_as_of:
        try:
            as_of_date = date.fromisoformat(account.balance_as_of)
            query = query.where(BudgetTransaction.transaction_date > as_of_date)
        except ValueError:
            pass  # Invalid date format, sum all transactions

    result = await db.execute(query)
    txn_total = result.scalar() or 0.0

    return round(initial + txn_total, 2)


@router.get("/accounts/balances/")
async def list_accounts_with_balances(
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Get all accounts with their computed current balances"""
    try:
        result = await db.execute(
            select(BudgetAccount).order_by(BudgetAccount.sort_order, BudgetAccount.name)
        )
        accounts = result.scalars().all()

        response = []
        for account in accounts:
            current_balance = await _calculate_account_balance(account, db)
            response.append({
                "id": account.id,
                "name": account.name,
                "account_type": account.account_type.value if account.account_type else "checking",
                "institution": account.institution,
                "last_four": account.last_four,
                "is_active": account.is_active,
                "sort_order": account.sort_order,
                "initial_balance": account.initial_balance or 0.0,
                "balance_as_of": account.balance_as_of,
                "current_balance": current_balance,
                "created_at": account.created_at.isoformat() if account.created_at else None,
            })

        return response
    except Exception as e:
        logger.error(f"Error listing budget accounts with balances: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/accounts/{account_id}/detail/")
async def get_account_detail(
    account_id: int,
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Get account detail with current balance and buckets"""
    try:
        result = await db.execute(select(BudgetAccount).where(BudgetAccount.id == account_id))
        account = result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        current_balance = await _calculate_account_balance(account, db)

        # Get buckets for this account
        bucket_result = await db.execute(
            select(AccountBucket)
            .where(AccountBucket.account_id == account_id)
            .order_by(AccountBucket.sort_order, AccountBucket.name)
        )
        buckets = bucket_result.scalars().all()

        # Calculate total in buckets and unallocated
        total_in_buckets = sum(b.balance for b in buckets)
        unallocated = round(current_balance - total_in_buckets, 2)

        return {
            "id": account.id,
            "name": account.name,
            "account_type": account.account_type.value if account.account_type else "checking",
            "institution": account.institution,
            "last_four": account.last_four,
            "is_active": account.is_active,
            "sort_order": account.sort_order,
            "initial_balance": account.initial_balance or 0.0,
            "balance_as_of": account.balance_as_of,
            "current_balance": current_balance,
            "buckets": [
                {
                    "id": b.id,
                    "name": b.name,
                    "balance": b.balance,
                    "sort_order": b.sort_order,
                }
                for b in buckets
            ],
            "unallocated": unallocated,
            "created_at": account.created_at.isoformat() if account.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting account detail {account_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/accounts/{account_id}/transactions/")
async def get_account_transactions(
    account_id: int,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Get transactions for a specific account"""
    try:
        # Verify account exists
        acc_result = await db.execute(select(BudgetAccount).where(BudgetAccount.id == account_id))
        account = acc_result.scalar_one_or_none()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        query = select(BudgetTransaction).where(
            BudgetTransaction.account_id == account_id
        ).order_by(BudgetTransaction.transaction_date.desc(), BudgetTransaction.id.desc())

        if start_date:
            query = query.where(BudgetTransaction.transaction_date >= start_date)
        if end_date:
            query = query.where(BudgetTransaction.transaction_date <= end_date)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        transactions = result.scalars().all()

        # Build response with category info
        response_items = []
        for txn in transactions:
            item = {
                "id": txn.id,
                "account_id": txn.account_id,
                "account_name": account.name,
                "category_id": txn.category_id,
                "category_name": None,
                "category_color": None,
                "transaction_date": txn.transaction_date.isoformat(),
                "description": txn.description,
                "original_description": txn.original_description,
                "amount": txn.amount,
                "transaction_type": txn.transaction_type.value if txn.transaction_type else None,
                "is_pending": txn.is_pending,
                "source": txn.source.value if txn.source else None,
                "source_reference_id": txn.source_reference_id,
                "notes": txn.notes,
                "created_at": txn.created_at.isoformat() if txn.created_at else None,
            }

            # Fetch category info
            if txn.category_id:
                cat_result = await db.execute(
                    select(BudgetCategory.name, BudgetCategory.color)
                    .where(BudgetCategory.id == txn.category_id)
                )
                cat_row = cat_result.first()
                if cat_row:
                    item["category_name"] = cat_row[0]
                    item["category_color"] = cat_row[1]

            response_items.append(item)

        return {"items": response_items, "total": total}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting account transactions {account_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Category Endpoints
# ========================

@router.get("/categories/", response_model=List[CategoryResponse])
async def list_categories(
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(BudgetCategory).order_by(BudgetCategory.sort_order, BudgetCategory.name)
        )
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error listing budget categories: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/categories/", response_model=CategoryResponse)
async def create_category(
    data: CategoryCreate,
    user: User = Depends(require_create("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        category = BudgetCategory(**data.model_dump())
        db.add(category)
        await db.flush()
        await db.refresh(category)
        return category
    except Exception as e:
        logger.error(f"Error creating budget category: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.put("/categories/{category_id}/", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == category_id))
        category = result.scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(category, key, value)
        await db.flush()
        await db.refresh(category)
        return category
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating budget category {category_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.delete("/categories/{category_id}/")
async def delete_category(
    category_id: int,
    user: User = Depends(require_delete("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetCategory).where(BudgetCategory.id == category_id))
        category = result.scalar_one_or_none()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        # Null out category on related transactions
        await db.execute(
            update(BudgetTransaction).where(BudgetTransaction.category_id == category_id).values(category_id=None)
        )
        # Delete related rules
        await db.execute(
            delete_stmt(BudgetCategoryRule).where(BudgetCategoryRule.category_id == category_id)
        )
        await db.delete(category)
        return {"message": "Category deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting budget category {category_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Transaction Endpoints
# ========================

@router.get("/transactions/")
async def list_transactions(
    account_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    source: Optional[TransactionSource] = Query(None),
    search: Optional[str] = Query(None, max_length=200),
    uncategorized: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        query = select(BudgetTransaction).order_by(BudgetTransaction.transaction_date.desc(), BudgetTransaction.id.desc())

        if account_id:
            query = query.where(BudgetTransaction.account_id == account_id)
        if category_id:
            query = query.where(BudgetTransaction.category_id == category_id)
        if start_date:
            query = query.where(BudgetTransaction.transaction_date >= start_date)
        if end_date:
            query = query.where(BudgetTransaction.transaction_date <= end_date)
        if source:
            query = query.where(BudgetTransaction.source == source)
        if search:
            query = query.where(BudgetTransaction.description.ilike(f"%{search}%"))
        if uncategorized:
            query = query.where(BudgetTransaction.category_id.is_(None))

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()

        # Apply pagination
        query = query.limit(limit).offset(offset)
        result = await db.execute(query)
        transactions = result.scalars().all()

        # Build response with joined data
        response_items = []
        for txn in transactions:
            item = {
                "id": txn.id,
                "account_id": txn.account_id,
                "account_name": None,
                "category_id": txn.category_id,
                "category_name": None,
                "category_color": None,
                "transaction_date": txn.transaction_date.isoformat(),
                "description": txn.description,
                "original_description": txn.original_description,
                "amount": txn.amount,
                "transaction_type": txn.transaction_type.value if txn.transaction_type else None,
                "is_pending": txn.is_pending,
                "source": txn.source.value if txn.source else None,
                "source_reference_id": txn.source_reference_id,
                "notes": txn.notes,
                "created_at": txn.created_at.isoformat() if txn.created_at else None,
            }

            # Fetch account name
            if txn.account_id:
                acc_result = await db.execute(select(BudgetAccount.name).where(BudgetAccount.id == txn.account_id))
                acc_name = acc_result.scalar_one_or_none()
                item["account_name"] = acc_name

            # Fetch category info
            if txn.category_id:
                cat_result = await db.execute(
                    select(BudgetCategory.name, BudgetCategory.color)
                    .where(BudgetCategory.id == txn.category_id)
                )
                cat_row = cat_result.first()
                if cat_row:
                    item["category_name"] = cat_row[0]
                    item["category_color"] = cat_row[1]

            response_items.append(item)

        return {"items": response_items, "total": total}
    except Exception as e:
        logger.error(f"Error listing budget transactions: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/transactions/", response_model=TransactionResponse)
async def create_transaction(
    data: TransactionCreate,
    user: User = Depends(require_create("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        txn_date = data.transaction_date
        half = 1 if txn_date.day <= 14 else 2
        period_key = f"{txn_date.year}-{txn_date.month:02d}-{half}"

        txn = BudgetTransaction(
            account_id=data.account_id,
            category_id=data.category_id,
            transaction_date=txn_date,
            description=data.description,
            original_description=data.description,
            amount=data.amount,
            transaction_type=data.transaction_type,
            is_pending=data.is_pending,
            source=TransactionSource.MANUAL,
            notes=data.notes,
            period_key=period_key,
        )

        # Auto-categorize if no category provided
        if not txn.category_id:
            txn.category_id = await auto_categorize_transaction(txn.description, db)

        db.add(txn)
        await db.flush()
        await db.refresh(txn)

        # Build response with joined data
        response = TransactionResponse(
            id=txn.id,
            account_id=txn.account_id,
            category_id=txn.category_id,
            transaction_date=txn.transaction_date,
            description=txn.description,
            original_description=txn.original_description,
            amount=txn.amount,
            transaction_type=txn.transaction_type,
            is_pending=txn.is_pending,
            source=txn.source,
            source_reference_id=txn.source_reference_id,
            notes=txn.notes,
            created_at=txn.created_at,
        )

        # Fetch joined names
        if txn.account_id:
            acc_result = await db.execute(select(BudgetAccount.name).where(BudgetAccount.id == txn.account_id))
            response.account_name = acc_result.scalar_one_or_none()
        if txn.category_id:
            cat_result = await db.execute(
                select(BudgetCategory.name, BudgetCategory.color).where(BudgetCategory.id == txn.category_id)
            )
            cat_row = cat_result.first()
            if cat_row:
                response.category_name = cat_row[0]
                response.category_color = cat_row[1]

        return response
    except Exception as e:
        logger.error(f"Error creating budget transaction: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.put("/transactions/{transaction_id}/", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    data: TransactionUpdate,
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetTransaction).where(BudgetTransaction.id == transaction_id))
        txn = result.scalar_one_or_none()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(txn, key, value)

        await db.flush()
        await db.refresh(txn)

        response = TransactionResponse(
            id=txn.id,
            account_id=txn.account_id,
            category_id=txn.category_id,
            transaction_date=txn.transaction_date,
            description=txn.description,
            original_description=txn.original_description,
            amount=txn.amount,
            transaction_type=txn.transaction_type,
            is_pending=txn.is_pending,
            source=txn.source,
            source_reference_id=txn.source_reference_id,
            notes=txn.notes,
            created_at=txn.created_at,
        )

        if txn.account_id:
            acc_result = await db.execute(select(BudgetAccount.name).where(BudgetAccount.id == txn.account_id))
            response.account_name = acc_result.scalar_one_or_none()
        if txn.category_id:
            cat_result = await db.execute(
                select(BudgetCategory.name, BudgetCategory.color).where(BudgetCategory.id == txn.category_id)
            )
            cat_row = cat_result.first()
            if cat_row:
                response.category_name = cat_row[0]
                response.category_color = cat_row[1]

        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating budget transaction {transaction_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.delete("/transactions/{transaction_id}/")
async def delete_transaction(
    transaction_id: int,
    user: User = Depends(require_delete("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetTransaction).where(BudgetTransaction.id == transaction_id))
        txn = result.scalar_one_or_none()
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        await db.delete(txn)
        return {"message": "Transaction deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting budget transaction {transaction_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Category Rule Endpoints
# ========================

@router.get("/rules/")
async def list_rules(
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(BudgetCategoryRule).order_by(BudgetCategoryRule.priority.desc())
        )
        rules = result.scalars().all()

        response = []
        for rule in rules:
            item = {
                "id": rule.id,
                "pattern": rule.pattern,
                "match_type": rule.match_type.value if rule.match_type else None,
                "category_id": rule.category_id,
                "category_name": None,
                "priority": rule.priority,
                "is_active": rule.is_active,
                "created_at": rule.created_at.isoformat() if rule.created_at else None,
            }
            if rule.category_id:
                cat_result = await db.execute(
                    select(BudgetCategory.name).where(BudgetCategory.id == rule.category_id)
                )
                item["category_name"] = cat_result.scalar_one_or_none()
            response.append(item)

        return response
    except Exception as e:
        logger.error(f"Error listing budget rules: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/rules/")
async def create_rule(
    data: RuleCreate,
    user: User = Depends(require_create("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        rule = BudgetCategoryRule(**data.model_dump())
        db.add(rule)
        await db.flush()
        await db.refresh(rule)

        item = {
            "id": rule.id,
            "pattern": rule.pattern,
            "match_type": rule.match_type.value,
            "category_id": rule.category_id,
            "category_name": None,
            "priority": rule.priority,
            "is_active": rule.is_active,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
        }
        if rule.category_id:
            cat_result = await db.execute(
                select(BudgetCategory.name).where(BudgetCategory.id == rule.category_id)
            )
            item["category_name"] = cat_result.scalar_one_or_none()
        return item
    except Exception as e:
        logger.error(f"Error creating budget rule: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.put("/rules/{rule_id}/")
async def update_rule(
    rule_id: int,
    data: RuleUpdate,
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetCategoryRule).where(BudgetCategoryRule.id == rule_id))
        rule = result.scalar_one_or_none()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(rule, key, value)
        await db.flush()
        await db.refresh(rule)

        item = {
            "id": rule.id,
            "pattern": rule.pattern,
            "match_type": rule.match_type.value,
            "category_id": rule.category_id,
            "category_name": None,
            "priority": rule.priority,
            "is_active": rule.is_active,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
        }
        if rule.category_id:
            cat_result = await db.execute(
                select(BudgetCategory.name).where(BudgetCategory.id == rule.category_id)
            )
            item["category_name"] = cat_result.scalar_one_or_none()
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating budget rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.delete("/rules/{rule_id}/")
async def delete_rule(
    rule_id: int,
    user: User = Depends(require_delete("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetCategoryRule).where(BudgetCategoryRule.id == rule_id))
        rule = result.scalar_one_or_none()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        await db.delete(rule)
        return {"message": "Rule deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting budget rule {rule_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Income Endpoints
# ========================

@router.get("/income/")
async def list_income(
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(BudgetIncome).order_by(BudgetIncome.pay_day, BudgetIncome.name)
        )
        income_sources = result.scalars().all()

        response = []
        for inc in income_sources:
            freq = inc.frequency.value if inc.frequency else "monthly"
            item = {
                "id": inc.id,
                "name": inc.name,
                "amount": inc.amount,
                "frequency": freq,
                "pay_day": inc.pay_day,
                "account_id": inc.account_id,
                "account_name": None,
                "is_active": inc.is_active,
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
            }
            if inc.account_id:
                acc_result = await db.execute(
                    select(BudgetAccount.name).where(BudgetAccount.id == inc.account_id)
                )
                item["account_name"] = acc_result.scalar_one_or_none()
            response.append(item)

        return response
    except Exception as e:
        logger.error(f"Error listing budget income: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/income/")
async def create_income(
    data: IncomeCreate,
    user: User = Depends(require_create("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        income = BudgetIncome(**data.model_dump())
        db.add(income)
        await db.flush()
        await db.refresh(income)

        freq = income.frequency.value if income.frequency else "monthly"
        item = {
            "id": income.id,
            "name": income.name,
            "amount": income.amount,
            "frequency": freq,
            "pay_day": income.pay_day,
            "account_id": income.account_id,
            "account_name": None,
            "is_active": income.is_active,
            "created_at": income.created_at.isoformat() if income.created_at else None,
        }
        if income.account_id:
            acc_result = await db.execute(
                select(BudgetAccount.name).where(BudgetAccount.id == income.account_id)
            )
            item["account_name"] = acc_result.scalar_one_or_none()
        return item
    except Exception as e:
        logger.error(f"Error creating budget income: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.put("/income/{income_id}/")
async def update_income(
    income_id: int,
    data: IncomeUpdate,
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetIncome).where(BudgetIncome.id == income_id))
        income = result.scalar_one_or_none()
        if not income:
            raise HTTPException(status_code=404, detail="Income source not found")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(income, key, value)
        await db.flush()
        await db.refresh(income)

        freq = income.frequency.value if income.frequency else "monthly"
        item = {
            "id": income.id,
            "name": income.name,
            "amount": income.amount,
            "frequency": freq,
            "pay_day": income.pay_day,
            "account_id": income.account_id,
            "account_name": None,
            "is_active": income.is_active,
            "created_at": income.created_at.isoformat() if income.created_at else None,
        }
        if income.account_id:
            acc_result = await db.execute(
                select(BudgetAccount.name).where(BudgetAccount.id == income.account_id)
            )
            item["account_name"] = acc_result.scalar_one_or_none()
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating budget income {income_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.delete("/income/{income_id}/")
async def delete_income(
    income_id: int,
    user: User = Depends(require_delete("budget")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(select(BudgetIncome).where(BudgetIncome.id == income_id))
        income = result.scalar_one_or_none()
        if not income:
            raise HTTPException(status_code=404, detail="Income source not found")
        await db.delete(income)
        return {"message": "Income source deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting budget income {income_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Summary Endpoints
# ========================

def _count_weekday_in_range(start: date, end: date, weekday: int) -> int:
    """Count occurrences of a specific weekday (0=Mon..6=Sun) in a date range (inclusive)"""
    from datetime import timedelta
    count = 0
    # Jump to the first occurrence of the target weekday
    d = start
    days_ahead = weekday - d.weekday()
    if days_ahead < 0:
        days_ahead += 7
    d = d + timedelta(days=days_ahead)
    # Count from there, stepping by 7
    while d <= end:
        count += 1
        d += timedelta(days=7)
    return count


def _calc_expected_income(income_defs, start: date, end: date) -> float:
    """Calculate total expected income for a date range based on frequency"""
    expected = 0.0
    for inc in income_defs:
        freq = inc.frequency if hasattr(inc, 'frequency') and inc.frequency else IncomeFrequency.MONTHLY
        if freq == IncomeFrequency.WEEKLY:
            # pay_day = day of week (0=Mon..6=Sun), count occurrences
            occurrences = _count_weekday_in_range(start, end, inc.pay_day)
            expected += inc.amount * occurrences
        elif freq == IncomeFrequency.BIWEEKLY:
            # Approximate: count weekday occurrences, divide by 2, round
            occurrences = _count_weekday_in_range(start, end, inc.pay_day)
            expected += inc.amount * (occurrences // 2 + (1 if occurrences % 2 and occurrences > 0 else 0))
        elif freq == IncomeFrequency.SEMIMONTHLY:
            # Paid twice a month (1st and 15th)
            # One payment in first half (days 1-14), one in second half (days 15+)
            if start.day <= 14:
                expected += inc.amount
            if end.day >= 15:
                expected += inc.amount
        elif freq == IncomeFrequency.MONTHLY:
            # Paid once per month on pay_day
            if start.day <= inc.pay_day <= end.day:
                expected += inc.amount
    return expected


def _get_pay_periods(year: int, month: int) -> list:
    """Get pay period date ranges for a given month (1st-14th, 15th-end)"""
    last_day = monthrange(year, month)[1]
    return [
        {"start": date(year, month, 1), "end": date(year, month, 14), "label": f"1st - 14th"},
        {"start": date(year, month, 15), "end": date(year, month, last_day), "label": f"15th - {last_day}th"},
    ]


@router.get("/pay-periods/")
async def get_pay_periods(
    year: int = Query(..., ge=2020, le=2030),
    month: int = Query(..., ge=1, le=12),
    user: User = Depends(require_view("budget")),
):
    periods = _get_pay_periods(year, month)
    return [
        {"start": p["start"].isoformat(), "end": p["end"].isoformat(), "label": p["label"]}
        for p in periods
    ]


@router.get("/period-reference/")
async def get_period_reference(
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Get the current budget reference date for pay period calculation.
    Returns null if using today's date (default behavior)."""
    from models.settings import AppSetting

    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "budget_period_reference")
    )
    setting = result.scalar_one_or_none()

    if setting and setting.value:
        try:
            ref_date = date.fromisoformat(setting.value)
            # Determine which period this date falls in
            periods = _get_pay_periods(ref_date.year, ref_date.month)
            current_period = None
            for p in periods:
                if p["start"] <= ref_date <= p["end"]:
                    current_period = {
                        "start": p["start"].isoformat(),
                        "end": p["end"].isoformat(),
                        "label": p["label"]
                    }
                    break
            return {
                "reference_date": setting.value,
                "current_period": current_period,
                "is_override": True
            }
        except ValueError:
            pass

    # Default: use today
    today = date.today()
    periods = _get_pay_periods(today.year, today.month)
    current_period = None
    for p in periods:
        if p["start"] <= today <= p["end"]:
            current_period = {
                "start": p["start"].isoformat(),
                "end": p["end"].isoformat(),
                "label": p["label"]
            }
            break
    return {
        "reference_date": today.isoformat(),
        "current_period": current_period,
        "is_override": False
    }


@router.post("/advance-period/")
async def advance_period(
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Manually advance to the next pay period.
    This sets a reference date that overrides the current date for period calculations."""
    from models.settings import AppSetting

    # Get current reference date or use today
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "budget_period_reference")
    )
    setting = result.scalar_one_or_none()

    if setting and setting.value:
        try:
            ref_date = date.fromisoformat(setting.value)
        except ValueError:
            ref_date = date.today()
    else:
        ref_date = date.today()

    # Calculate next period start date
    if ref_date.day <= 14:
        # Currently in first half, advance to second half (15th)
        next_period_start = date(ref_date.year, ref_date.month, 15)
    else:
        # Currently in second half, advance to first half of next month
        if ref_date.month == 12:
            next_period_start = date(ref_date.year + 1, 1, 1)
        else:
            next_period_start = date(ref_date.year, ref_date.month + 1, 1)

    # Save the new reference date
    new_value = next_period_start.isoformat()
    if setting:
        setting.value = new_value
        setting.updated_at = datetime.utcnow()
    else:
        setting = AppSetting(
            key="budget_period_reference",
            value=new_value,
            description="Manual pay period reference date override"
        )
        db.add(setting)

    await db.commit()
    logger.info(f"Advanced budget period to {new_value}")

    # Return updated period info
    periods = _get_pay_periods(next_period_start.year, next_period_start.month)
    current_period = None
    for p in periods:
        if p["start"] <= next_period_start <= p["end"]:
            current_period = {
                "start": p["start"].isoformat(),
                "end": p["end"].isoformat(),
                "label": p["label"]
            }
            break

    return {
        "reference_date": new_value,
        "current_period": current_period,
        "is_override": True,
        "message": f"Advanced to {current_period['label'] if current_period else 'next period'}"
    }


@router.post("/reset-period/")
async def reset_period(
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Reset to using today's date for pay period calculation (remove override)."""
    from models.settings import AppSetting

    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "budget_period_reference")
    )
    setting = result.scalar_one_or_none()

    if setting:
        await db.delete(setting)
        await db.commit()
        logger.info("Reset budget period reference to today")

    today = date.today()
    periods = _get_pay_periods(today.year, today.month)
    current_period = None
    for p in periods:
        if p["start"] <= today <= p["end"]:
            current_period = {
                "start": p["start"].isoformat(),
                "end": p["end"].isoformat(),
                "label": p["label"]
            }
            break

    return {
        "reference_date": today.isoformat(),
        "current_period": current_period,
        "is_override": False,
        "message": "Reset to using today's date"
    }


@router.get("/summary/period/")
async def get_period_summary(
    start_date: date = Query(...),
    end_date: date = Query(...),
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Get spending summary by category for a date range with budget vs actual"""
    try:
        # Get all categories
        cat_result = await db.execute(
            select(BudgetCategory).where(BudgetCategory.is_active == True)
            .order_by(BudgetCategory.sort_order, BudgetCategory.name)
        )
        categories = cat_result.scalars().all()

        # Determine if this is a half-month or full-month period
        days_in_period = (end_date - start_date).days + 1
        is_full_month = days_in_period > 20
        is_first_half = start_date.day == 1 and not is_full_month
        is_second_half = start_date.day >= 15 and not is_full_month

        # Get spending by category for the period
        txn_result = await db.execute(
            select(
                BudgetTransaction.category_id,
                func.sum(BudgetTransaction.amount).label("total")
            )
            .where(
                BudgetTransaction.transaction_date >= start_date,
                BudgetTransaction.transaction_date <= end_date,
            )
            .group_by(BudgetTransaction.category_id)
        )
        spending_by_cat = {row[0]: row[1] for row in txn_result.all()}

        # Get total income for the period
        income_result = await db.execute(
            select(func.sum(BudgetTransaction.amount))
            .where(
                BudgetTransaction.transaction_date >= start_date,
                BudgetTransaction.transaction_date <= end_date,
                BudgetTransaction.amount > 0,
            )
        )
        total_income = income_result.scalar() or 0.0

        # Get total expenses for the period
        expense_result = await db.execute(
            select(func.sum(BudgetTransaction.amount))
            .where(
                BudgetTransaction.transaction_date >= start_date,
                BudgetTransaction.transaction_date <= end_date,
                BudgetTransaction.amount < 0,
            )
        )
        total_expenses = expense_result.scalar() or 0.0

        # Get uncategorized spending
        uncategorized_spent = spending_by_cat.get(None, 0.0)

        # Calculate accumulated rollover balance from completed months
        # Only tracks: Gas, Groceries, Main Spending
        # Reduced by any Roll Over category transactions (money moved elsewhere)
        # NOTE: The first month of tracking is the "setup" month and does NOT
        # contribute to rollover. Rollover starts accumulating from month 2+.
        rollover_balance = 0.0
        rollover_cats = {"Gas", "Groceries", "Main Spending"}
        try:
            # Find the first month with transactions
            first_txn = await db.execute(
                select(func.min(BudgetTransaction.transaction_date))
            )
            first_date = first_txn.scalar()

            if first_date:
                # Get rollover category IDs and Roll Over category ID
                rollover_cat_ids = [c.id for c in categories if c.name in rollover_cats]
                roll_over_cat = next((c for c in categories if c.name == "Roll Over"), None)

                # Skip the first month (setup month) — rollover starts from month 2
                first_month_start = date(first_date.year, first_date.month, 1)
                if first_month_start.month == 12:
                    rollover_start = date(first_month_start.year + 1, 1, 1)
                else:
                    rollover_start = date(first_month_start.year, first_month_start.month + 1, 1)
                current_month_start = date(start_date.year, start_date.month, 1)

                if rollover_start < current_month_start:
                    # Get total spent on rollover categories from rollover_start to current month
                    prev_spending_result = await db.execute(
                        select(
                            BudgetTransaction.category_id,
                            func.sum(BudgetTransaction.amount).label("total")
                        )
                        .where(
                            BudgetTransaction.transaction_date >= rollover_start,
                            BudgetTransaction.transaction_date < current_month_start,
                            BudgetTransaction.category_id.in_(rollover_cat_ids),
                        )
                        .group_by(BudgetTransaction.category_id)
                    )
                    prev_spending_map = {row[0]: row[1] for row in prev_spending_result.all()}

                    # Count completed months from rollover_start to current month
                    m_cursor = rollover_start
                    while m_cursor < current_month_start:
                        for cat in categories:
                            if cat.name not in rollover_cats:
                                continue
                            month_budget = cat.monthly_budget if cat.monthly_budget else (cat.budget_amount * 2)
                            rollover_balance += month_budget
                        if m_cursor.month == 12:
                            m_cursor = date(m_cursor.year + 1, 1, 1)
                        else:
                            m_cursor = date(m_cursor.year, m_cursor.month + 1, 1)

                    # Subtract actual spending on those categories
                    for cat_id, total_spent in prev_spending_map.items():
                        rollover_balance += total_spent  # total_spent is negative

                    # Subtract any Roll Over category transactions (money moved out)
                    if roll_over_cat:
                        ro_result = await db.execute(
                            select(func.sum(BudgetTransaction.amount))
                            .where(
                                BudgetTransaction.category_id == roll_over_cat.id,
                                BudgetTransaction.transaction_date >= rollover_start,
                                BudgetTransaction.transaction_date < current_month_start,
                            )
                        )
                        ro_spent = ro_result.scalar() or 0.0
                        rollover_balance += ro_spent  # negative spending reduces balance

                # If viewing the second half, also include the first half's surplus/deficit
                if is_second_half and rollover_cat_ids:
                    first_half_start = date(start_date.year, start_date.month, 1)
                    first_half_end = date(start_date.year, start_date.month, 14)

                    # Add per-period budget for rollover categories (first half)
                    for cat in categories:
                        if cat.name in rollover_cats:
                            rollover_balance += (cat.budget_amount or 0)

                    # Subtract first half spending on rollover categories
                    fh_result = await db.execute(
                        select(func.sum(BudgetTransaction.amount))
                        .where(
                            BudgetTransaction.transaction_date >= first_half_start,
                            BudgetTransaction.transaction_date <= first_half_end,
                            BudgetTransaction.category_id.in_(rollover_cat_ids),
                        )
                    )
                    fh_spent = fh_result.scalar() or 0.0
                    rollover_balance += fh_spent  # negative, reduces balance

                    # Subtract Roll Over transactions from first half
                    if roll_over_cat:
                        fh_ro_result = await db.execute(
                            select(func.sum(BudgetTransaction.amount))
                            .where(
                                BudgetTransaction.category_id == roll_over_cat.id,
                                BudgetTransaction.transaction_date >= first_half_start,
                                BudgetTransaction.transaction_date <= first_half_end,
                            )
                        )
                        fh_ro_spent = fh_ro_result.scalar() or 0.0
                        rollover_balance += fh_ro_spent

                rollover_balance = round(rollover_balance, 2)
        except Exception as e:
            logger.warning(f"Could not calculate rollover: {e}")

        # Calculate person spending account balances
        # Uses the linked spending ACCOUNT balance as source of truth
        # Available = Account Balance - Bills This Half
        person_spending_balances = {}
        try:
            for owner_key in ['dane', 'kelly']:
                transfer_cat = next(
                    (c for c in categories
                     if c.category_type == CategoryType.TRANSFER
                     and owner_key in c.name.lower()),
                    None
                )
                if not transfer_cat:
                    continue

                deposit_per_period = transfer_cat.budget_amount or 0.0

                # Get the linked spending account (via account_id on the category)
                linked_account = None
                if transfer_cat.account_id:
                    acct_result = await db.execute(
                        select(BudgetAccount).where(BudgetAccount.id == transfer_cat.account_id)
                    )
                    linked_account = acct_result.scalar_one_or_none()

                # Account balance is the source of truth
                account_balance = 0.0
                if linked_account:
                    account_balance = await _calculate_account_balance(linked_account, db)

                # Get person's owned bill categories
                owned_bills = [c for c in categories
                               if c.owner == owner_key
                               and c.id != transfer_cat.id]

                # Helper to calculate bills for a specific half-period
                def calc_half_bills(year, month, is_first_half):
                    total = 0.0
                    for bill in owned_bills:
                        if bill.billing_months:
                            active_months = [int(bm.strip()) for bm in bill.billing_months.split(',') if bm.strip()]
                            if month not in active_months:
                                continue
                        period_ym = f"{year}-{month:02d}"
                        if bill.start_date and period_ym < bill.start_date:
                            continue
                        if bill.end_date and period_ym > bill.end_date:
                            continue
                        if bill.bill_day is not None:
                            bill_in_first = (bill.bill_day <= 14)
                            if is_first_half == bill_in_first:
                                total += bill.monthly_budget if bill.monthly_budget else bill.budget_amount
                        else:
                            if bill.budget_amount and bill.budget_amount > 0:
                                total += bill.budget_amount
                    return total

                # Current month
                current_month = start_date.month
                current_year = start_date.year

                # Calculate bills for each half
                first_half_bills = calc_half_bills(current_year, current_month, True)
                second_half_bills = calc_half_bills(current_year, current_month, False)

                # Determine which half we're viewing
                if is_first_half:
                    this_half_bills = first_half_bills
                elif is_second_half:
                    this_half_bills = second_half_bills
                else:
                    this_half_bills = first_half_bills + second_half_bills

                # Available = Account Balance - Bills This Half
                available = account_balance - this_half_bills

                person_spending_balances[owner_key] = {
                    "available": round(available, 2),
                    "account_balance": round(account_balance, 2),
                    "this_half_bills": round(this_half_bills, 2),
                    "first_half_bills": round(first_half_bills, 2),
                    "second_half_bills": round(second_half_bills, 2),
                    "deposit_per_period": deposit_per_period,
                }
        except Exception as e:
            logger.warning(f"Could not calculate person spending balances: {e}")

        # Build category breakdown
        category_summary = []
        total_budgeted = 0.0
        current_ym = f"{start_date.year}-{start_date.month:02d}"

        for cat in categories:
            # Skip categories not active this month (billing_months filter)
            if cat.billing_months:
                active_months = [int(m.strip()) for m in cat.billing_months.split(',') if m.strip()]
                if start_date.month not in active_months:
                    continue

            # Skip categories outside their start_date/end_date range
            if cat.start_date and current_ym < cat.start_date:
                continue
            if cat.end_date and current_ym > cat.end_date:
                continue

            # For half-month periods with FIXED categories: only include if bill_day falls in that half
            # Per-period bills (no bill_day) show in both halves
            is_per_period = not cat.bill_day and cat.budget_amount and cat.budget_amount > 0
            if not is_full_month and cat.category_type == CategoryType.FIXED:
                if cat.bill_day:
                    if is_first_half and cat.bill_day > 14:
                        continue
                    if is_second_half and cat.bill_day < 15:
                        continue

            # Skip Roll Over from category summary - it's a separate metric
            if cat.name == "Roll Over":
                continue

            spent = spending_by_cat.get(cat.id, 0.0)

            # Budget amount logic:
            # - Full month: use monthly_budget, or budget_amount * 2
            # - Half month, variable/transfer: use budget_amount (per-period budget)
            # - Half month, fixed bills with bill_day: use monthly_budget (bills are paid once/month)
            # - Half month, per-period fixed bills (no bill_day): use budget_amount
            if is_full_month:
                if is_per_period and cat.category_type == CategoryType.FIXED:
                    budgeted = cat.budget_amount * 2
                else:
                    budgeted = cat.monthly_budget if cat.monthly_budget else (cat.budget_amount * 2)
            elif cat.category_type == CategoryType.FIXED:
                if is_per_period:
                    budgeted = cat.budget_amount
                else:
                    budgeted = cat.monthly_budget if cat.monthly_budget else (cat.budget_amount * 2)
            else:
                budgeted = cat.budget_amount

            total_budgeted += budgeted
            remaining = budgeted + spent  # spent is negative, so + gives remaining

            category_summary.append({
                "id": cat.id,
                "name": cat.name,
                "category_type": cat.category_type.value,
                "color": cat.color,
                "icon": cat.icon,
                "budgeted": round(budgeted, 2),
                "spent": round(abs(spent), 2),  # Return as positive for display
                "remaining": round(remaining, 2),
                "percentage": round((abs(spent) / budgeted * 100) if budgeted > 0 else 0, 1),
            })

        # Get expected income for the period
        income_query = select(BudgetIncome).where(BudgetIncome.is_active == True)
        income_defs = (await db.execute(income_query)).scalars().all()

        expected_income = _calc_expected_income(income_defs, start_date, end_date)

        return {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "categories": category_summary,
            "total_income": round(total_income, 2),
            "total_expenses": round(abs(total_expenses), 2),
            "total_budgeted": round(total_budgeted, 2),
            "net": round(total_income + total_expenses, 2),
            "expected_income": round(expected_income, 2),
            "uncategorized_spent": round(abs(uncategorized_spent), 2),
            "rollover_balance": rollover_balance,
            "person_spending_balances": person_spending_balances,
        }
    except Exception as e:
        logger.error(f"Error getting budget period summary: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/summary/monthly/")
async def get_monthly_summary(
    year: int = Query(..., ge=2020, le=2030),
    month: int = Query(..., ge=1, le=12),
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Full month summary combining both pay periods"""
    try:
        last_day = monthrange(year, month)[1]
        start = date(year, month, 1)
        end = date(year, month, last_day)

        # Reuse period summary logic for full month
        from starlette.datastructures import QueryParams
        return await get_period_summary(
            start_date=start,
            end_date=end,
            user=user,
            db=db,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting monthly budget summary: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/summary/dashboard/")
async def get_dashboard_summary(
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard widget data for current pay period"""
    from models.settings import AppSetting

    try:
        # Check for manual period reference override
        ref_result = await db.execute(
            select(AppSetting).where(AppSetting.key == "budget_period_reference")
        )
        ref_setting = ref_result.scalar_one_or_none()

        if ref_setting and ref_setting.value:
            try:
                ref_date = date.fromisoformat(ref_setting.value)
            except ValueError:
                ref_date = date.today()
        else:
            ref_date = date.today()

        year = ref_date.year
        month = ref_date.month
        periods = _get_pay_periods(year, month)

        # Find current pay period based on reference date
        current_period = periods[0]
        for period in periods:
            if period["start"] <= ref_date <= period["end"]:
                current_period = period
                break

        start = current_period["start"]
        end = current_period["end"]

        # Get categories marked for dashboard display
        cat_result = await db.execute(
            select(BudgetCategory).where(
                BudgetCategory.is_active == True,
                BudgetCategory.show_on_dashboard == True,
            )
            .order_by(BudgetCategory.sort_order, BudgetCategory.name)
        )
        categories = cat_result.scalars().all()

        txn_result = await db.execute(
            select(
                BudgetTransaction.category_id,
                func.sum(BudgetTransaction.amount).label("total")
            )
            .where(
                BudgetTransaction.transaction_date >= start,
                BudgetTransaction.transaction_date <= end,
                BudgetTransaction.amount < 0,
            )
            .group_by(BudgetTransaction.category_id)
        )
        spending_by_cat = {row[0]: abs(row[1]) for row in txn_result.all()}

        # Total expenses for the period
        total_expenses = sum(spending_by_cat.values())

        # Build category list from dashboard-enabled categories
        top_categories = []
        total_budgeted = 0.0
        for cat in categories:
            spent = spending_by_cat.get(cat.id, 0.0)
            budgeted = cat.budget_amount
            total_budgeted += budgeted

            top_categories.append({
                "id": cat.id,
                "name": cat.name,
                "color": cat.color,
                "budgeted": round(budgeted, 2),
                "spent": round(spent, 2),
                "percentage": round((spent / budgeted * 100) if budgeted > 0 else 0, 1),
            })

        # Get expected income for this period
        income_defs = (await db.execute(
            select(BudgetIncome).where(BudgetIncome.is_active == True)
        )).scalars().all()

        expected_income = _calc_expected_income(income_defs, start, end)

        return {
            "period_label": current_period["label"],
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "total_budgeted": round(total_budgeted, 2),
            "total_spent": round(total_expenses, 2),
            "total_remaining": round(total_budgeted - total_expenses, 2),
            "expected_income": round(expected_income, 2),
            "top_categories": top_categories,
        }
    except Exception as e:
        logger.error(f"Error getting budget dashboard summary: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Import Endpoints
# ========================

@router.post("/import/chase/")
async def import_chase_statement(
    file: UploadFile = File(...),
    account_id: int = Query(..., ge=1),
    statement_year: Optional[int] = Query(None, ge=2020, le=2030),
    user: User = Depends(require_create("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Upload and parse Chase PDF statement, return preview of transactions"""
    try:
        if not file.filename or not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")

        # Read PDF bytes (limit to 10MB)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")

        # Parse the statement
        parsed = parse_chase_statement(content, statement_year)

        if not parsed:
            raise HTTPException(status_code=400, detail="No transactions found in statement")

        # Check for duplicates and auto-categorize
        preview = []
        for txn in parsed:
            # Check for duplicate
            dup_result = await db.execute(
                select(BudgetTransaction.id)
                .where(BudgetTransaction.import_hash == txn["import_hash"])
            )
            is_dup = dup_result.scalar_one_or_none() is not None

            # Auto-categorize
            cat_id = await auto_categorize_transaction(txn["description"], db)
            cat_name = None
            if cat_id:
                cat_result = await db.execute(
                    select(BudgetCategory.name).where(BudgetCategory.id == cat_id)
                )
                cat_name = cat_result.scalar_one_or_none()

            preview.append({
                "date": txn["date"],
                "description": txn["description"],
                "original_description": txn["original_description"],
                "amount": txn["amount"],
                "transaction_type": txn["transaction_type"],
                "import_hash": txn["import_hash"],
                "suggested_category_id": cat_id,
                "suggested_category_name": cat_name,
                "is_duplicate": is_dup,
            })

        return {
            "account_id": account_id,
            "total_parsed": len(parsed),
            "duplicates": sum(1 for p in preview if p["is_duplicate"]),
            "categorized": sum(1 for p in preview if p["suggested_category_id"]),
            "transactions": preview,
        }
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Chase statement import validation error: {e}")
        raise HTTPException(status_code=400, detail="Invalid statement format")
    except Exception as e:
        logger.error(f"Error importing Chase statement: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/import/confirm/")
async def confirm_import(
    data: ImportConfirmRequest,
    user: User = Depends(require_create("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Confirm and save previewed transactions, skipping duplicates"""
    try:
        imported = 0
        skipped_dups = 0
        errors = 0

        for txn_data in data.transactions:
            # Check for duplicate
            dup_result = await db.execute(
                select(BudgetTransaction.id)
                .where(BudgetTransaction.import_hash == txn_data.import_hash)
            )
            if dup_result.scalar_one_or_none() is not None:
                skipped_dups += 1
                continue

            try:
                imp_date = date.fromisoformat(txn_data.date)
                imp_half = 1 if imp_date.day <= 14 else 2
                imp_period_key = f"{imp_date.year}-{imp_date.month:02d}-{imp_half}"

                txn = BudgetTransaction(
                    account_id=txn_data.account_id,
                    category_id=txn_data.category_id,
                    transaction_date=imp_date,
                    description=txn_data.description,
                    original_description=txn_data.original_description,
                    amount=txn_data.amount,
                    transaction_type=TransactionType(txn_data.transaction_type),
                    source=TransactionSource.CHASE_IMPORT,
                    import_hash=txn_data.import_hash,
                    period_key=imp_period_key,
                )
                db.add(txn)
                imported += 1
            except Exception as e:
                logger.warning(f"Error importing transaction: {e}")
                errors += 1

        await db.flush()

        return {
            "imported": imported,
            "skipped_duplicates": skipped_dups,
            "errors": errors,
        }
    except Exception as e:
        logger.error(f"Error confirming budget import: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Utility Endpoints
# ========================

@router.post("/categorize/")
async def run_auto_categorize(
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Run auto-categorization rules on all uncategorized transactions"""
    try:
        from services.statement_parser import auto_categorize_transactions

        # Get all uncategorized transaction IDs
        result = await db.execute(
            select(BudgetTransaction.id)
            .where(BudgetTransaction.category_id.is_(None))
        )
        txn_ids = [row[0] for row in result.all()]

        if not txn_ids:
            return {"categorized": 0, "total_uncategorized": 0}

        categorized = await auto_categorize_transactions(txn_ids, db)
        await db.flush()

        return {
            "categorized": categorized,
            "total_uncategorized": len(txn_ids),
            "remaining_uncategorized": len(txn_ids) - categorized,
        }
    except Exception as e:
        logger.error(f"Error running auto-categorize: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Spending Trends & Archival
# ========================

@router.get("/trends/")
async def get_spending_trends(
    months: int = Query(default=3, ge=1, le=12),
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Get spending trends by category across recent half-periods.
    Combines live transactions with archived period snapshots."""
    import json
    from dateutil.relativedelta import relativedelta

    try:
        today = date.today()
        cutoff = today - relativedelta(months=months)

        # Get live transaction data grouped by period and category
        live_result = await db.execute(
            select(
                BudgetCategory.name,
                func.sum(BudgetTransaction.amount),
                BudgetTransaction.period_key,
            )
            .join(BudgetCategory, BudgetTransaction.category_id == BudgetCategory.id)
            .where(
                BudgetTransaction.transaction_date >= cutoff,
                BudgetTransaction.amount < 0,
            )
            .group_by(BudgetCategory.name, BudgetTransaction.period_key)
        )
        live_data = live_result.fetchall()

        # Also get archived snapshots for periods that may have had transactions deleted
        snapshots_result = await db.execute(
            select(BudgetPeriodSnapshot)
            .where(BudgetPeriodSnapshot.start_date >= cutoff)
            .order_by(BudgetPeriodSnapshot.start_date)
        )
        snapshots = snapshots_result.scalars().all()

        # Build period -> category -> amount map
        # Live data takes priority, snapshots fill in gaps
        periods = {}

        # First, load snapshot data
        for snap in snapshots:
            if snap.category_spending:
                cat_data = json.loads(snap.category_spending)
                periods[snap.period_key] = {
                    "start_date": snap.start_date.isoformat(),
                    "end_date": snap.end_date.isoformat(),
                    "total_income": snap.total_income,
                    "total_expenses": snap.total_expenses,
                    "categories": cat_data,
                }

        # Then overlay live data (more current)
        for name, amount, period_key in live_data:
            if not period_key:
                continue
            if period_key not in periods:
                periods[period_key] = {"categories": {}, "total_income": 0, "total_expenses": 0}
            periods[period_key]["categories"][name] = round(abs(amount), 2)

        # Recalculate total_expenses from live category data
        for pk, pdata in periods.items():
            if "categories" in pdata:
                pdata["total_expenses"] = round(sum(pdata["categories"].values()), 2)

        # Sort by period key
        sorted_periods = dict(sorted(periods.items()))

        return {
            "months": months,
            "periods": sorted_periods,
        }
    except Exception as e:
        logger.error(f"Error getting spending trends: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.get("/snapshots/")
async def get_period_snapshots(
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Get all period snapshots for historical reference"""
    try:
        result = await db.execute(
            select(BudgetPeriodSnapshot).order_by(BudgetPeriodSnapshot.start_date.desc())
        )
        snapshots = result.scalars().all()
        return [
            {
                "period_key": s.period_key,
                "start_date": s.start_date.isoformat(),
                "end_date": s.end_date.isoformat(),
                "total_income": s.total_income,
                "total_expenses": s.total_expenses,
                "category_spending": s.category_spending,
                "person_balances": s.person_balances,
                "rollover_balance": s.rollover_balance,
            }
            for s in snapshots
        ]
    except Exception as e:
        logger.error(f"Error getting period snapshots: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


# ========================
# Bucket Endpoints (pots of money within accounts)
# ========================

@router.get("/accounts/{account_id}/buckets/", response_model=List[BucketResponse])
async def get_account_buckets(
    account_id: int,
    user: User = Depends(require_view("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Get all buckets for an account"""
    try:
        result = await db.execute(
            select(AccountBucket)
            .where(AccountBucket.account_id == account_id)
            .order_by(AccountBucket.sort_order, AccountBucket.name)
        )
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error getting buckets for account {account_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.post("/accounts/{account_id}/buckets/", response_model=BucketResponse)
async def create_bucket(
    account_id: int,
    data: BucketCreate,
    user: User = Depends(require_create("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new bucket within an account"""
    try:
        # Verify account exists
        result = await db.execute(select(BudgetAccount).where(BudgetAccount.id == account_id))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Account not found")

        bucket = AccountBucket(
            account_id=account_id,
            name=data.name.strip(),
            balance=data.balance,
            sort_order=data.sort_order,
        )
        db.add(bucket)
        await db.commit()
        await db.refresh(bucket)
        return bucket
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating bucket: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.put("/accounts/{account_id}/buckets/{bucket_id}/", response_model=BucketResponse)
async def update_bucket(
    account_id: int,
    bucket_id: int,
    data: BucketUpdate,
    user: User = Depends(require_edit("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Update a bucket"""
    try:
        result = await db.execute(
            select(AccountBucket).where(
                AccountBucket.id == bucket_id,
                AccountBucket.account_id == account_id
            )
        )
        bucket = result.scalar_one_or_none()
        if not bucket:
            raise HTTPException(status_code=404, detail="Bucket not found")

        if data.name is not None:
            bucket.name = data.name.strip()
        if data.balance is not None:
            bucket.balance = data.balance
        if data.sort_order is not None:
            bucket.sort_order = data.sort_order

        await db.commit()
        await db.refresh(bucket)
        return bucket
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating bucket {bucket_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")


@router.delete("/accounts/{account_id}/buckets/{bucket_id}/")
async def delete_bucket(
    account_id: int,
    bucket_id: int,
    user: User = Depends(require_delete("budget")),
    db: AsyncSession = Depends(get_db),
):
    """Delete a bucket"""
    try:
        result = await db.execute(
            select(AccountBucket).where(
                AccountBucket.id == bucket_id,
                AccountBucket.account_id == account_id
            )
        )
        bucket = result.scalar_one_or_none()
        if not bucket:
            raise HTTPException(status_code=404, detail="Bucket not found")

        await db.delete(bucket)
        await db.commit()
        return {"message": "Bucket deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting bucket {bucket_id}: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred")
