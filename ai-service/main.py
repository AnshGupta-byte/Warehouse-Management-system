import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from app.schemas import ForecastRequest, ForecastResponse, ProductForecast, ChatRequest, ChatResponse
from app.forecaster import generate_forecast
from app.chatbot import get_chatbot_response
import uvicorn

app = FastAPI(
    title="WarehouseAI Services",
    description="Microservice for demand forecasting and NLP query answering",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequestWithContext(BaseModel):
    query: str
    context: Optional[str] = ""

@app.get("/")
def read_root():
    return {"status": "online", "service": "WarehouseAI Python Microservice"}

@app.post("/forecast", response_model=ForecastResponse)
def run_forecast(payload: ForecastRequest):
    try:
        forecasts = []
        for p in payload.products:
            predictions = generate_forecast(p.sku, p.sales)
            forecasts.append(ProductForecast(sku=p.sku, predictions=predictions))
        return ForecastResponse(forecasts=forecasts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting pipeline failed: {str(e)}")

@app.post("/chatbot", response_model=ChatResponse)
def run_chatbot(payload: ChatRequestWithContext):
    try:
        response_text = get_chatbot_response(payload.query, payload.context)
        # If Gemini is not set up or fails, return empty so the backend falls back to local parsing
        return ChatResponse(response=response_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chatbot failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
