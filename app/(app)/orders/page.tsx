import { prisma } from '@/lib/prisma'
import OrdersClient from './OrdersClient'

export default async function OrdersPage() {
  const [ordersData, products] = await Promise.all([
    prisma.order.findMany({
      include: { items: { include: { product: true } } },
      orderBy: { orderDate: 'desc' },
      take: 50,
    }),
    prisma.product.findMany({ orderBy: { name: 'asc' } }),
  ])

  const total = await prisma.order.count()

  const orders = ordersData.map(o => ({
    ...o,
    orderDate: o.orderDate.toISOString(),
    expectedAt: o.expectedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }))

  return <OrdersClient orders={orders} total={total} products={products} />
}
