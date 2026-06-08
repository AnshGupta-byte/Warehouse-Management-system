import pandas as pd
import numpy as np
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)

PROPHET_AVAILABLE = False
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
    logger.info("Prophet is available ✓")
except Exception:
    logger.info("Prophet not available — using Exponential Smoothing fallback")



class DemandForecaster:
    def forecast(
        self,
        product_id: str,
        history: List[Tuple[str, float]],
        forecast_days: int = 90
    ) -> dict:
        """
        Generate demand forecast for a product.
        Uses Prophet if available, falls back to trend + seasonality model.
        """
        df = pd.DataFrame(history, columns=["ds", "y"])
        df["ds"] = pd.to_datetime(df["ds"])
        df = df.sort_values("ds").drop_duplicates("ds")
        df["y"] = df["y"].clip(lower=0)

        if PROPHET_AVAILABLE and len(df) >= 30:
            return self._prophet_forecast(product_id, df, forecast_days)
        else:
            return self._fallback_forecast(product_id, df, forecast_days)

    def _prophet_forecast(self, product_id: str, df: pd.DataFrame, forecast_days: int) -> dict:
        """Facebook Prophet time-series forecasting"""
        try:
            model = Prophet(
                yearly_seasonality=True,
                weekly_seasonality=True,
                daily_seasonality=False,
                seasonality_mode='multiplicative',
                interval_width=0.8,
                changepoint_prior_scale=0.05
            )
            model.fit(df)

            future = model.make_future_dataframe(periods=forecast_days)
            forecast = model.predict(future)

            # Get only future predictions
            last_historical = df["ds"].max()
            future_forecast = forecast[forecast["ds"] > last_historical].copy()

            forecast_points = []
            for _, row in future_forecast.iterrows():
                forecast_points.append({
                    "date": row["ds"].strftime("%Y-%m-%d"),
                    "predicted": max(0, round(float(row["yhat"]), 2)),
                    "lower": max(0, round(float(row["yhat_lower"]), 2)),
                    "upper": max(0, round(float(row["yhat_upper"]), 2)),
                })

            total_predicted = sum(p["predicted"] for p in forecast_points)
            avg_daily = total_predicted / forecast_days if forecast_days > 0 else 0
            peak = max(p["predicted"] for p in forecast_points) if forecast_points else 0

            return {
                "product_id": product_id,
                "forecast": forecast_points,
                "summary": {
                    "total_predicted": round(total_predicted, 0),
                    "avg_daily_demand": round(avg_daily, 2),
                    "peak_daily_demand": round(peak, 2),
                    "forecast_days": forecast_days,
                    "confidence_level": "80%",
                },
                "model_used": "Prophet"
            }
        except Exception as e:
            logger.warning(f"Prophet failed: {e}, using fallback")
            return self._fallback_forecast(product_id, df, forecast_days)

    def _fallback_forecast(self, product_id: str, df: pd.DataFrame, forecast_days: int) -> dict:
        """
        Fallback: exponential smoothing + trend + weekly seasonality
        """
        y = df["y"].values

        # Simple exponential smoothing
        alpha = 0.3
        smoothed = [y[0]]
        for i in range(1, len(y)):
            smoothed.append(alpha * y[i] + (1 - alpha) * smoothed[-1])

        # Linear trend
        x = np.arange(len(y))
        if len(x) > 1:
            slope = np.polyfit(x, y, 1)[0]
        else:
            slope = 0

        base_level = smoothed[-1]
        std_dev = np.std(y) if len(y) > 1 else base_level * 0.2

        # Weekly seasonality factors (Mon-Sun)
        weekly_factors = [1.0, 0.95, 0.95, 1.0, 1.1, 1.3, 1.25]

        last_date = df["ds"].max()
        forecast_points = []

        for d in range(1, forecast_days + 1):
            forecast_date = last_date + pd.Timedelta(days=d)
            dow = forecast_date.dayofweek
            month = forecast_date.month

            # Seasonal boost for Q4 (Oct-Dec)
            season_factor = 1.5 if month in [11, 12] else 1.2 if month in [1, 6, 7] else 1.0

            predicted = (base_level + slope * d) * weekly_factors[dow] * season_factor
            predicted = max(0, predicted)

            forecast_points.append({
                "date": forecast_date.strftime("%Y-%m-%d"),
                "predicted": round(float(predicted), 2),
                "lower": round(max(0, float(predicted - 1.28 * std_dev)), 2),
                "upper": round(float(predicted + 1.28 * std_dev), 2),
            })

        total_predicted = sum(p["predicted"] for p in forecast_points)
        avg_daily = total_predicted / forecast_days if forecast_days > 0 else 0
        peak = max(p["predicted"] for p in forecast_points) if forecast_points else 0

        return {
            "product_id": product_id,
            "forecast": forecast_points,
            "summary": {
                "total_predicted": round(total_predicted, 0),
                "avg_daily_demand": round(avg_daily, 2),
                "peak_daily_demand": round(peak, 2),
                "forecast_days": forecast_days,
                "confidence_level": "80%",
            },
            "model_used": "Exponential Smoothing + Trend"
        }
