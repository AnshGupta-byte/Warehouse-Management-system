import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const session = await auth()

  // Server-side data fetch
  const products = await prisma.product.findMany({
    include: { category: true, stockLevels: true },
  })

  const orders = await prisma.order.findMany({
    orderBy: { orderDate: 'desc' },
    take: 50,
  })

  const alerts = await prisma.alert.count({ where: { isResolved: false } })

  const stockMovements = await prisma.stockMovement.findMany({
    where: {
      type: 'OUT',
      date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: { product: { include: { category: true } } },
    orderBy: { date: 'asc' },
  })

  // Compute stats
  const totalProducts = products.length
  const totalStockValue = products.reduce((sum, p) => {
    const totalStock = p.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
    return sum + totalStock * p.unitPrice
  }, 0)

  const lowStockCount = products.filter(p => {
    const total = p.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
    return total <= p.reorderPoint
  }).length

  const pendingOrders = orders.filter(o => ['PENDING', 'CONFIRMED', 'SHIPPED'].includes(o.status)).length
  const totalOrderValue = orders
    .filter(o => o.type === 'SALES')
    .reduce((s, o) => s + o.totalAmount, 0)

  // Category breakdown
  const categoryMap = new Map<string, { count: number; value: number; color: string }>()
  for (const p of products) {
    const cat = p.category.name
    const totalStock = p.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
    const existing = categoryMap.get(cat) || { count: 0, value: 0, color: p.category.color }
    categoryMap.set(cat, {
      count: existing.count + 1,
      value: existing.value + totalStock * p.unitPrice,
      color: p.category.color,
    })
  }
  const categoryData = Array.from(categoryMap.entries()).map(([name, v]) => ({ name, ...v }))

  // Daily movement chart (last 30 days)
  const dayMap = new Map<string, number>()
  for (const m of stockMovements) {
    const key = m.date.toISOString().split('T')[0]
    dayMap.set(key, (dayMap.get(key) || 0) + m.quantity)
  }
  const dailyMovement = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, quantity]) => ({ date: date.slice(5), quantity }))

  // Top movers
  const productMovement = new Map<string, { name: string; quantity: number; category: string }>()
  for (const m of stockMovements) {
    const existing = productMovement.get(m.productId) || {
      name: m.product.name,
      quantity: 0,
      category: m.product.category.name,
    }
    productMovement.set(m.productId, { ...existing, quantity: existing.quantity + m.quantity })
  }
  const topMovers = Array.from(productMovement.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  // Warehouse utilization
  const warehouses = await prisma.warehouse.findMany({
    include: { stockLevels: true },
  })
  const warehouseData = warehouses.map(w => ({
    name: w.name,
    location: w.location,
    capacity: w.capacity,
    used: w.stockLevels.reduce((s, sl) => s + sl.quantity, 0),
  }))

  return (
    <DashboardClient
      stats={{ totalProducts, totalStockValue, lowStockCount, pendingOrders, totalOrderValue, activeAlerts: alerts }}
      categoryData={categoryData}
      dailyMovement={dailyMovement}
      topMovers={topMovers}
      warehouseData={warehouseData}
      userName={session?.user?.name || 'User'}
    />
  )
}
