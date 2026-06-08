import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { productId, forecastDays = 90 } = await req.json()

  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 })
  }

  // Get product info
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Get sales history
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

  if (history.length < 14) {
    return NextResponse.json(
      { error: 'Insufficient history data (need at least 14 days)' },
      { status: 422 }
    )
  }

  try {
    // Call Python AI service
    const aiResponse = await fetch(`${AI_SERVICE_URL}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        product_name: product.name,
        history,
        forecast_days: forecastDays,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!aiResponse.ok) {
      const err = await aiResponse.text()
      return NextResponse.json({ error: `AI service error: ${err}` }, { status: 502 })
    }

    const forecastData = await aiResponse.json()

    // Save forecast to DB
    await prisma.forecastResult.deleteMany({ where: { productId } })
    await prisma.forecastResult.createMany({
      data: forecastData.forecast.map((f: any) => ({
        productId,
        forecastDate: new Date(f.date),
        predictedQty: f.predicted,
        lowerBound: f.lower,
        upperBound: f.upper,
      })),
    })

    // Generate reorder recommendation
    const totalPredicted = forecastData.summary.total_predicted
    const currentStock = await prisma.stockLevel.aggregate({
      where: { productId },
      _sum: { quantity: true },
    })
    const stock = currentStock._sum.quantity || 0
    const reorderRecommendation = stock < totalPredicted / (forecastDays / 30)
      ? `⚠️ Current stock (${stock}) may be insufficient. Consider ordering ${Math.max(0, Math.ceil(totalPredicted - stock))} units.`
      : `✅ Current stock (${stock}) appears sufficient for the forecast period.`

    return NextResponse.json({
      product: { id: product.id, name: product.name, sku: product.sku },
      currentStock: stock,
      forecast: forecastData.forecast,
      summary: forecastData.summary,
      modelUsed: forecastData.model_used,
      recommendation: reorderRecommendation,
    })
  } catch (err: any) {
    if (err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'AI service timeout' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Failed to reach AI service. Is it running?' }, { status: 503 })
  }
}
