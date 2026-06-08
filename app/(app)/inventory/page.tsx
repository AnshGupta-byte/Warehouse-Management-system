import { prisma } from '@/lib/prisma'
import InventoryClient from './InventoryClient'

export default async function InventoryPage() {
  const [productsData, categories] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: true,
        stockLevels: { include: { warehouse: true } },
      },
      orderBy: { name: 'asc' },
      take: 50,
    }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ])

  const total = await prisma.product.count()

  const products = productsData.map(p => ({
    ...p,
    totalStock: p.stockLevels.reduce((s, sl) => s + sl.quantity, 0),
  }))

  return <InventoryClient products={products} categories={categories} total={total} />
}
