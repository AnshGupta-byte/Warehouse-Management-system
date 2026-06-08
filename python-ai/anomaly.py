import pandas as pd
import numpy as np
from typing import List, Tuple
import logging

logger = logging.getLogger(__name__)


class AnomalyDetector:
    def detect(
        self,
        product_id: str,
        history: List[Tuple[str, float]]
    ) -> dict:
        """Detect anomalies in stock movement using IQR + Z-score hybrid"""
        if len(history) < 7:
            return {"product_id": product_id, "anomalies": [], "has_anomalies": False}

        df = pd.DataFrame(history, columns=["date", "quantity"])
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date")
        df["quantity"] = df["quantity"].clip(lower=0)

        # Rolling statistics (7-day window)
        df["rolling_mean"] = df["quantity"].rolling(7, min_periods=3).mean()
        df["rolling_std"] = df["quantity"].rolling(7, min_periods=3).std().fillna(1)

        # Z-score anomaly detection
        df["z_score"] = abs((df["quantity"] - df["rolling_mean"]) / df["rolling_std"].replace(0, 1))

        # IQR anomaly detection
        Q1 = df["quantity"].quantile(0.25)
        Q3 = df["quantity"].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 2.0 * IQR
        upper_bound = Q3 + 2.0 * IQR

        df["iqr_anomaly"] = (df["quantity"] < lower_bound) | (df["quantity"] > upper_bound)

        # Combine: flag if z-score > 2.5 OR IQR anomaly
        df["is_anomaly"] = (df["z_score"] > 2.5) | df["iqr_anomaly"]

        anomalies = []
        for _, row in df[df["is_anomaly"]].iterrows():
            severity = "high" if row["z_score"] > 3.5 else "medium"
            direction = "spike" if row["quantity"] > row["rolling_mean"] else "drop"
            anomalies.append({
                "date": row["date"].strftime("%Y-%m-%d"),
                "quantity": float(row["quantity"]),
                "expected": round(float(row["rolling_mean"]), 2) if not pd.isna(row["rolling_mean"]) else None,
                "z_score": round(float(row["z_score"]), 2),
                "severity": severity,
                "direction": direction,
                "description": f"Demand {direction}: {row['quantity']:.0f} units vs expected {row['rolling_mean']:.0f}"
            })

        return {
            "product_id": product_id,
            "anomalies": anomalies[-10:],  # Return last 10 anomalies
            "has_anomalies": len(anomalies) > 0,
            "total_anomalies": len(anomalies)
        }
