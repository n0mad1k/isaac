"""
Farm Production API Routes
Tracks livestock processing and plant harvests
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel, Field

from models.database import get_db
from models.production import (
    LivestockProduction, PlantHarvest, HarvestQuality, Sale, SaleCategory,
    Customer, LivestockOrder, OrderPayment, ProductionAllocation, HarvestAllocation,
    OrderStatus, PaymentType, PaymentMethod, AllocationType, HarvestUseType, PortionType
)
from models.livestock import Animal, AnimalExpense
from models.plants import Plant


router = APIRouter(prefix="/production", tags=["Production"])


# Pydantic Schemas
class LivestockProductionCreate(BaseModel):
    animal_id: int = Field(..., ge=1)  # The animal to archive
    slaughter_date: Optional[date] = None
    processor: Optional[str] = Field(None, max_length=200)
    pickup_date: Optional[date] = None
    live_weight: Optional[float] = Field(None, ge=0, le=10000)
    hanging_weight: Optional[float] = Field(None, ge=0, le=10000)
    final_weight: Optional[float] = Field(None, ge=0, le=10000)
    processing_cost: Optional[float] = Field(None, ge=0, le=100000)
    notes: Optional[str] = Field(None, max_length=5000)


class LivestockProductionUpdate(BaseModel):
    slaughter_date: Optional[date] = None
    processor: Optional[str] = Field(None, max_length=200)
    pickup_date: Optional[date] = None
    live_weight: Optional[float] = Field(None, ge=0, le=10000)
    hanging_weight: Optional[float] = Field(None, ge=0, le=10000)
    final_weight: Optional[float] = Field(None, ge=0, le=10000)
    processing_cost: Optional[float] = Field(None, ge=0, le=100000)
    notes: Optional[str] = Field(None, max_length=5000)


class LivestockProductionResponse(BaseModel):
    id: int
    animal_id: Optional[int]
    animal_name: str
    animal_type: str
    breed: Optional[str]
    sex: Optional[str]
    birth_date: Optional[date]
    slaughter_date: Optional[date]
    processor: Optional[str]
    pickup_date: Optional[date]
    live_weight: Optional[float]
    hanging_weight: Optional[float]
    final_weight: Optional[float]
    total_expenses: Optional[float]
    processing_cost: Optional[float]
    cost_per_pound: Optional[float]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PlantHarvestCreate(BaseModel):
    plant_id: int = Field(..., ge=1)
    harvest_date: Optional[date] = None
    quantity: float = Field(..., ge=0, le=100000)
    unit: str = Field("lbs", min_length=1, max_length=20)
    quality: HarvestQuality = HarvestQuality.GOOD
    notes: Optional[str] = Field(None, max_length=2000)


class PlantHarvestUpdate(BaseModel):
    harvest_date: Optional[date] = None
    quantity: Optional[float] = Field(None, ge=0, le=100000)
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    quality: Optional[HarvestQuality] = None
    notes: Optional[str] = Field(None, max_length=2000)


class PlantHarvestResponse(BaseModel):
    id: int
    plant_id: Optional[int]
    plant_name: str
    plant_variety: Optional[str]
    harvest_date: Optional[date]
    quantity: float
    unit: str
    quality: HarvestQuality
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Sale Schemas
class SaleCreate(BaseModel):
    category: SaleCategory
    item_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    quantity: float = Field(..., ge=0, le=100000)
    unit: str = Field("each", min_length=1, max_length=50)
    unit_price: float = Field(..., ge=0, le=1000000)
    sale_date: Optional[date] = None
    animal_id: Optional[int] = None
    plant_id: Optional[int] = None
    harvest_id: Optional[int] = None
    livestock_production_id: Optional[int] = None


class SaleUpdate(BaseModel):
    category: Optional[SaleCategory] = None
    item_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    quantity: Optional[float] = Field(None, ge=0, le=100000)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    unit_price: Optional[float] = Field(None, ge=0, le=1000000)
    sale_date: Optional[date] = None
    animal_id: Optional[int] = None
    plant_id: Optional[int] = None
    harvest_id: Optional[int] = None
    livestock_production_id: Optional[int] = None


class SaleResponse(BaseModel):
    id: int
    category: SaleCategory
    item_name: str
    description: Optional[str]
    quantity: float
    unit: str
    unit_price: float
    total_price: Optional[float]
    sale_date: date
    animal_id: Optional[int]
    plant_id: Optional[int]
    harvest_id: Optional[int]
    livestock_production_id: Optional[int]
    customer_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Customer Schemas
class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=1000)
    notes: Optional[str] = Field(None, max_length=2000)
    is_active: bool = True


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=1000)
    notes: Optional[str] = Field(None, max_length=2000)
    is_active: Optional[bool] = None


class CustomerResponse(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# Order Schemas
class OrderPaymentCreate(BaseModel):
    payment_type: PaymentType
    payment_method: PaymentMethod = PaymentMethod.CASH
    amount: float = Field(..., ge=0)
    payment_date: Optional[date] = None
    reference: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = Field(None, max_length=1000)


class OrderPaymentResponse(BaseModel):
    id: int
    order_id: int
    payment_type: PaymentType
    payment_method: PaymentMethod
    amount: float
    payment_date: date
    reference: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LivestockOrderCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    livestock_production_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=2000)
    portion_type: PortionType = PortionType.WHOLE
    portion_percentage: float = Field(100.0, ge=0, le=100)
    estimated_weight: Optional[float] = Field(None, ge=0)
    actual_weight: Optional[float] = Field(None, ge=0)
    price_per_pound: Optional[float] = Field(None, ge=0)
    estimated_total: Optional[float] = Field(None, ge=0)
    final_total: Optional[float] = Field(None, ge=0)
    status: OrderStatus = OrderStatus.RESERVED
    order_date: Optional[date] = None
    expected_ready_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=2000)


class LivestockOrderUpdate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = Field(None, max_length=200)
    livestock_production_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=2000)
    portion_type: Optional[PortionType] = None
    portion_percentage: Optional[float] = Field(None, ge=0, le=100)
    estimated_weight: Optional[float] = Field(None, ge=0)
    actual_weight: Optional[float] = Field(None, ge=0)
    price_per_pound: Optional[float] = Field(None, ge=0)
    estimated_total: Optional[float] = Field(None, ge=0)
    final_total: Optional[float] = Field(None, ge=0)
    status: Optional[OrderStatus] = None
    expected_ready_date: Optional[date] = None
    completed_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=2000)


class LivestockOrderResponse(BaseModel):
    id: int
    customer_id: Optional[int]
    customer_name: Optional[str]
    livestock_production_id: Optional[int]
    description: Optional[str]
    portion_type: PortionType
    portion_percentage: float
    estimated_weight: Optional[float]
    actual_weight: Optional[float]
    price_per_pound: Optional[float]
    estimated_total: Optional[float]
    final_total: Optional[float]
    total_paid: float
    balance_due: float
    status: OrderStatus
    order_date: date
    expected_ready_date: Optional[date]
    completed_date: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    payments: Optional[List[OrderPaymentResponse]] = None

    class Config:
        from_attributes = True


# Allocation Schemas
class ProductionAllocationCreate(BaseModel):
    allocation_type: AllocationType
    percentage: Optional[float] = Field(None, ge=0, le=100)
    weight: Optional[float] = Field(None, ge=0)
    order_id: Optional[int] = None
    notes: Optional[str] = Field(None, max_length=1000)


class ProductionAllocationResponse(BaseModel):
    id: int
    livestock_production_id: int
    allocation_type: AllocationType
    percentage: Optional[float]
    weight: Optional[float]
    allocated_cost: Optional[float]
    order_id: Optional[int]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class HarvestAllocationCreate(BaseModel):
    use_type: HarvestUseType
    quantity: float = Field(..., ge=0)
    unit: Optional[str] = Field(None, max_length=50)
    sale_id: Optional[int] = None
    notes: Optional[str] = Field(None, max_length=1000)
    allocation_date: Optional[date] = None


class HarvestAllocationResponse(BaseModel):
    id: int
    harvest_id: int
    use_type: HarvestUseType
    quantity: float
    unit: Optional[str]
    sale_id: Optional[int]
    notes: Optional[str]
    allocation_date: date
    created_at: datetime

    class Config:
        from_attributes = True


# Routes

@router.get("/stats/")
async def get_production_stats(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get production statistics including sales and profit data"""
    # Livestock stats
    livestock_query = select(LivestockProduction)
    if year:
        livestock_query = livestock_query.where(
            extract('year', LivestockProduction.slaughter_date) == year
        )
    livestock_result = await db.execute(livestock_query)
    livestock = livestock_result.scalars().all()

    # Harvest stats
    harvest_query = select(PlantHarvest)
    if year:
        harvest_query = harvest_query.where(
            extract('year', PlantHarvest.harvest_date) == year
        )
    harvest_result = await db.execute(harvest_query)
    harvests = harvest_result.scalars().all()

    # Sales stats
    sales_query = select(Sale)
    if year:
        sales_query = sales_query.where(
            extract('year', Sale.sale_date) == year
        )
    sales_result = await db.execute(sales_query)
    sales = sales_result.scalars().all()

    # Calculate livestock stats
    total_meat = sum(p.final_weight or 0 for p in livestock)
    total_expenses = sum(p.total_expenses or 0 for p in livestock)
    total_processing = sum(p.processing_cost or 0 for p in livestock)

    # Group harvests by unit
    harvest_by_unit = {}
    for h in harvests:
        unit = h.unit or "unknown"
        harvest_by_unit[unit] = harvest_by_unit.get(unit, 0) + (h.quantity or 0)

    # Livestock by type
    livestock_by_type = {}
    for p in livestock:
        animal_type = p.animal_type
        if animal_type not in livestock_by_type:
            livestock_by_type[animal_type] = {"count": 0, "weight": 0}
        livestock_by_type[animal_type]["count"] += 1
        livestock_by_type[animal_type]["weight"] += p.final_weight or 0

    # Sales stats by category
    sales_by_category = {}
    total_revenue = 0
    for s in sales:
        cat = s.category.value if hasattr(s.category, 'value') else str(s.category)
        if cat not in sales_by_category:
            sales_by_category[cat] = {"count": 0, "revenue": 0}
        sales_by_category[cat]["count"] += 1
        sales_by_category[cat]["revenue"] += s.total_price or 0
        total_revenue += s.total_price or 0

    # Calculate profit (revenue - livestock expenses)
    livestock_costs = total_expenses + total_processing
    livestock_revenue = sales_by_category.get("livestock", {}).get("revenue", 0)
    livestock_profit = livestock_revenue - livestock_costs

    return {
        "livestock": {
            "total_processed": len(livestock),
            "total_meat_lbs": total_meat,
            "total_expenses": total_expenses,
            "total_processing_cost": total_processing,
            "avg_cost_per_pound": (total_expenses + total_processing) / total_meat if total_meat > 0 else None,
            "by_type": livestock_by_type,
        },
        "harvests": {
            "total_harvests": len(harvests),
            "by_unit": harvest_by_unit,
        },
        "sales": {
            "total_sales": len(sales),
            "total_revenue": total_revenue,
            "by_category": sales_by_category,
        },
        "profit": {
            "livestock": livestock_profit,
            "total_costs": livestock_costs,
            "total_revenue": total_revenue,
            "net": total_revenue - livestock_costs,
        },
        "year": year,
    }


@router.get("/livestock/", response_model=List[LivestockProductionResponse])
async def list_livestock_production(
    year: Optional[int] = None,
    animal_type: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all livestock production records"""
    query = select(LivestockProduction)

    if year:
        query = query.where(
            extract('year', LivestockProduction.slaughter_date) == year
        )
    if animal_type:
        query = query.where(LivestockProduction.animal_type == animal_type)

    query = query.order_by(LivestockProduction.slaughter_date.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/livestock/", response_model=LivestockProductionResponse)
async def archive_livestock(
    data: LivestockProductionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Archive a livestock animal and create production record"""
    # Get the animal
    result = await db.execute(select(Animal).where(Animal.id == data.animal_id))
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Calculate total expenses
    expenses_result = await db.execute(
        select(AnimalExpense).where(AnimalExpense.animal_id == animal.id)
    )
    expenses = expenses_result.scalars().all()
    total_expenses = sum(e.amount for e in expenses if e.amount)

    # Calculate cost per pound
    final_weight = data.final_weight
    total_cost = total_expenses + (data.processing_cost or 0)
    cost_per_pound = total_cost / final_weight if final_weight and final_weight > 0 else None

    # Create production record
    production = LivestockProduction(
        animal_id=animal.id,
        animal_name=animal.name,
        animal_type=animal.animal_type.value if hasattr(animal.animal_type, 'value') else str(animal.animal_type),
        breed=animal.breed,
        sex=animal.sex,
        birth_date=animal.birth_date,
        slaughter_date=data.slaughter_date or animal.slaughter_date,
        processor=data.processor or animal.processor,
        pickup_date=data.pickup_date or animal.pickup_date,
        live_weight=data.live_weight or animal.current_weight,
        hanging_weight=data.hanging_weight,
        final_weight=data.final_weight,
        total_expenses=total_expenses,
        processing_cost=data.processing_cost,
        cost_per_pound=cost_per_pound,
        notes=data.notes,
    )

    db.add(production)

    # Mark animal as inactive (archived) and update status
    animal.is_active = False
    animal.status = "slaughtered"

    await db.commit()
    await db.refresh(production)
    return production


@router.get("/livestock/{production_id}/", response_model=LivestockProductionResponse)
async def get_livestock_production(
    production_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific livestock production record"""
    result = await db.execute(
        select(LivestockProduction).where(LivestockProduction.id == production_id)
    )
    production = result.scalar_one_or_none()
    if not production:
        raise HTTPException(status_code=404, detail="Production record not found")
    return production


@router.patch("/livestock/{production_id}/", response_model=LivestockProductionResponse)
async def update_livestock_production(
    production_id: int,
    updates: LivestockProductionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a livestock production record"""
    result = await db.execute(
        select(LivestockProduction).where(LivestockProduction.id == production_id)
    )
    production = result.scalar_one_or_none()
    if not production:
        raise HTTPException(status_code=404, detail="Production record not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(production, field, value)

    # Recalculate cost per pound if weights/costs changed
    if production.final_weight and production.final_weight > 0:
        total_cost = (production.total_expenses or 0) + (production.processing_cost or 0)
        production.cost_per_pound = total_cost / production.final_weight

    await db.commit()
    await db.refresh(production)
    return production


@router.delete("/livestock/{production_id}/")
async def delete_livestock_production(
    production_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a livestock production record"""
    result = await db.execute(
        select(LivestockProduction).where(LivestockProduction.id == production_id)
    )
    production = result.scalar_one_or_none()
    if not production:
        raise HTTPException(status_code=404, detail="Production record not found")

    await db.delete(production)
    await db.commit()
    return {"message": "Production record deleted"}


# Plant Harvest Routes

@router.get("/harvests/", response_model=List[PlantHarvestResponse])
async def list_plant_harvests(
    year: Optional[int] = None,
    plant_id: Optional[int] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all plant harvest records"""
    query = select(PlantHarvest)

    if year:
        query = query.where(
            extract('year', PlantHarvest.harvest_date) == year
        )
    if plant_id:
        query = query.where(PlantHarvest.plant_id == plant_id)

    query = query.order_by(PlantHarvest.harvest_date.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/harvests/", response_model=PlantHarvestResponse)
async def record_plant_harvest(
    data: PlantHarvestCreate,
    db: AsyncSession = Depends(get_db),
):
    """Record a plant harvest"""
    # Get the plant
    result = await db.execute(select(Plant).where(Plant.id == data.plant_id))
    plant = result.scalar_one_or_none()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    # Create harvest record
    harvest = PlantHarvest(
        plant_id=plant.id,
        plant_name=plant.name,
        plant_variety=plant.variety,
        harvest_date=data.harvest_date or date.today(),
        quantity=data.quantity,
        unit=data.unit,
        quality=data.quality,
        notes=data.notes,
    )

    db.add(harvest)
    await db.commit()
    await db.refresh(harvest)
    return harvest


@router.get("/harvests/{harvest_id}/", response_model=PlantHarvestResponse)
async def get_plant_harvest(
    harvest_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific plant harvest record"""
    result = await db.execute(
        select(PlantHarvest).where(PlantHarvest.id == harvest_id)
    )
    harvest = result.scalar_one_or_none()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest record not found")
    return harvest


@router.patch("/harvests/{harvest_id}/", response_model=PlantHarvestResponse)
async def update_plant_harvest(
    harvest_id: int,
    updates: PlantHarvestUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a plant harvest record"""
    result = await db.execute(
        select(PlantHarvest).where(PlantHarvest.id == harvest_id)
    )
    harvest = result.scalar_one_or_none()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest record not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(harvest, field, value)

    await db.commit()
    await db.refresh(harvest)
    return harvest


@router.delete("/harvests/{harvest_id}/")
async def delete_plant_harvest(
    harvest_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a plant harvest record"""
    result = await db.execute(
        select(PlantHarvest).where(PlantHarvest.id == harvest_id)
    )
    harvest = result.scalar_one_or_none()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest record not found")

    await db.delete(harvest)
    await db.commit()
    return {"message": "Harvest record deleted"}


# Sales Routes

@router.get("/sales/", response_model=List[SaleResponse])
async def list_sales(
    year: Optional[int] = None,
    month: Optional[int] = None,
    category: Optional[SaleCategory] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all sales records"""
    query = select(Sale)

    if year:
        query = query.where(extract('year', Sale.sale_date) == year)
    if month:
        query = query.where(extract('month', Sale.sale_date) == month)
    if category:
        query = query.where(Sale.category == category)

    query = query.order_by(Sale.sale_date.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/sales/", response_model=SaleResponse)
async def create_sale(
    data: SaleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new sale record"""
    # Calculate total price
    total_price = data.quantity * data.unit_price

    sale = Sale(
        category=data.category,
        item_name=data.item_name,
        description=data.description,
        quantity=data.quantity,
        unit=data.unit,
        unit_price=data.unit_price,
        total_price=total_price,
        sale_date=data.sale_date or date.today(),
        animal_id=data.animal_id,
        plant_id=data.plant_id,
        harvest_id=data.harvest_id,
        livestock_production_id=data.livestock_production_id,
    )

    db.add(sale)
    await db.commit()
    await db.refresh(sale)
    return sale


@router.get("/sales/{sale_id}/", response_model=SaleResponse)
async def get_sale(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific sale record"""
    result = await db.execute(select(Sale).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale


@router.patch("/sales/{sale_id}/", response_model=SaleResponse)
async def update_sale(
    sale_id: int,
    updates: SaleUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a sale record"""
    result = await db.execute(select(Sale).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(sale, field, value)

    # Recalculate total price if quantity or unit_price changed
    sale.total_price = sale.quantity * sale.unit_price
    sale.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(sale)
    return sale


@router.delete("/sales/{sale_id}/")
async def delete_sale(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a sale record"""
    result = await db.execute(select(Sale).where(Sale.id == sale_id))
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    await db.delete(sale)
    await db.commit()
    return {"message": "Sale deleted"}


# ==================== Customer Routes ====================

@router.get("/customers/", response_model=List[CustomerResponse])
async def list_customers(
    active_only: bool = True,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all customers"""
    query = select(Customer)
    if active_only:
        query = query.where(Customer.is_active == True)
    query = query.order_by(Customer.name).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/customers/", response_model=CustomerResponse)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new customer"""
    customer = Customer(**data.model_dump())
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.get("/customers/{customer_id}/", response_model=CustomerResponse)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific customer"""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/customers/{customer_id}/", response_model=CustomerResponse)
async def update_customer(
    customer_id: int,
    updates: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a customer"""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)

    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/customers/{customer_id}/")
async def delete_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a customer (soft delete - marks as inactive)"""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.is_active = False
    await db.commit()
    return {"message": "Customer deactivated"}


# ==================== Livestock Order Routes ====================

@router.get("/orders/", response_model=List[LivestockOrderResponse])
async def list_orders(
    status: Optional[OrderStatus] = None,
    customer_id: Optional[int] = None,
    livestock_production_id: Optional[int] = None,
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List all livestock orders"""
    query = select(LivestockOrder)

    if status:
        query = query.where(LivestockOrder.status == status)
    if customer_id:
        query = query.where(LivestockOrder.customer_id == customer_id)
    if livestock_production_id:
        query = query.where(LivestockOrder.livestock_production_id == livestock_production_id)

    query = query.order_by(LivestockOrder.order_date.desc()).limit(limit)
    result = await db.execute(query)
    orders = result.scalars().all()

    # Load payments for each order
    response = []
    for order in orders:
        payments_result = await db.execute(
            select(OrderPayment).where(OrderPayment.order_id == order.id).order_by(OrderPayment.payment_date)
        )
        payments = payments_result.scalars().all()
        order_dict = {
            **{c.name: getattr(order, c.name) for c in order.__table__.columns},
            "payments": payments
        }
        response.append(LivestockOrderResponse(**order_dict))

    return response


@router.post("/orders/", response_model=LivestockOrderResponse)
async def create_order(
    data: LivestockOrderCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new livestock order"""
    # Get customer name if customer_id provided
    customer_name = data.customer_name
    if data.customer_id and not customer_name:
        result = await db.execute(select(Customer).where(Customer.id == data.customer_id))
        customer = result.scalar_one_or_none()
        if customer:
            customer_name = customer.name

    # Calculate totals
    estimated_total = data.estimated_total
    if data.estimated_weight and data.price_per_pound and not estimated_total:
        estimated_total = data.estimated_weight * data.price_per_pound

    final_total = data.final_total
    if data.actual_weight and data.price_per_pound and not final_total:
        final_total = data.actual_weight * data.price_per_pound

    order_data = data.model_dump()
    order_data["customer_name"] = customer_name
    order_data["estimated_total"] = estimated_total
    order_data["final_total"] = final_total
    order_data["order_date"] = data.order_date or date.today()
    order_data["balance_due"] = final_total or estimated_total or 0.0

    order = LivestockOrder(**order_data)
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return LivestockOrderResponse(**{c.name: getattr(order, c.name) for c in order.__table__.columns}, payments=[])


@router.get("/orders/{order_id}/", response_model=LivestockOrderResponse)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific order with payments"""
    result = await db.execute(select(LivestockOrder).where(LivestockOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payments_result = await db.execute(
        select(OrderPayment).where(OrderPayment.order_id == order.id).order_by(OrderPayment.payment_date)
    )
    payments = payments_result.scalars().all()

    return LivestockOrderResponse(
        **{c.name: getattr(order, c.name) for c in order.__table__.columns},
        payments=payments
    )


@router.patch("/orders/{order_id}/", response_model=LivestockOrderResponse)
async def update_order(
    order_id: int,
    updates: LivestockOrderUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a livestock order"""
    result = await db.execute(select(LivestockOrder).where(LivestockOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    update_data = updates.model_dump(exclude_unset=True)

    # Update customer name if customer_id changed
    if "customer_id" in update_data and update_data["customer_id"]:
        cust_result = await db.execute(select(Customer).where(Customer.id == update_data["customer_id"]))
        customer = cust_result.scalar_one_or_none()
        if customer:
            update_data["customer_name"] = customer.name

    for field, value in update_data.items():
        setattr(order, field, value)

    # Recalculate totals if weights/price changed
    if order.estimated_weight and order.price_per_pound:
        order.estimated_total = order.estimated_weight * order.price_per_pound
    if order.actual_weight and order.price_per_pound:
        order.final_total = order.actual_weight * order.price_per_pound

    # Recalculate balance
    total = order.final_total or order.estimated_total or 0.0
    order.balance_due = total - (order.total_paid or 0.0)

    await db.commit()
    await db.refresh(order)

    payments_result = await db.execute(
        select(OrderPayment).where(OrderPayment.order_id == order.id).order_by(OrderPayment.payment_date)
    )
    payments = payments_result.scalars().all()

    return LivestockOrderResponse(
        **{c.name: getattr(order, c.name) for c in order.__table__.columns},
        payments=payments
    )


@router.delete("/orders/{order_id}/")
async def delete_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a livestock order"""
    result = await db.execute(select(LivestockOrder).where(LivestockOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await db.delete(order)
    await db.commit()
    return {"message": "Order deleted"}


# ==================== Order Payment Routes ====================

@router.post("/orders/{order_id}/payments/", response_model=OrderPaymentResponse)
async def add_payment(
    order_id: int,
    data: OrderPaymentCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a payment to an order"""
    result = await db.execute(select(LivestockOrder).where(LivestockOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = OrderPayment(
        order_id=order_id,
        payment_type=data.payment_type,
        payment_method=data.payment_method,
        amount=data.amount,
        payment_date=data.payment_date or date.today(),
        reference=data.reference,
        notes=data.notes
    )
    db.add(payment)

    # Update order totals
    if data.payment_type == PaymentType.REFUND:
        order.total_paid -= data.amount
    else:
        order.total_paid += data.amount

    total = order.final_total or order.estimated_total or 0.0
    order.balance_due = total - order.total_paid

    await db.commit()
    await db.refresh(payment)
    return payment


@router.delete("/orders/{order_id}/payments/{payment_id}/")
async def delete_payment(
    order_id: int,
    payment_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a payment from an order"""
    result = await db.execute(
        select(OrderPayment).where(OrderPayment.id == payment_id, OrderPayment.order_id == order_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    order_result = await db.execute(select(LivestockOrder).where(LivestockOrder.id == order_id))
    order = order_result.scalar_one_or_none()

    # Reverse the payment
    if payment.payment_type == PaymentType.REFUND:
        order.total_paid += payment.amount
    else:
        order.total_paid -= payment.amount

    total = order.final_total or order.estimated_total or 0.0
    order.balance_due = total - order.total_paid

    await db.delete(payment)
    await db.commit()
    return {"message": "Payment deleted"}


@router.post("/orders/{order_id}/complete/")
async def complete_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Mark an order as completed"""
    result = await db.execute(select(LivestockOrder).where(LivestockOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = OrderStatus.COMPLETED
    order.completed_date = date.today()
    await db.commit()
    return {"message": "Order completed"}


# ==================== Production Allocation Routes ====================

@router.get("/livestock/{production_id}/allocations/", response_model=List[ProductionAllocationResponse])
async def list_livestock_allocations(
    production_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List allocations for a livestock production record"""
    result = await db.execute(
        select(ProductionAllocation).where(ProductionAllocation.livestock_production_id == production_id)
    )
    return result.scalars().all()


@router.post("/livestock/{production_id}/allocations/", response_model=ProductionAllocationResponse)
async def create_livestock_allocation(
    production_id: int,
    data: ProductionAllocationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an allocation for livestock production"""
    # Verify production exists
    prod_result = await db.execute(
        select(LivestockProduction).where(LivestockProduction.id == production_id)
    )
    production = prod_result.scalar_one_or_none()
    if not production:
        raise HTTPException(status_code=404, detail="Livestock production not found")

    # Calculate allocated cost if possible
    allocated_cost = None
    if data.percentage and production.cost_per_pound and production.final_weight:
        total_cost = production.cost_per_pound * production.final_weight
        allocated_cost = total_cost * (data.percentage / 100.0)

    # Calculate weight from percentage if not provided
    weight = data.weight
    if not weight and data.percentage and production.final_weight:
        weight = production.final_weight * (data.percentage / 100.0)

    allocation = ProductionAllocation(
        livestock_production_id=production_id,
        allocation_type=data.allocation_type,
        percentage=data.percentage,
        weight=weight,
        allocated_cost=allocated_cost,
        order_id=data.order_id,
        notes=data.notes
    )
    db.add(allocation)
    await db.commit()
    await db.refresh(allocation)
    return allocation


@router.delete("/allocations/{allocation_id}/")
async def delete_allocation(
    allocation_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a production allocation"""
    result = await db.execute(
        select(ProductionAllocation).where(ProductionAllocation.id == allocation_id)
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    await db.delete(allocation)
    await db.commit()
    return {"message": "Allocation deleted"}


@router.post("/livestock/{production_id}/allocate-personal/", response_model=ProductionAllocationResponse)
async def allocate_personal(
    production_id: int,
    percentage: float = Query(..., ge=0, le=100),
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Quick allocation for personal use"""
    prod_result = await db.execute(
        select(LivestockProduction).where(LivestockProduction.id == production_id)
    )
    production = prod_result.scalar_one_or_none()
    if not production:
        raise HTTPException(status_code=404, detail="Livestock production not found")

    # Calculate values
    weight = production.final_weight * (percentage / 100.0) if production.final_weight else None
    allocated_cost = None
    if production.cost_per_pound and weight:
        allocated_cost = production.cost_per_pound * weight

    allocation = ProductionAllocation(
        livestock_production_id=production_id,
        allocation_type=AllocationType.PERSONAL,
        percentage=percentage,
        weight=weight,
        allocated_cost=allocated_cost,
        notes=notes
    )
    db.add(allocation)
    await db.commit()
    await db.refresh(allocation)
    return allocation


# ==================== Harvest Allocation Routes ====================

@router.get("/harvests/{harvest_id}/allocations/", response_model=List[HarvestAllocationResponse])
async def list_harvest_allocations(
    harvest_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List allocations for a plant harvest"""
    result = await db.execute(
        select(HarvestAllocation).where(HarvestAllocation.harvest_id == harvest_id)
    )
    return result.scalars().all()


@router.post("/harvests/{harvest_id}/allocations/", response_model=HarvestAllocationResponse)
async def create_harvest_allocation(
    harvest_id: int,
    data: HarvestAllocationCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an allocation for a plant harvest"""
    # Verify harvest exists
    harvest_result = await db.execute(
        select(PlantHarvest).where(PlantHarvest.id == harvest_id)
    )
    harvest = harvest_result.scalar_one_or_none()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")

    allocation = HarvestAllocation(
        harvest_id=harvest_id,
        use_type=data.use_type,
        quantity=data.quantity,
        unit=data.unit or harvest.unit,
        sale_id=data.sale_id,
        notes=data.notes,
        allocation_date=data.allocation_date or date.today()
    )
    db.add(allocation)
    await db.commit()
    await db.refresh(allocation)
    return allocation


@router.delete("/harvest-allocations/{allocation_id}/")
async def delete_harvest_allocation(
    allocation_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a harvest allocation"""
    result = await db.execute(
        select(HarvestAllocation).where(HarvestAllocation.id == allocation_id)
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    await db.delete(allocation)
    await db.commit()
    return {"message": "Allocation deleted"}


@router.post("/harvests/{harvest_id}/allocate-consumed/", response_model=HarvestAllocationResponse)
async def allocate_consumed(
    harvest_id: int,
    quantity: float = Query(..., ge=0),
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Quick allocation for personal consumption"""
    harvest_result = await db.execute(
        select(PlantHarvest).where(PlantHarvest.id == harvest_id)
    )
    harvest = harvest_result.scalar_one_or_none()
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")

    allocation = HarvestAllocation(
        harvest_id=harvest_id,
        use_type=HarvestUseType.CONSUMED,
        quantity=quantity,
        unit=harvest.unit,
        notes=notes,
        allocation_date=date.today()
    )
    db.add(allocation)
    await db.commit()
    await db.refresh(allocation)
    return allocation


# ==================== Financial Summary Routes ====================

@router.get("/financial-summary/")
async def get_financial_summary(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive financial summary"""
    # Get all livestock productions
    livestock_query = select(LivestockProduction)
    if year:
        livestock_query = livestock_query.where(
            extract('year', LivestockProduction.slaughter_date) == year
        )
    livestock_result = await db.execute(livestock_query)
    livestock = livestock_result.scalars().all()

    # Get all orders
    orders_query = select(LivestockOrder)
    if year:
        orders_query = orders_query.where(extract('year', LivestockOrder.order_date) == year)
    orders_result = await db.execute(orders_query)
    orders = orders_result.scalars().all()

    # Get all sales
    sales_query = select(Sale)
    if year:
        sales_query = sales_query.where(extract('year', Sale.sale_date) == year)
    sales_result = await db.execute(sales_query)
    sales = sales_result.scalars().all()

    # Get all allocations
    allocations_query = select(ProductionAllocation)
    allocations_result = await db.execute(allocations_query)
    allocations = allocations_result.scalars().all()

    # Get all harvest allocations
    harvest_alloc_query = select(HarvestAllocation)
    if year:
        harvest_alloc_query = harvest_alloc_query.join(PlantHarvest).where(
            extract('year', PlantHarvest.harvest_date) == year
        )
    harvest_alloc_result = await db.execute(harvest_alloc_query)
    harvest_allocations = harvest_alloc_result.scalars().all()

    # Get harvest count for year
    harvest_count_query = select(PlantHarvest)
    if year:
        harvest_count_query = harvest_count_query.where(
            extract('year', PlantHarvest.harvest_date) == year
        )
    harvest_count_result = await db.execute(harvest_count_query)
    harvests = harvest_count_result.scalars().all()

    # Calculate totals
    total_expenses = sum((p.total_expenses or 0) + (p.processing_cost or 0) for p in livestock)
    total_meat = sum(p.final_weight or 0 for p in livestock)
    avg_cost_per_pound = total_expenses / total_meat if total_meat > 0 else 0

    # Calculate breakdown by animal type
    by_type = {}
    for p in livestock:
        atype = p.animal_type or 'unknown'
        if atype not in by_type:
            by_type[atype] = {'count': 0, 'weight': 0, 'expenses': 0}
        by_type[atype]['count'] += 1
        by_type[atype]['weight'] += p.final_weight or 0
        by_type[atype]['expenses'] += (p.total_expenses or 0) + (p.processing_cost or 0)

    # Calculate cost per lb for each type
    livestock_by_type = []
    for atype, data in by_type.items():
        cost_per_lb = data['expenses'] / data['weight'] if data['weight'] > 0 else 0
        livestock_by_type.append({
            'type': atype,
            'count': data['count'],
            'weight': data['weight'],
            'expenses': data['expenses'],
            'cost_per_pound': cost_per_lb,
        })

    # Order revenue
    order_revenue = sum(o.total_paid or 0 for o in orders)
    outstanding_balance = sum(o.balance_due or 0 for o in orders if o.status != OrderStatus.CANCELLED)

    # Direct sales revenue
    direct_sales_revenue = sum(s.total_price or 0 for s in sales)

    # Allocation breakdown
    personal_weight = sum(a.weight or 0 for a in allocations if a.allocation_type == AllocationType.PERSONAL)
    personal_cost = sum(a.allocated_cost or 0 for a in allocations if a.allocation_type == AllocationType.PERSONAL)
    sold_weight = sum(a.weight or 0 for a in allocations if a.allocation_type == AllocationType.SALE)

    total_revenue = order_revenue + direct_sales_revenue

    # Harvest allocation breakdown
    harvest_consumed = len([a for a in harvest_allocations if a.use_type == HarvestUseType.CONSUMED])
    harvest_sold = len([a for a in harvest_allocations if a.use_type == HarvestUseType.SOLD])
    harvest_preserved = len([a for a in harvest_allocations if a.use_type == HarvestUseType.PRESERVED])
    harvest_gifted = len([a for a in harvest_allocations if a.use_type == HarvestUseType.GIFTED])
    harvest_spoiled = len([a for a in harvest_allocations if a.use_type == HarvestUseType.SPOILED])

    return {
        "year": year,
        "livestock": {
            "total_processed": len(livestock),
            "total_meat_lbs": total_meat,
            "total_expenses": total_expenses,
            "avg_cost_per_pound": avg_cost_per_pound,
            "by_type": livestock_by_type,
        },
        "harvests": {
            "total_harvests": len(harvests),
            "consumed": harvest_consumed,
            "sold": harvest_sold,
            "preserved": harvest_preserved,
            "gifted": harvest_gifted,
            "spoiled": harvest_spoiled,
        },
        "orders": {
            "total_orders": len(orders),
            "completed_orders": len([o for o in orders if o.status == OrderStatus.COMPLETED]),
            "active_orders": len([o for o in orders if o.status not in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]]),
            "total_collected": order_revenue,
            "outstanding_balance": outstanding_balance,
        },
        "allocations": {
            "personal_weight": personal_weight,
            "personal_cost": personal_cost,
            "sold_weight": sold_weight,
        },
        "sales": {
            "total_sales": len(sales),
            "total_revenue": direct_sales_revenue,
        },
        "summary": {
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "net_profit": total_revenue - total_expenses,
            "outstanding_payments": outstanding_balance,
        }
    }


@router.get("/outstanding-payments/")
async def get_outstanding_payments(
    db: AsyncSession = Depends(get_db),
):
    """Get orders with outstanding balances"""
    result = await db.execute(
        select(LivestockOrder)
        .where(LivestockOrder.balance_due > 0)
        .where(LivestockOrder.status != OrderStatus.CANCELLED)
        .order_by(LivestockOrder.balance_due.desc())
    )
    orders = result.scalars().all()

    response = []
    for order in orders:
        payments_result = await db.execute(
            select(OrderPayment).where(OrderPayment.order_id == order.id).order_by(OrderPayment.payment_date)
        )
        payments = payments_result.scalars().all()
        response.append({
            "order": LivestockOrderResponse(
                **{c.name: getattr(order, c.name) for c in order.__table__.columns},
                payments=payments
            ),
            "total_due": order.final_total or order.estimated_total or 0,
            "total_paid": order.total_paid or 0,
            "balance_due": order.balance_due or 0,
        })

    return response
