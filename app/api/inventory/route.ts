import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const lowStock = searchParams.get('lowStock') === 'true'

  const where: any = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ]
  }
  if (category) where.categoryId = category

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      stockLevels: { include: { warehouse: true } },
    },
    orderBy: { name: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  })

  const total = await prisma.product.count({ where })

  // Filter low stock after join
  const result = products.map(p => {
    const totalStock = p.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
    return { ...p, totalStock }
  })

  const filtered = lowStock ? result.filter(p => p.totalStock <= p.reorderPoint) : result

  return NextResponse.json({ products: filtered, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { sku, name, description, categoryId, unitPrice, reorderPoint, reorderQty, leadTimeDays } = body

  if (!sku || !name || !categoryId || !unitPrice) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const product = await prisma.product.create({
      data: { sku, name, description, categoryId, unitPrice, reorderPoint, reorderQty, leadTimeDays },
      include: { category: true },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
