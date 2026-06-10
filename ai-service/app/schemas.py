from pydantic import BaseModel
from typing import List, Optional

class DailySales(BaseModel):
    date: str
    quantity: float

class ProductSalesData(BaseModel):
    sku: str
    sales: List[DailySales]

class ForecastRequest(BaseModel):
    products: List[ProductSalesData]

class PredictionItem(BaseModel):
    date: str
    predictedQty: float
    confidence: float

class ProductForecast(BaseModel):
    sku: str
    predictions: List[PredictionItem]

class ForecastResponse(BaseModel):
    forecasts: List[ProductForecast]

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    response: str
