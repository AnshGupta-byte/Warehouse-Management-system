import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // 1. Clear database
  await prisma.alert.deleteMany();
  await prisma.forecastResult.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();

  console.log('[Seed] Cleared existing tables.');

  // 2. Create Users
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const managerPassword = await bcrypt.hash('manager123', salt);
  const staffPassword = await bcrypt.hash('staff123', salt);

  await prisma.user.createMany({
    data: [
      { email: 'admin@warehouse.com', name: 'System Admin', password: adminPassword, role: 'ADMIN' },
      { email: 'manager@warehouse.com', name: 'Warehouse Manager', password: managerPassword, role: 'MANAGER' },
      { email: 'staff@warehouse.com', name: 'Floor Staff', password: staffPassword, role: 'STAFF' },
    ],
  });
  console.log('[Seed] Created users (Admin, Manager, Staff).');

  // 3. Create Warehouses
  const whSeattle = await prisma.warehouse.create({
    data: { name: 'Seattle Central Hub', location: 'Seattle, WA', capacity: 15000 },
  });
  const whChicago = await prisma.warehouse.create({
    data: { name: 'Chicago Distribution', location: 'Chicago, IL', capacity: 30000 },
  });
  console.log('[Seed] Created warehouses.');

  // 4. Create Categories
  const catElectronics = await prisma.category.create({
    data: { name: 'Electronics', color: '#3b82f6' },
  });
  const catApparel = await prisma.category.create({
    data: { name: 'Apparel', color: '#10b981' },
  });
  const catFood = await prisma.category.create({
    data: { name: 'Food & Beverage', color: '#f59e0b' },
  });
  const catPharma = await prisma.category.create({
    data: { name: 'Pharmaceuticals', color: '#8b5cf6' },
  });
  console.log('[Seed] Created categories.');

  // 5. Create Products
  const productsData = [
    // Electronics
    { name: 'UltraHD Smart TV 55"', sku: 'ELEC-1001', unitPrice: 499.99, categoryId: catElectronics.id, reorderPoint: 12, reorderQty: 40, safetyStock: 5 },
    { name: 'Wireless Noise-Cancelling Headphones', sku: 'ELEC-1002', unitPrice: 149.99, categoryId: catElectronics.id, reorderPoint: 20, reorderQty: 80, safetyStock: 10 },
    { name: 'Pro mechanical keyboard', sku: 'ELEC-1003', unitPrice: 89.99, categoryId: catElectronics.id, reorderPoint: 15, reorderQty: 50, safetyStock: 8 },
    
    // Apparel
    { name: 'Waterproof Mountain Parka', sku: 'APPR-2001', unitPrice: 119.99, categoryId: catApparel.id, reorderPoint: 15, reorderQty: 60, safetyStock: 7 },
    { name: 'Breathable Running Shoes', sku: 'APPR-2002', unitPrice: 79.99, categoryId: catApparel.id, reorderPoint: 25, reorderQty: 100, safetyStock: 12 },
    
    // Food
    { name: 'Organic Colombian Coffee Beans 1kg', sku: 'FOOD-3001', unitPrice: 18.50, categoryId: catFood.id, reorderPoint: 40, reorderQty: 150, safetyStock: 20 },
    { name: 'Premium Matcha Powder 250g', sku: 'FOOD-3002', unitPrice: 24.00, categoryId: catFood.id, reorderPoint: 8, reorderQty: 30, safetyStock: 4 }, // low stock seed
    
    // Pharma
    { name: 'Multivitamin Formula 180 Count', sku: 'PHAR-4001', unitPrice: 15.99, categoryId: catPharma.id, reorderPoint: 30, reorderQty: 120, safetyStock: 15 },
  ];

  const products: any[] = [];
  for (const p of productsData) {
    const prod = await prisma.product.create({
      data: {
        ...p,
        unit: 'units',
        barcodeUrl: p.sku,
        qrCodeUrl: `wms://product/${p.sku}`,
      },
    });
    products.push(prod);
  }
  console.log('[Seed] Created products.');

  // 6. Create Stock Levels
  // We place inventory at specific aisle/shelf/bin coordinate locations for the Heatmap.
  const stockLevels = [
    // TV
    { productId: products[0].id, warehouseId: whSeattle.id, quantity: 18, aisle: 'A', shelf: '01', bin: '12' },
    { productId: products[0].id, warehouseId: whChicago.id, quantity: 32, aisle: 'A', shelf: '02', bin: '15' },
    // Headphones
    { productId: products[1].id, warehouseId: whSeattle.id, quantity: 45, aisle: 'A', shelf: '04', bin: '01' },
    { productId: products[1].id, warehouseId: whChicago.id, quantity: 120, aisle: 'B', shelf: '01', bin: '03' },
    // Keyboard
    { productId: products[2].id, warehouseId: whSeattle.id, quantity: 22, aisle: 'B', shelf: '03', bin: '09' },
    // Parka
    { productId: products[3].id, warehouseId: whSeattle.id, quantity: 30, aisle: 'C', shelf: '01', bin: '05' },
    { productId: products[3].id, warehouseId: whChicago.id, quantity: 45, aisle: 'C', shelf: '02', bin: '08' },
    // Shoes
    { productId: products[4].id, warehouseId: whSeattle.id, quantity: 68, aisle: 'C', shelf: '04', bin: '14' },
    // Coffee
    { productId: products[5].id, warehouseId: whSeattle.id, quantity: 180, aisle: 'D', shelf: '01', bin: '20' },
    { productId: products[5].id, warehouseId: whChicago.id, quantity: 250, aisle: 'D', shelf: '02', bin: '22' },
    // Matcha (low stock: overall quantity 6 < reorderPoint 8)
    { productId: products[6].id, warehouseId: whSeattle.id, quantity: 6, aisle: 'D', shelf: '04', bin: '10' },
    // Multivitamin
    { productId: products[7].id, warehouseId: whSeattle.id, quantity: 85, aisle: 'E', shelf: '01', bin: '02' },
    { productId: products[7].id, warehouseId: whChicago.id, quantity: 110, aisle: 'E', shelf: '02', bin: '05' },
  ];

  for (const sl of stockLevels) {
    await prisma.stockLevel.create({ data: sl });
    // Log initial IN stock movements
    await prisma.stockMovement.create({
      data: {
        productId: sl.productId,
        warehouseId: sl.warehouseId,
        type: 'IN',
        quantity: sl.quantity,
        reason: 'Initial intake',
        reference: 'SEED',
      },
    });
  }
  console.log('[Seed] Created stock levels and movement history.');

  // 7. Create Historical Orders & Sales Movements to backpopulate graphs
  // We mock order dates spread over the last 6 months
  const now = new Date();
  
  const orderDetails = [
    { orderNumber: 'SO-10001', type: 'SALES', status: 'DELIVERED', customer: 'BestRetail Corp', totalAmount: 4349.82, date: new Date(new Date().setDate(now.getDate() - 30)), items: [{ prodIdx: 0, qty: 5 }, { prodIdx: 1, qty: 10 }, { prodIdx: 2, qty: 4 }] },
    { orderNumber: 'SO-10002', type: 'SALES', status: 'DELIVERED', customer: 'SuperApparel Inc', totalAmount: 2399.80, date: new Date(new Date().setDate(now.getDate() - 25)), items: [{ prodIdx: 3, qty: 20 }] },
    { orderNumber: 'PO-20001', type: 'PURCHASE', status: 'DELIVERED', supplier: 'EcoCoffee Source', totalAmount: 1850.00, date: new Date(new Date().setDate(now.getDate() - 20)), items: [{ prodIdx: 5, qty: 100 }] },
    { orderNumber: 'SO-10003', type: 'SALES', status: 'DELIVERED', customer: 'FitLife Shop', totalAmount: 3999.50, date: new Date(new Date().setDate(now.getDate() - 15)), items: [{ prodIdx: 4, qty: 50 }] },
    { orderNumber: 'SO-10004', type: 'SALES', status: 'DELIVERED', customer: 'BestRetail Corp', totalAmount: 2999.94, date: new Date(new Date().setDate(now.getDate() - 10)), items: [{ prodIdx: 0, qty: 6 }] },
    { orderNumber: 'SO-10005', type: 'SALES', status: 'PENDING', customer: 'GlobalElectronics Ltd', totalAmount: 4499.70, date: new Date(new Date().setDate(now.getDate() - 2)), items: [{ prodIdx: 0, qty: 9 }] },
    { orderNumber: 'PO-20002', type: 'PURCHASE', status: 'CONFIRMED', supplier: 'Hansa Pharma Inc', totalAmount: 3198.00, date: new Date(new Date().setDate(now.getDate() - 1)), items: [{ prodIdx: 7, qty: 200 }] },
  ];

  for (const o of orderDetails) {
    const itemsData = o.items.map((item) => ({
      productId: products[item.prodIdx].id,
      quantity: item.qty,
      unitPrice: products[item.prodIdx].unitPrice,
      total: item.qty * products[item.prodIdx].unitPrice,
    }));

    const createdOrder = await prisma.order.create({
      data: {
        orderNumber: o.orderNumber,
        type: o.type,
        status: o.status,
        customer: o.customer || null,
        supplier: o.supplier || null,
        totalAmount: o.totalAmount,
        orderDate: o.date,
        createdAt: o.date,
        updatedAt: o.date,
        items: {
          create: itemsData,
        },
      },
    });

    // If order was delivered, create stock movement entries matching dates
    if (o.status === 'DELIVERED') {
      for (const item of o.items) {
        await prisma.stockMovement.create({
          data: {
            productId: products[item.prodIdx].id,
            warehouseId: whSeattle.id, // Assume fulfilled from Seattle
            type: o.type === 'PURCHASE' ? 'IN' : 'OUT',
            quantity: item.qty,
            reason: `Order fulfillment: ${o.orderNumber}`,
            reference: createdOrder.id,
            date: o.date,
            createdAt: o.date,
          },
        });
      }
    }
  }
  console.log('[Seed] Created orders and historical transactions.');

  // 8. Create mock Forecast results
  const forecastDates = [30, 60, 90];
  for (const prod of products) {
    for (const horizon of forecastDates) {
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + horizon);
      
      await prisma.forecastResult.create({
        data: {
          productId: prod.id,
          forecastDate,
          predictedQty: prod.reorderPoint * (horizon === 30 ? 2.5 : horizon === 60 ? 4.8 : 7.2) * (1 + (Math.sin(horizon) * 0.1)),
          confidence: 0.84 + Math.random() * 0.1,
        },
      });
    }
  }
  console.log('[Seed] Generated demand forecasts.');

  // 9. Create an active Alert (Low Stock for premium matcha)
  await prisma.alert.create({
    data: {
      productId: products[6].id, // Matcha
      warehouseId: whSeattle.id,
      type: 'LOW_STOCK',
      severity: 'CRITICAL',
      title: 'Low stock alert: Premium Matcha Powder 250g',
      message: 'Premium Matcha Powder 250g (SKU: FOOD-3002) is running low. Total stock is 6, reorder point is 8.',
    },
  });
  console.log('[Seed] Created initial alerts.');

  console.log('[Seed] Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('[Seed] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
