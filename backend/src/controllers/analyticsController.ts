import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ABC Classification: A = top 80% value, B = next 15%, C = bottom 5%
export const getABCClassification = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        stockLevels: true,
        orderItems: {
          include: { order: true },
        },
        category: true,
      },
    });

    // Calculate annual usage value for each product
    const productValues = products.map((p) => {
      const totalSold = p.orderItems
        .filter((oi) => oi.order.type === 'SALES' && oi.order.status === 'DELIVERED')
        .reduce((sum, oi) => sum + oi.quantity, 0);
      const annualUsageValue = totalSold * p.unitPrice;
      const currentStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category.name,
        unitPrice: p.unitPrice,
        currentStock,
        totalSold,
        annualUsageValue,
        stockValue: currentStock * p.unitPrice,
      };
    });

    // Sort by annual usage value descending
    productValues.sort((a, b) => b.annualUsageValue - a.annualUsageValue);

    const totalValue = productValues.reduce((sum, p) => sum + p.annualUsageValue, 0);
    let cumulativeValue = 0;

    const classified = productValues.map((p) => {
      cumulativeValue += p.annualUsageValue;
      const cumulativePct = totalValue > 0 ? (cumulativeValue / totalValue) * 100 : 0;
      let abcClass: 'A' | 'B' | 'C';
      if (cumulativePct <= 80) abcClass = 'A';
      else if (cumulativePct <= 95) abcClass = 'B';
      else abcClass = 'C';
      return { ...p, abcClass, cumulativePct: Math.round(cumulativePct * 10) / 10 };
    });

    const summary = {
      A: classified.filter((p) => p.abcClass === 'A').length,
      B: classified.filter((p) => p.abcClass === 'B').length,
      C: classified.filter((p) => p.abcClass === 'C').length,
      totalProducts: classified.length,
      totalStockValue: productValues.reduce((sum, p) => sum + p.stockValue, 0),
    };

    res.json({ success: true, data: classified, summary });
  } catch (err: any) {
    console.error('[analyticsController] ABC error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Multi-product sales trend over time (monthly buckets)
export const getSalesTrends = async (req: Request, res: Response) => {
  try {
    const { productIds, months = '6' } = req.query as { productIds?: string; months?: string };
    const monthsBack = parseInt(months, 10);
    const since = new Date();
    since.setMonth(since.getMonth() - monthsBack);

    // If specific products requested, filter; otherwise top 5 by revenue
    let selectedProductIds: string[] = [];
    if (productIds) {
      selectedProductIds = (productIds as string).split(',');
    } else {
      const topProducts = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { type: 'SALES', orderDate: { gte: since } } },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      });
      selectedProductIds = topProducts.map((p) => p.productId);
    }

    const products = await prisma.product.findMany({
      where: { id: { in: selectedProductIds } },
      select: { id: true, name: true, sku: true },
    });

    // Fetch monthly order item aggregates
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: selectedProductIds },
        order: {
          type: 'SALES',
          orderDate: { gte: since },
        },
      },
      include: { order: { select: { orderDate: true } } },
    });

    // Group by product and month
    const trendMap: Record<string, Record<string, number>> = {};
    selectedProductIds.forEach((pid) => { trendMap[pid] = {}; });

    orderItems.forEach((item) => {
      const month = item.order.orderDate.toISOString().slice(0, 7); // YYYY-MM
      if (!trendMap[item.productId]) trendMap[item.productId] = {};
      trendMap[item.productId][month] = (trendMap[item.productId][month] || 0) + item.quantity;
    });

    // Build unified month axis
    const months_labels: string[] = [];
    const cursor = new Date(since);
    cursor.setDate(1);
    while (cursor <= new Date()) {
      months_labels.push(cursor.toISOString().slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const series = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      data: months_labels.map((m) => trendMap[p.id]?.[m] || 0),
    }));

    res.json({ success: true, labels: months_labels, series });
  } catch (err: any) {
    console.error('[analyticsController] Trends error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Inventory turnover ratio per product
export const getInventoryTurnover = async (req: Request, res: Response) => {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);

    const products = await prisma.product.findMany({
      include: {
        stockLevels: true,
        orderItems: {
          where: { order: { type: 'SALES', orderDate: { gte: since } } },
        },
        category: true,
      },
    });

    const turnover = products.map((p) => {
      const avgInventory = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
      const annualCOGS = p.orderItems.reduce((sum, oi) => sum + oi.quantity * p.unitPrice, 0);
      const ratio = avgInventory > 0 ? annualCOGS / (avgInventory * p.unitPrice) : 0;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category.name,
        turnoverRatio: Math.round(ratio * 100) / 100,
        avgInventory,
        annualCOGS: Math.round(annualCOGS * 100) / 100,
      };
    });

    turnover.sort((a, b) => b.turnoverRatio - a.turnoverRatio);
    res.json({ success: true, data: turnover });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
