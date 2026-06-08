import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@warehouse.com' },
    update: {},
    create: {
      email: 'admin@warehouse.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'admin',
    },
  })

  await prisma.user.upsert({
    where: { email: 'manager@warehouse.com' },
    update: {},
    create: {
      email: 'manager@warehouse.com',
      name: 'John Manager',
      password: await bcrypt.hash('manager123', 10),
      role: 'manager',
    },
  })

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: 'Electronics' }, update: {}, create: { name: 'Electronics', color: '#3b82f6' } }),
    prisma.category.upsert({ where: { name: 'Furniture' }, update: {}, create: { name: 'Furniture', color: '#8b5cf6' } }),
    prisma.category.upsert({ where: { name: 'Clothing' }, update: {}, create: { name: 'Clothing', color: '#ec4899' } }),
    prisma.category.upsert({ where: { name: 'Food & Beverage' }, update: {}, create: { name: 'Food & Beverage', color: '#f59e0b' } }),
    prisma.category.upsert({ where: { name: 'Tools & Hardware' }, update: {}, create: { name: 'Tools & Hardware', color: '#10b981' } }),
  ])

  // Create warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.upsert({
      where: { id: 'wh-main' },
      update: {},
      create: { id: 'wh-main', name: 'Main Warehouse', location: 'New York, NY', capacity: 10000 },
    }),
    prisma.warehouse.upsert({
      where: { id: 'wh-east' },
      update: {},
      create: { id: 'wh-east', name: 'East Coast Hub', location: 'Boston, MA', capacity: 5000 },
    }),
    prisma.warehouse.upsert({
      where: { id: 'wh-west' },
      update: {},
      create: { id: 'wh-west', name: 'West Coast Hub', location: 'Los Angeles, CA', capacity: 7500 },
    }),
  ])

  // Product definitions
  const productDefs = [
    { sku: 'ELEC-001', name: 'Laptop Pro 15"', cat: 0, price: 1299.99, reorder: 15, stock: [120, 45, 80] },
    { sku: 'ELEC-002', name: 'Wireless Headphones', cat: 0, price: 199.99, reorder: 30, stock: [8, 22, 15] },
    { sku: 'ELEC-003', name: '4K Monitor 27"', cat: 0, price: 549.99, reorder: 20, stock: [65, 30, 50] },
    { sku: 'ELEC-004', name: 'Mechanical Keyboard', cat: 0, price: 149.99, reorder: 25, stock: [200, 90, 140] },
    { sku: 'ELEC-005', name: 'USB-C Hub 7-port', cat: 0, price: 59.99, reorder: 40, stock: [350, 120, 200] },
    { sku: 'ELEC-006', name: 'Webcam HD 1080p', cat: 0, price: 89.99, reorder: 30, stock: [5, 18, 12] },
    { sku: 'ELEC-007', name: 'Smartphone Stand', cat: 0, price: 29.99, reorder: 50, stock: [400, 180, 250] },
    { sku: 'ELEC-008', name: 'Portable SSD 1TB', cat: 0, price: 109.99, reorder: 25, stock: [75, 35, 55] },
    { sku: 'FURN-001', name: 'Ergonomic Office Chair', cat: 1, price: 449.99, reorder: 10, stock: [30, 12, 20] },
    { sku: 'FURN-002', name: 'Standing Desk 60"', cat: 1, price: 799.99, reorder: 8, stock: [18, 7, 14] },
    { sku: 'FURN-003', name: 'Bookshelf 5-tier', cat: 1, price: 149.99, reorder: 15, stock: [45, 20, 35] },
    { sku: 'FURN-004', name: 'Filing Cabinet 3-drawer', cat: 1, price: 189.99, reorder: 12, stock: [28, 11, 20] },
    { sku: 'CLTH-001', name: 'Denim Jacket - M', cat: 2, price: 79.99, reorder: 20, stock: [150, 60, 100] },
    { sku: 'CLTH-002', name: 'Running Sneakers', cat: 2, price: 119.99, reorder: 25, stock: [3, 80, 55] },
    { sku: 'CLTH-003', name: 'Cotton T-Shirt Pack 3x', cat: 2, price: 34.99, reorder: 50, stock: [300, 140, 220] },
    { sku: 'CLTH-004', name: 'Wool Winter Coat', cat: 2, price: 199.99, reorder: 15, stock: [60, 25, 40] },
    { sku: 'CLTH-005', name: 'Sports Shorts', cat: 2, price: 29.99, reorder: 40, stock: [220, 100, 160] },
    { sku: 'FOOD-001', name: 'Organic Coffee Beans 1kg', cat: 3, price: 24.99, reorder: 100, stock: [500, 200, 350] },
    { sku: 'FOOD-002', name: 'Green Tea Pack 50-bag', cat: 3, price: 14.99, reorder: 80, stock: [7, 250, 190] },
    { sku: 'FOOD-003', name: 'Protein Powder 2kg', cat: 3, price: 49.99, reorder: 60, stock: [180, 75, 120] },
    { sku: 'FOOD-004', name: 'Olive Oil Extra Virgin 1L', cat: 3, price: 19.99, reorder: 120, stock: [4, 300, 220] },
    { sku: 'FOOD-005', name: 'Mixed Nuts 500g', cat: 3, price: 12.99, reorder: 150, stock: [600, 280, 450] },
    { sku: 'TOOL-001', name: 'Cordless Drill 18V', cat: 4, price: 149.99, reorder: 20, stock: [55, 22, 38] },
    { sku: 'TOOL-002', name: 'Screwdriver Set 50pc', cat: 4, price: 39.99, reorder: 30, stock: [120, 50, 85] },
    { sku: 'TOOL-003', name: 'Measuring Tape 25ft', cat: 4, price: 19.99, reorder: 50, stock: [200, 90, 150] },
    { sku: 'TOOL-004', name: 'Safety Goggles', cat: 4, price: 14.99, reorder: 40, stock: [9, 140, 100] },
    { sku: 'TOOL-005', name: 'Work Gloves L', cat: 4, price: 24.99, reorder: 60, stock: [280, 120, 200] },
    { sku: 'ELEC-009', name: 'Smart Watch Series 5', cat: 0, price: 299.99, reorder: 20, stock: [40, 18, 30] },
    { sku: 'ELEC-010', name: 'Bluetooth Speaker', cat: 0, price: 79.99, reorder: 35, stock: [90, 40, 65] },
    { sku: 'FURN-005', name: 'Monitor Riser Stand', cat: 1, price: 49.99, reorder: 25, stock: [110, 50, 80] },
  ]

  // Create products and stock levels
  for (const p of productDefs) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        sku: p.sku,
        name: p.name,
        categoryId: categories[p.cat].id,
        unitPrice: p.price,
        reorderPoint: p.reorder,
        reorderQty: p.reorder * 3,
        leadTimeDays: Math.floor(Math.random() * 7) + 3,
      },
    })

    for (let i = 0; i < warehouses.length; i++) {
      await prisma.stockLevel.upsert({
        where: { productId_warehouseId: { productId: product.id, warehouseId: warehouses[i].id } },
        update: { quantity: p.stock[i] },
        create: { productId: product.id, warehouseId: warehouses[i].id, quantity: p.stock[i] },
      })
    }

    // Generate 365 days of synthetic stock movement history
    const today = new Date()
    const movements = []
    for (let d = 365; d >= 0; d--) {
      const date = new Date(today)
      date.setDate(date.getDate() - d)
      // Simulate daily sales (OUT) with some seasonality
      const dayOfWeek = date.getDay()
      const month = date.getMonth()
      const baseQty = Math.max(1, Math.floor(p.reorder * 0.3))
      const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 1.5 : 1
      const seasonBoost = month === 11 || month === 0 ? 2 : month === 6 || month === 7 ? 1.3 : 1
      const noise = 0.7 + Math.random() * 0.6
      const qty = Math.max(1, Math.round(baseQty * weekendBoost * seasonBoost * noise))

      movements.push({
        productId: product.id,
        type: 'OUT',
        quantity: qty,
        reason: 'Sales order',
        date,
        createdAt: date,
      })

      // Occasional restocks
      if (Math.random() < 0.1) {
        movements.push({
          productId: product.id,
          type: 'IN',
          quantity: p.reorder * 3,
          reason: 'Purchase order',
          date,
          createdAt: date,
        })
      }
    }

    await prisma.stockMovement.createMany({ data: movements, skipDuplicates: true })
  }

  // Create sample orders
  const sampleProducts = await prisma.product.findMany({ take: 5 })
  await prisma.order.upsert({
    where: { orderNumber: 'PO-2024-001' },
    update: {},
    create: {
      orderNumber: 'PO-2024-001',
      type: 'PURCHASE',
      status: 'DELIVERED',
      supplier: 'TechSupply Co.',
      totalAmount: 15999.50,
      expectedAt: new Date('2024-01-15'),
      deliveredAt: new Date('2024-01-14'),
      items: {
        create: [
          { productId: sampleProducts[0].id, quantity: 10, unitPrice: sampleProducts[0].unitPrice, total: sampleProducts[0].unitPrice * 10 },
          { productId: sampleProducts[1].id, quantity: 20, unitPrice: sampleProducts[1].unitPrice, total: sampleProducts[1].unitPrice * 20 },
        ],
      },
    },
  })

  await prisma.order.upsert({
    where: { orderNumber: 'SO-2024-001' },
    update: {},
    create: {
      orderNumber: 'SO-2024-001',
      type: 'SALES',
      status: 'SHIPPED',
      supplier: 'RetailCorp Inc.',
      totalAmount: 4599.95,
      expectedAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          { productId: sampleProducts[2].id, quantity: 5, unitPrice: sampleProducts[2].unitPrice, total: sampleProducts[2].unitPrice * 5 },
        ],
      },
    },
  })

  // Create initial alerts
  const lowStockProducts = await prisma.product.findMany({
    include: { stockLevels: true },
    take: 3,
  })

  for (const prod of lowStockProducts) {
    const totalStock = prod.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
    if (totalStock < prod.reorderPoint * 2) {
      await prisma.alert.create({
        data: {
          productId: prod.id,
          type: 'LOW_STOCK',
          severity: totalStock < prod.reorderPoint ? 'CRITICAL' : 'WARNING',
          title: `Low Stock: ${prod.name}`,
          message: `Stock level (${totalStock}) is below reorder point (${prod.reorderPoint}). Consider placing a purchase order.`,
        },
      })
    }
  }

  console.log('✅ Database seeded successfully!')
  console.log('📧 Admin login: admin@warehouse.com / admin123')
  console.log('📧 Manager login: manager@warehouse.com / manager123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
