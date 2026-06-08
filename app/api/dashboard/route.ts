import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')

  if (!productId) {
    // Dashboard stats
    const [totalProducts, categories, warehouses, alerts] = await Promise.all([
      prisma.product.count(),
      prisma.category.findMany({
        include: { _count: { select: { products: true } } },
      }),
      prisma.warehouse.findMany({
        include: { stockLevels: true },
      }),
      prisma.alert.count({ where: { isResolved: false } }),
    ])

    const allStockLevels = await prisma.stockLevel.findMany({
      include: { product: true },
    })

    const totalStockValue = allStockLevels.reduce(
      (sum, sl) => sum + sl.quantity * sl.product.unitPrice,
      0
    )

    const lowStockProducts = await prisma.product.findMany({
      include: { stockLevels: true },
    })

    const lowStockCount = lowStockProducts.filter(p => {
      const total = p.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
      return total <= p.reorderPoint
    }).length

    return NextResponse.json({
      totalProducts,
      totalStockValue,
      lowStockCount,
      activeAlerts: alerts,
      categories: categories.map(c => ({ ...c, productCount: c._count.products })),
      warehouseUtilization: warehouses.map(w => ({
        name: w.name,
        location: w.location,
        capacity: w.capacity,
        used: w.stockLevels.reduce((s, sl) => s + sl.quantity, 0),
      })),
    })
  }

  // Specific product history for forecasting
  const movements = await prisma.stockMovement.findMany({
    where: { productId, type: 'OUT' },
    orderBy: { date: 'asc' },
    select: { date: true, quantity: true },
  })

  // Aggregate by day
  const byDay = new Map<string, number>()
  for (const m of movements) {
    const key = m.date.toISOString().split('T')[0]
    byDay.set(key, (byDay.get(key) || 0) + m.quantity)
  }

  const history = Array.from(byDay.entries()).map(([date, quantity]) => ({
    date,
    quantity,
  }))

  return NextResponse.json({ history })
}
