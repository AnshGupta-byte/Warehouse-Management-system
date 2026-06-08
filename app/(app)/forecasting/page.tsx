import { prisma } from '@/lib/prisma'
import ForecastingClient from './ForecastingClient'

export default async function ForecastingPage() {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { name: 'asc' },
  })

  return <ForecastingClient products={products} />
}
