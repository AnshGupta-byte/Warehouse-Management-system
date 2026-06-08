import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message } = await req.json()
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  // Gather live warehouse context
  const [products, alerts, recentMovements, orders] = await Promise.all([
    prisma.product.findMany({
      include: { category: true, stockLevels: true },
      orderBy: { name: 'asc' },
    }),
    prisma.alert.findMany({
      where: { isResolved: false },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.stockMovement.findMany({
      orderBy: { date: 'desc' },
      take: 100,
      include: { product: true },
    }),
    prisma.order.findMany({
      where: { status: { in: ['PENDING', 'CONFIRMED', 'SHIPPED'] } },
      include: { items: { include: { product: true } } },
      take: 10,
    }),
  ])

  const productSummary = products.map(p => {
    const totalStock = p.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
    return {
      name: p.name,
      sku: p.sku,
      category: p.category.name,
      totalStock,
      reorderPoint: p.reorderPoint,
      unitPrice: p.unitPrice,
      status: totalStock === 0 ? 'OUT_OF_STOCK' : totalStock <= p.reorderPoint ? 'LOW_STOCK' : 'OK',
    }
  })

  const contextPrompt = `
You are an AI warehouse management assistant with access to real-time inventory data.
Today's date: ${new Date().toISOString().split('T')[0]}

## Current Inventory Summary
Total Products: ${products.length}
Total Stock Value: $${productSummary.reduce((s, p) => s + p.totalStock * products.find(pr => pr.sku === p.sku)!.unitPrice, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
Low Stock Products: ${productSummary.filter(p => p.status === 'LOW_STOCK').length}
Out of Stock: ${productSummary.filter(p => p.status === 'OUT_OF_STOCK').length}
Active Alerts: ${alerts.length}

## Product Status
${productSummary.map(p => `- ${p.name} (${p.sku}): ${p.totalStock} units | Reorder at: ${p.reorderPoint} | Status: ${p.status}`).join('\n')}

## Active Alerts
${alerts.map(a => `- [${a.severity}] ${a.title}: ${a.message}`).join('\n')}

## Pending Orders
${orders.map(o => `- ${o.orderNumber} (${o.type}): ${o.status} | $${o.totalAmount}`).join('\n')}

Answer the following question concisely and helpfully. Use markdown formatting.
Focus on actionable insights. If you see problems, highlight them.
`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent([
      { text: contextPrompt },
      { text: `User question: ${message}` },
    ])

    const response = result.response.text()
    return NextResponse.json({ response, timestamp: new Date().toISOString() })
  } catch (error: any) {
    console.error('Gemini error:', error)
    return NextResponse.json(
      { error: 'AI service unavailable. Check your GEMINI_API_KEY.' },
      { status: 503 }
    )
  }
}
