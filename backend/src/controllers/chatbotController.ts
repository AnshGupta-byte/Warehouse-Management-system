import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

type ResponseType = 'text' | 'table' | 'alert_list' | 'product_list';

function detectQueryIntent(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('low stock') || q.includes('alert') || q.includes('warning')) return 'alerts';
  if (q.includes('reorder') || q.includes('recommend') || q.includes('purchase')) return 'reorder';
  if (q.includes('top product') || q.includes('best sell') || q.includes('highest revenue')) return 'top_products';
  if (q.includes('inventory') || q.includes('stock') || q.includes('product')) return 'inventory';
  if (q.includes('order') || q.includes('pending') || q.includes('shipped')) return 'orders';
  return 'general';
}

export const handleChatQuery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Please provide a chat query.' });
    }

    const intent = detectQueryIntent(query);

    // 1. Gather real-time context from the PostgreSQL database
    const [products, warehouses, alerts, recentOrders] = await Promise.all([
      prisma.product.findMany({
        include: { stockLevels: true, category: true, orderItems: { include: { order: true } } },
      }),
      prisma.warehouse.findMany(),
      prisma.alert.findMany({ where: { isResolved: false } }),
      prisma.order.findMany({
        where: { status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED'] } },
        include: { items: { include: { product: true } } },
        orderBy: { orderDate: 'desc' },
        take: 10,
      }),
    ]);

    const productsContext = products
      .map((p) => {
        const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
        return `- ${p.name} (SKU: ${p.sku}): Stock = ${totalStock} ${p.unit}, Price = $${p.unitPrice}, Reorder Point = ${p.reorderPoint}`;
      })
      .join('\n');

    const warehousesContext = warehouses
      .map((w) => `- ${w.name} in ${w.location} (Capacity: ${w.capacity} units)`)
      .join('\n');

    const alertsContext = alerts
      .map((a) => `- [${a.severity}] ${a.title}: ${a.message}`)
      .join('\n');

    const context = `
Warehouses List:
${warehousesContext}

Products Stock and Reorder points:
${productsContext}

Active Low Stock Alerts:
${alertsContext || 'None'}
    `.trim();

    let botResponse = '';
    let responseType: ResponseType = 'text';
    let tableData: any = null;

    // 2. Try Gemini AI service
    try {
      const response = await fetch(`${AI_SERVICE_URL}/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context }),
      });
      if (response.ok) {
        const data: any = await response.json();
        botResponse = data.response;
      }
    } catch (apiError) {
      console.warn('[Chatbot] Python chatbot service unreachable. Using structured fallback.');
    }

    // 3. Structured fallback with table data
    if (!botResponse) {
      if (intent === 'alerts') {
        if (alerts.length === 0) {
          botResponse = "✅ No active low-stock alerts right now. All products are above their reorder thresholds.";
          responseType = 'text';
        } else {
          botResponse = `Found ${alerts.length} active alerts requiring attention.`;
          responseType = 'alert_list';
          tableData = {
            headers: ['Severity', 'Title', 'Message'],
            rows: alerts.map((a) => [a.severity, a.title, a.message]),
          };
        }
      } else if (intent === 'reorder') {
        const reorders = products
          .map((p) => {
            const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
            return { p, totalStock };
          })
          .filter(({ p, totalStock }) => totalStock <= p.reorderPoint)
          .map(({ p, totalStock }) => ({
            name: p.name,
            sku: p.sku,
            current: totalStock,
            reorderPoint: p.reorderPoint,
            suggestedQty: p.reorderQty,
            estimatedCost: (p.reorderQty * p.unitPrice).toFixed(2),
          }));

        if (reorders.length === 0) {
          botResponse = "✅ All products are well stocked. No reorder replenishment recommended at this time.";
        } else {
          botResponse = `${reorders.length} products need restocking.`;
          responseType = 'table';
          tableData = {
            headers: ['Product', 'SKU', 'Current Stock', 'Reorder Point', 'Suggested Qty', 'Est. Cost'],
            rows: reorders.map((r) => [r.name, r.sku, r.current, r.reorderPoint, r.suggestedQty, `$${r.estimatedCost}`]),
          };
        }
      } else if (intent === 'top_products') {
        const productRevenue = products.map((p) => {
          const revenue = p.orderItems
            .filter((oi) => oi.order.type === 'SALES')
            .reduce((sum, oi) => sum + oi.total, 0);
          const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
          return { name: p.name, sku: p.sku, category: p.category.name, revenue, totalStock };
        });
        productRevenue.sort((a, b) => b.revenue - a.revenue);
        const top10 = productRevenue.slice(0, 10);
        botResponse = `Here are the top ${top10.length} products by revenue.`;
        responseType = 'table';
        tableData = {
          headers: ['Product', 'SKU', 'Category', 'Revenue', 'Current Stock'],
          rows: top10.map((r) => [r.name, r.sku, r.category, `$${r.revenue.toFixed(2)}`, r.totalStock]),
        };
      } else if (intent === 'inventory') {
        botResponse = `Current inventory summary across all warehouses.`;
        responseType = 'product_list';
        tableData = {
          headers: ['Product', 'SKU', 'Category', 'Stock', 'Unit Price', 'Status'],
          rows: products.map((p) => {
            const totalStock = p.stockLevels.reduce((sum, sl) => sum + sl.quantity, 0);
            const status = totalStock <= 0 ? '🔴 Stockout' : totalStock <= p.reorderPoint ? '🟡 Low Stock' : '🟢 OK';
            return [p.name, p.sku, p.category.name, totalStock, `$${p.unitPrice}`, status];
          }),
        };
      } else if (intent === 'orders') {
        botResponse = `Active orders in the system.`;
        responseType = 'table';
        tableData = {
          headers: ['Order #', 'Type', 'Status', 'Customer/Supplier', 'Total', 'Date'],
          rows: recentOrders.map((o) => [
            o.orderNumber,
            o.type,
            o.status,
            o.customer || o.supplier || 'N/A',
            `$${o.totalAmount.toFixed(2)}`,
            new Date(o.orderDate).toLocaleDateString(),
          ]),
        };
      } else {
        botResponse = `Hello! I'm WarehouseAI, your smart logistics assistant. I can help you with:

• **Low stock alerts** — "Are there any active alerts?"
• **Reorder recommendations** — "What products need restocking?"
• **Inventory overview** — "Show me current stock levels"
• **Top products** — "What are the best selling products?"
• **Active orders** — "Show me pending orders"`;
        responseType = 'text';
      }
    }

    res.status(200).json({
      success: true,
      response: botResponse,
      type: responseType,
      tableData,
    });
  } catch (error) {
    next(error);
  }
};
