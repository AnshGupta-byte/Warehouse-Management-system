import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AppError } from '../middleware/errorMiddleware';
import { broadcast } from '../services/websocketService';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export const getForecasts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forecasts = await prisma.forecastResult.findMany({
      include: {
        product: true,
      },
      orderBy: { forecastDate: 'asc' },
    });

    res.status(200).json({
      success: true,
      forecasts,
    });
  } catch (error) {
    next(error);
  }
};

export const triggerForecasting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Fetch historical sales data (Sales OrderItems)
    const salesMovements = await prisma.stockMovement.findMany({
      where: {
        type: 'OUT',
        reason: { contains: 'Order fulfillment' },
      },
      include: {
        product: true,
      },
      orderBy: { date: 'asc' },
    });

    if (salesMovements.length === 0) {
      return next(new AppError('Insufficient historical sales data to train forecasting model', 400));
    }

    // Format data for the AI service
    // Group sales by product and date (YYYY-MM-DD)
    const historyMap: { [key: string]: { [date: string]: number } } = {};
    salesMovements.forEach((m) => {
      const dateStr = m.date.toISOString().split('T')[0];
      const sku = m.product.sku;
      if (!historyMap[sku]) {
        historyMap[sku] = {};
      }
      historyMap[sku][dateStr] = (historyMap[sku][dateStr] || 0) + m.quantity;
    });

    const productsData = Object.keys(historyMap).map((sku) => {
      const sales = Object.keys(historyMap[sku]).map((date) => ({
        date,
        quantity: historyMap[sku][date],
      }));
      return { sku, sales };
    });

    // 2. Call Python FastAPI forecaster microservice
    // We import dynamically/fetch from AI service.
    // If it fails (microservice offline), we fall back to a lightweight statistical moving average
    let forecastResults: any[] = [];

    try {
      const response = await fetch(`${AI_SERVICE_URL}/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: productsData }),
      });

      if (response.ok) {
        const data: any = await response.json();
        forecastResults = data.forecasts; // Array of { sku, predictions: [ { date, predictedQty, confidence } ] }
      } else {
        console.warn('[Forecaster] Python service returned non-200. Falling back to local forecasting.');
      }
    } catch (apiError) {
      console.warn('[Forecaster] Python service unreachable. Falling back to local forecasting. Error:', apiError);
    }

    // Fallback forecasting if python service is offline/failed
    if (forecastResults.length === 0) {
      // Simple linear regression / moving average fallback
      const products = await prisma.product.findMany();
      for (const product of products) {
        const sku = product.sku;
        const prodSales = salesMovements.filter((m) => m.product.sku === sku);
        
        let avgDailyQty = 1;
        if (prodSales.length > 0) {
          const totalQty = prodSales.reduce((sum, m) => sum + m.quantity, 0);
          // average over distinct dates
          const dates = new Set(prodSales.map((m) => m.date.toISOString().split('T')[0]));
          avgDailyQty = totalQty / (dates.size || 1);
        }

        const predictions = [];
        const horizons = [30, 60, 90];
        
        for (const h of horizons) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + h);
          
          // Add some seasonal randomness (e.g. +-15%)
          const seasonality = 1 + (Math.sin(h / 30) * 0.15);
          const predictedQty = avgDailyQty * h * seasonality;

          predictions.push({
            date: targetDate.toISOString().split('T')[0],
            predictedQty: Math.max(1, parseFloat(predictedQty.toFixed(2))),
            confidence: 0.82,
          });
        }
        forecastResults.push({ sku, predictions });
      }
    }

    // 3. Save forecast results to database (with Transaction to overwrite old forecasts)
    await prisma.$transaction(async (tx) => {
      // Clear old forecasts
      await tx.forecastResult.deleteMany();

      for (const res of forecastResults) {
        const product = await tx.product.findUnique({ where: { sku: res.sku } });
        if (!product) continue;

        const forecastData = res.predictions.map((p: any) => ({
          productId: product.id,
          forecastDate: new Date(p.date),
          predictedQty: p.predictedQty,
          confidence: p.confidence || 0.85,
        }));

        await tx.forecastResult.createMany({
          data: forecastData,
        });
      }
    });

    const updatedForecasts = await prisma.forecastResult.findMany({
      include: { product: true },
    });

    broadcast('FORECASTS_REFRESHED', updatedForecasts);

    res.status(200).json({
      success: true,
      message: 'Forecasting run completed successfully',
      forecasts: updatedForecasts,
    });
  } catch (error) {
    next(error);
  }
};

export const getReorderRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        stockLevels: true,
        forecasts: {
          orderBy: { forecastDate: 'asc' },
        },
      },
    });

    const recommendations = [];

    for (const product of products) {
      const totalStock = product.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
      
      // Safety Stock calculation:
      // Safety Stock = (Max Daily usage * Max lead time) - (Avg daily usage * Avg lead time)
      // We read safety stock from DB model or calculate standard.
      // Reorder point = (Average daily sales * Lead time) + Safety stock
      // Let's use leadTimeDays default of 7, safetyStock from db
      const leadTime = 7; 
      const safetyStock = product.safetyStock;

      // Find 30 days forecast
      const forecast30 = product.forecasts.find((f) => {
        const diffDays = Math.ceil((f.forecastDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 20 && diffDays <= 40;
      });

      const next30DaysDemand = forecast30 ? forecast30.predictedQty : (product.reorderPoint * 3);
      const avgDailyDemand = next30DaysDemand / 30;
      
      const calculatedReorderPoint = Math.ceil((avgDailyDemand * leadTime) + safetyStock);
      const isReorderNeeded = totalStock <= calculatedReorderPoint;

      // Recommended purchase order qty
      // PoQty = TargetStock - CurrentStock. TargetStock = calculatedReorderPoint + Product.reorderQty
      const recommendedQty = isReorderNeeded 
        ? Math.max(product.reorderQty, Math.ceil((calculatedReorderPoint + product.reorderQty) - totalStock))
        : 0;

      // ABC classification
      // A: high total cost (high unit price * stock), B: medium, C: low
      const inventoryVal = totalStock * product.unitPrice;
      let abcClass = 'C';
      if (inventoryVal > 5000) {
        abcClass = 'A';
      } else if (inventoryVal > 1500) {
        abcClass = 'B';
      }

      recommendations.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unitPrice: product.unitPrice,
        totalStock,
        safetyStock,
        leadTimeDays: leadTime,
        reorderPoint: calculatedReorderPoint,
        next30DaysForecast: parseFloat(next30DaysDemand.toFixed(2)),
        isReorderNeeded,
        recommendedQty,
        abcClass,
        inventoryValue: inventoryVal,
      });
    }

    res.status(200).json({
      success: true,
      recommendations,
    });
  } catch (error) {
    next(error);
  }
};
