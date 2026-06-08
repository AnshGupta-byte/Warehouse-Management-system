from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from forecaster import DemandForecaster
from anomaly import AnomalyDetector
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="WMS AI Service",
    description="Demand Forecasting & Anomaly Detection for Warehouse Management System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

forecaster = DemandForecaster()
anomaly_detector = AnomalyDetector()


class HistoryPoint(BaseModel):
    date: str  # ISO date string
    quantity: float


class ForecastRequest(BaseModel):
    product_id: str
    product_name: str
    history: List[HistoryPoint]
    forecast_days: int = 90


class ForecastPoint(BaseModel):
    date: str
    predicted: float
    lower: float
    upper: float


class ForecastResponse(BaseModel):
    product_id: str
    forecast: List[ForecastPoint]
    summary: dict
    model_used: str


class AnomalyRequest(BaseModel):
    product_id: str
    history: List[HistoryPoint]


class AnomalyResponse(BaseModel):
    product_id: str
    anomalies: List[dict]
    has_anomalies: bool


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "WMS AI Service", "version": "1.0.0"}


@app.post("/forecast", response_model=ForecastResponse)
async def forecast_demand(request: ForecastRequest):
    try:
        logger.info(f"Forecasting demand for product: {request.product_id}")

        if len(request.history) < 14:
            raise HTTPException(
                status_code=400,
                detail="Need at least 14 days of history for forecasting"
            )

        result = forecaster.forecast(
            product_id=request.product_id,
            history=[(p.date, p.quantity) for p in request.history],
            forecast_days=request.forecast_days
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/anomaly", response_model=AnomalyResponse)
async def detect_anomalies(request: AnomalyRequest):
    try:
        logger.info(f"Detecting anomalies for product: {request.product_id}")

        result = anomaly_detector.detect(
            product_id=request.product_id,
            history=[(p.date, p.quantity) for p in request.history]
        )

        return result

    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch-forecast")
async def batch_forecast(requests: List[ForecastRequest]):
    """Run forecasting for multiple products"""
    results = []
    for req in requests:
        try:
            if len(req.history) >= 14:
                result = forecaster.forecast(
                    product_id=req.product_id,
                    history=[(p.date, p.quantity) for p in req.history],
                    forecast_days=req.forecast_days
                )
                results.append(result)
        except Exception as e:
            logger.warning(f"Skipping {req.product_id}: {e}")
    return results


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
