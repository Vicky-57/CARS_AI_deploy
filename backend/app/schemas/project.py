from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ExpenseCreate(BaseModel):
    expense_type: str = Field("OTHER", description="OIL_CHANGE, PAYMENT_SLIP, TUEV_INSPECTION, DETAILING, TRANSPORT, ADMIN, OTHER")
    description: str = Field(..., description="Description of the expense item")
    amount: float = Field(..., description="Expense amount in EUR")
    receipt_url: Optional[str] = Field(None, description="URL of receipt image")


class ExpenseResponse(ExpenseCreate):
    id: str
    project_id: str
    logged_at: datetime


class LaborLogCreate(BaseModel):
    hours_spent: float = Field(..., description="Hours worked e.g. 4.5")
    activity_description: str = Field(..., description="Details of labor activity")


class LaborLogResponse(LaborLogCreate):
    id: str
    project_id: str
    logged_at: datetime


class NetProfitCalculation(BaseModel):
    vehicle_purchase_price: float = 0.0
    agreed_sale_price: float = 0.0
    total_expenses: float = 0.0
    total_labor_hours: float = 0.0
    hourly_rate: float = 20.0
    total_labor_cost: float = 0.0
    total_project_investment: float = 0.0
    net_broker_profit: float = 0.0
