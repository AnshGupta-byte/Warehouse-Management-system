import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === 'true'

  const alerts = await prisma.alert.findMany({
    where: {
      isResolved: false,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    include: { product: { include: { category: true } } },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  })

  // Auto-generate new low-stock alerts
  await generateAlerts()

  return NextResponse.json(alerts)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action } = await req.json()

  if (action === 'read') {
    await prisma.alert.update({ where: { id }, data: { isRead: true } })
  } else if (action === 'resolve') {
    await prisma.alert.update({ where: { id }, data: { isResolved: true, isRead: true } })
  } else if (action === 'resolve_all') {
    await prisma.alert.updateMany({ data: { isResolved: true, isRead: true } })
  }

  return NextResponse.json({ success: true })
}

async function generateAlerts() {
  const products = await prisma.product.findMany({
    include: { stockLevels: true },
  })

  for (const product of products) {
    const totalStock = product.stockLevels.reduce((s, sl) => s + sl.quantity, 0)

    // Check for existing unresolved alert of same type
    const existing = await prisma.alert.findFirst({
      where: { productId: product.id, type: 'LOW_STOCK', isResolved: false },
    })

    if (totalStock === 0 && !existing) {
      await prisma.alert.create({
        data: {
          productId: product.id,
          type: 'LOW_STOCK',
          severity: 'CRITICAL',
          title: `Out of Stock: ${product.name}`,
          message: `Product is completely out of stock! Immediate reorder required.`,
        },
      })
    } else if (totalStock > 0 && totalStock <= product.reorderPoint && !existing) {
      await prisma.alert.create({
        data: {
          productId: product.id,
          type: 'LOW_STOCK',
          severity: totalStock <= product.reorderPoint * 0.5 ? 'CRITICAL' : 'WARNING',
          title: `Low Stock: ${product.name}`,
          message: `Stock (${totalStock} units) is below reorder point (${product.reorderPoint}). Consider placing a purchase order of ${product.reorderQty} units.`,
        },
      })
    }

    // Clear resolved alert if stock recovered
    if (totalStock > product.reorderPoint && existing) {
      await prisma.alert.update({
        where: { id: existing.id },
        data: { isResolved: true },
      })
    }
  }
}
