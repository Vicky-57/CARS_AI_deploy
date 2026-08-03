from fastapi import APIRouter
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.schemas.project import NetProfitCalculation
from app.services.calculator_service import calculate_net_profit

router = APIRouter(prefix="/projects", tags=["Brokerage Projects & Profit Calculator"])


class ProfitCalculateRequest(BaseModel):
    purchase_price: float = Field(0.0, description="Vehicle purchase price")
    agreed_sale_price: float = Field(0.0, description="Agreed final sale price")
    hourly_rate: float = Field(20.0, description="Broker hourly labor rate in EUR (Default 20.0)")
    expenses: List[Dict[str, Any]] = Field(default_factory=list, description="Itemized receipt expenses")
    labor_entries: List[Dict[str, Any]] = Field(default_factory=list, description="Logged labor hours")


@router.post("/calculate-profit", response_model=NetProfitCalculation)
async def calculate_project_profit(req: ProfitCalculateRequest):
    """
    Computes Net Broker Profit, Labor Costs, and Total Investment according to the CAR-AGENTS formula:
      Total Expenses           = SUM(receipt amounts)
      Labor Cost               = Labor Hours * Hourly Rate (Default €20/hr)
      Total Project Investment = Vehicle Purchase Price + Total Expenses + Labor Cost
      Net Broker Profit        = Agreed Final Sale Price - Total Project Investment
    """
    result = calculate_net_profit(
        purchase_price=req.purchase_price,
        agreed_sale_price=req.agreed_sale_price,
        hourly_rate=req.hourly_rate,
        expenses=req.expenses,
        labor_entries=req.labor_entries
    )
    return result
