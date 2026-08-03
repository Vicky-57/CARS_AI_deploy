"""
Net Broker Profit Calculator Service

Formula:
  Total Expenses           = SUM(receipt amounts)
  Labor Cost               = Labor Hours * Hourly Rate (Default €20/hr)
  Total Project Investment = Vehicle Purchase Price + Total Expenses + Labor Cost
  Net Broker Profit        = Agreed Final Sale Price - Total Project Investment
"""

from typing import List, Dict, Any
from app.schemas.project import NetProfitCalculation


def calculate_net_profit(
    purchase_price: float,
    agreed_sale_price: float,
    hourly_rate: float,
    expenses: List[Dict[str, Any]],
    labor_entries: List[Dict[str, Any]]
) -> NetProfitCalculation:
    """
    Calculates total expenses, labor costs, project investment, and net profit.
    """
    total_expenses = sum(float(item.get("amount", 0.0)) for item in expenses)
    total_labor_hours = sum(float(item.get("hours_spent", 0.0)) for item in labor_entries)
    
    rate = hourly_rate if hourly_rate and hourly_rate > 0 else 20.0
    total_labor_cost = total_labor_hours * rate
    
    purch_price = purchase_price if purchase_price else 0.0
    sale_price = agreed_sale_price if agreed_sale_price else 0.0
    
    total_investment = purch_price + total_expenses + total_labor_cost
    net_profit = sale_price - total_investment
    
    return NetProfitCalculation(
        vehicle_purchase_price=purch_price,
        agreed_sale_price=sale_price,
        total_expenses=round(total_expenses, 2),
        total_labor_hours=round(total_labor_hours, 2),
        hourly_rate=round(rate, 2),
        total_labor_cost=round(total_labor_cost, 2),
        total_project_investment=round(total_investment, 2),
        net_broker_profit=round(net_profit, 2)
    )
