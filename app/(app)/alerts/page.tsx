import { prisma } from '@/lib/prisma'
import AlertsClient from './AlertsClient'

export default async function AlertsPage() {
  // Trigger auto-generation of alerts
  const products = await prisma.product.findMany({ include: { stockLevels: true } })
  for (const product of products) {
    const totalStock = product.stockLevels.reduce((s, sl) => s + sl.quantity, 0)
    const existing = await prisma.alert.findFirst({ where: { productId: product.id, type: 'LOW_STOCK', isResolved: false } })
    if (totalStock <= product.reorderPoint && !existing) {
      await prisma.alert.create({
        data: {
          productId: product.id,
          type: 'LOW_STOCK',
          severity: totalStock === 0 ? 'CRITICAL' : totalStock <= product.reorderPoint * 0.5 ? 'CRITICAL' : 'WARNING',
          title: totalStock === 0 ? `Out of Stock: ${product.name}` : `Low Stock: ${product.name}`,
          message: totalStock === 0
            ? `${product.name} is completely out of stock! Immediate reorder of ${product.reorderQty} units required.`
            : `Stock (${totalStock} units) is below reorder point (${product.reorderPoint}). Consider ordering ${product.reorderQty} units.`,
        },
      })
    }
  }

  const alerts = await prisma.alert.findMany({
    where: { isResolved: false },
    include: { product: { include: { category: true } } },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  })

  const serialized = alerts.map(a => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    product: a.product ? {
      ...a.product,
      createdAt: a.product.createdAt.toISOString(),
      updatedAt: a.product.updatedAt.toISOString(),
    } : null,
  }))

  return <AlertsClient alerts={serialized} />
}
