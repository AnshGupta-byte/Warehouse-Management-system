import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from typing import List
from app.schemas import DailySales, PredictionItem

def generate_forecast(sku: str, sales_history: List[DailySales]) -> List[PredictionItem]:
    if len(sales_history) == 0:
        # Return default fallback predictions if there are no records
        predictions = []
        for horizon in [30, 60, 90]:
            target_date = datetime.now() + timedelta(days=horizon)
            predictions.append(
                PredictionItem(
                    date=target_date.strftime("%Y-%m-%d"),
                    predictedQty=10.0,
                    confidence=0.50
                )
            )
        return predictions

    # 1. Prepare DataFrame
    data = []
    for s in sales_history:
        try:
            dt = datetime.strptime(s.date, "%Y-%m-%d")
            data.append({"date": dt, "qty": s.quantity})
        except ValueError:
            # handle alternate formats if needed
            pass

    df = pd.DataFrame(data)
    if df.empty:
        df = pd.DataFrame([{"date": datetime.now(), "qty": 1.0}])

    # Group by date to aggregate multiple movements on same day
    df = df.groupby("date")["qty"].sum().reset_index()
    df = df.sort_values("date")

    # 2. Forecasting logic
    predictions = []
    horizons = [30, 60, 90]

    # If too few points (e.g. < 5 historical sales dates), use moving average + seasonality mock
    if len(df) < 5:
        avg_qty = df["qty"].mean()
        for h in horizons:
            target_date = datetime.now() + timedelta(days=h)
            # Add basic seasonality noise based on day of year
            seasonality = 1.0 + 0.1 * np.sin(2 * np.pi * target_date.timetuple().tm_yday / 365.25)
            predicted = max(1.0, float(avg_qty * h * seasonality / 30))  # demand over h days divided by 30-day window
            
            predictions.append(
                PredictionItem(
                    date=target_date.strftime("%Y-%m-%d"),
                    predictedQty=round(predicted, 2),
                    confidence=0.70
                )
            )
        return predictions

    # Otherwise, fit a Seasonal Linear Regression model
    # Features: trend (day offset from min date), day of week, month
    df["trend"] = (df["date"] - df["date"].min()).dt.days
    df["day_of_week"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month

    # One-hot encode categorical features (day_of_week and month)
    X = pd.get_dummies(df[["trend", "day_of_week", "month"]], columns=["day_of_week", "month"])
    y = df["qty"]

    model = LinearRegression()
    model.fit(X, y)

    # Calculate model confidence (R2 score with a clamp)
    r2 = model.score(X, y)
    confidence = max(0.60, min(0.95, 0.70 + (r2 * 0.25)))

    # Predict future horizons
    last_date = df["date"].max()
    for h in horizons:
        target_date = last_date + timedelta(days=h)
        
        # Build prediction record
        pred_dict = {
            "trend": (target_date - df["date"].min()).days,
            "day_of_week": target_date.weekday(),
            "month": target_date.month
        }
        
        # Create row with same columns as X (filled with 0)
        pred_df = pd.DataFrame([pred_dict])
        pred_encoded = pd.get_dummies(pred_df, columns=["day_of_week", "month"])
        
        # Reindex to match training columns
        pred_encoded = pred_encoded.reindex(columns=X.columns, fill_value=0)
        
        # Predict daily demand and multiply by scale
        daily_prediction = model.predict(pred_encoded)[0]
        # Ensure non-negative daily demand
        daily_prediction = max(0.1, daily_prediction)
        
        # Accumulate demand over the horizon period (30, 60, or 90 days)
        # We scale the daily prediction by the horizon length and a slight smoothing factor
        predicted_total = daily_prediction * h
        
        predictions.append(
            PredictionItem(
                date=target_date.strftime("%Y-%m-%d"),
                predictedQty=round(float(predicted_total), 2),
                confidence=round(float(confidence), 2)
            )
        )

    return predictions
