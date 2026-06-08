import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { rows } = body // Array of CSV row objects

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No data provided' }, { status: 400 })
  }

  const results = { created: 0, updated: 0, errors: [] as string[] }

  for (const row of rows) {
    try {
      const { sku, name, category, unit_price, reorder_point, reorder_qty, stock_main } = row

      if (!sku || !name) {
        results.errors.push(`Row missing SKU or name: ${JSON.stringify(row)}`)
        continue
      }

      // Find or create category
      const categoryRecord = await prisma.category.upsert({
        where: { name: category || 'Uncategorized' },
        update: {},
        create: {
          name: category || 'Uncategorized',
          color: '#6b7280',
        },
      })

      // Upsert product
      const existing = await prisma.product.findUnique({ where: { sku } })

      if (existing) {
        await prisma.product.update({
          where: { sku },
          data: {
            name,
            categoryId: categoryRecord.id,
            unitPrice: parseFloat(unit_price) || existing.unitPrice,
            reorderPoint: parseInt(reorder_point) || existing.reorderPoint,
            reorderQty: parseInt(reorder_qty) || existing.reorderQty,
          },
        })
        results.updated++
      } else {
        const product = await prisma.product.create({
          data: {
            sku,
            name,
            categoryId: categoryRecord.id,
            unitPrice: parseFloat(unit_price) || 0,
            reorderPoint: parseInt(reorder_point) || 10,
            reorderQty: parseInt(reorder_qty) || 50,
          },
        })

        // Set initial stock if provided
        if (stock_main) {
          const mainWh = await prisma.warehouse.findFirst({ where: { name: 'Main Warehouse' } })
          if (mainWh) {
            await prisma.stockLevel.create({
              data: {
                productId: product.id,
                warehouseId: mainWh.id,
                quantity: parseInt(stock_main) || 0,
              },
            })
          }
        }
        results.created++
      }
    } catch (e: any) {
      results.errors.push(`Error processing row: ${e.message}`)
    }
  }

  return NextResponse.json({
    message: `Import complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`,
    ...results,
  })
}
