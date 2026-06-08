import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '10')
  const type = searchParams.get('type') || ''
  const status = searchParams.get('status') || ''

  const where: any = {}
  if (type) where.type = type
  if (status) where.status = status

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: {
          include: { product: { include: { category: true } } },
        },
      },
      orderBy: { orderDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ])

  return NextResponse.json({ orders, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { type, supplier, items, expectedAt, notes } = body

  if (!type || !items?.length) {
    return NextResponse.json({ error: 'Type and items required' }, { status: 400 })
  }

  const orderNumber = `${type === 'PURCHASE' ? 'PO' : 'SO'}-${Date.now()}`
  const totalAmount = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0)

  const order = await prisma.order.create({
    data: {
      orderNumber,
      type,
      supplier,
      totalAmount,
      expectedAt: expectedAt ? new Date(expectedAt) : undefined,
      notes,
      items: {
        create: items.map((i: any) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.quantity * i.unitPrice,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  })

  return NextResponse.json(order, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, deliveredAt } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  const order = await prisma.order.update({
    where: { id },
    data: {
      status,
      deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
    },
    include: { items: { include: { product: true } } },
  })

  // If PURCHASE order delivered, update stock
  if (status === 'DELIVERED' && order.type === 'PURCHASE') {
    const mainWarehouse = await prisma.warehouse.findFirst({ where: { name: 'Main Warehouse' } })
    if (mainWarehouse) {
      for (const item of order.items) {
        await prisma.stockLevel.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: mainWarehouse.id } },
          update: { quantity: { increment: item.quantity } },
          create: { productId: item.productId, warehouseId: mainWarehouse.id, quantity: item.quantity },
        })
        await prisma.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            reason: `Purchase Order: ${order.orderNumber}`,
            reference: order.orderNumber,
          },
        })
      }
    }
  }

  return NextResponse.json(order)
}
