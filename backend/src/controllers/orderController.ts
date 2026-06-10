import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AppError } from '../middleware/errorMiddleware';
import { broadcast } from '../services/websocketService';

export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, status } = req.query;
    const whereClause: any = {};

    if (type) {
      whereClause.type = type as string;
    }
    if (status) {
      whereClause.status = status as string;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, supplier, customer, expectedAt, notes, items } = req.body;

    if (!type || !items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('Please provide type and an array of items', 400));
    }

    if (!['PURCHASE', 'SALES'].includes(type)) {
      return next(new AppError('Order type must be PURCHASE or SALES', 400));
    }

    // Auto-generate order number
    const prefix = type === 'PURCHASE' ? 'PO' : 'SO';
    const timestamp = Date.now().toString().slice(-6);
    const rand = Math.floor(100 + Math.random() * 900);
    const orderNumber = `${prefix}-${timestamp}-${rand}`;

    // Verify products exist and calculate total amount
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return next(new AppError(`Product with ID ${item.productId} not found`, 404));
      }

      const qty = parseInt(item.quantity, 10);
      const price = parseFloat(item.unitPrice || product.unitPrice);
      const total = qty * price;
      totalAmount += total;

      orderItemsData.push({
        productId: item.productId,
        quantity: qty,
        unitPrice: price,
        total,
      });
    }

    const newOrder = await prisma.order.create({
      data: {
        orderNumber,
        type,
        status: 'PENDING',
        supplier: type === 'PURCHASE' ? supplier : null,
        customer: type === 'SALES' ? customer : null,
        totalAmount,
        expectedAt: expectedAt ? new Date(expectedAt) : null,
        notes,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    broadcast('ORDER_CREATED', newOrder);
    res.status(201).json({
      success: true,
      order: newOrder,
    });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, warehouseId } = req.body; // warehouseId is required if transitioning to DELIVERED

    if (!status) {
      return next(new AppError('Please provide order status', 400));
    }

    const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return next(new AppError('Invalid order status', 400));
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // If order is already completed, prevent status changes
    if (order.status === 'DELIVERED') {
      return next(new AppError('Cannot update status of a delivered order', 400));
    }
    if (order.status === 'CANCELLED') {
      return next(new AppError('Cannot update status of a cancelled order', 400));
    }

    let resolvedWarehouseId = warehouseId;
    if (status === 'DELIVERED') {
      // Find a default warehouse if none specified
      if (!resolvedWarehouseId) {
        const wh = await prisma.warehouse.findFirst();
        if (!wh) {
          return next(new AppError('No warehouses found in database to fulfill stock adjustment', 400));
        }
        resolvedWarehouseId = wh.id;
      } else {
        const whExists = await prisma.warehouse.findUnique({ where: { id: resolvedWarehouseId } });
        if (!whExists) {
          return next(new AppError('Selected warehouse does not exist', 404));
        }
      }
    }

    // Use Prisma transaction to update order status and adjust stock levels
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id },
        data: {
          status,
          deliveredAt: status === 'DELIVERED' ? new Date() : null,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Adjust stock levels only if status becomes DELIVERED
      if (status === 'DELIVERED') {
        for (const item of order.items) {
          const productId = item.productId;
          const qty = item.quantity;

          // Find existing stock level
          let stockLevel = await tx.stockLevel.findUnique({
            where: { productId_warehouseId: { productId, warehouseId: resolvedWarehouseId } },
          });

          let newQty = stockLevel ? stockLevel.quantity : 0;
          const movementType = order.type === 'PURCHASE' ? 'IN' : 'OUT';

          if (movementType === 'IN') {
            newQty += qty;
          } else {
            if (newQty < qty) {
              throw new Error(`Insufficient stock for product ${productId} in warehouse ${resolvedWarehouseId}`);
            }
            newQty -= qty;
          }

          // Update or create stock level
          if (!stockLevel) {
            await tx.stockLevel.create({
              data: {
                productId,
                warehouseId: resolvedWarehouseId,
                quantity: newQty,
                aisle: 'A',
                shelf: '01',
                bin: '01',
              },
            });
          } else {
            await tx.stockLevel.update({
              where: { id: stockLevel.id },
              data: { quantity: newQty },
            });
          }

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              productId,
              warehouseId: resolvedWarehouseId,
              type: movementType,
              quantity: qty,
              reason: `Order fulfillment: ${order.orderNumber}`,
              reference: order.id,
            },
          });
        }
      }

      return updated;
    });

    broadcast('ORDER_UPDATED', updatedOrder);
    
    // Broadcast stock levels again if delivered
    if (status === 'DELIVERED') {
      const updatedStockLevels = await prisma.stockLevel.findMany({
        where: { warehouseId: resolvedWarehouseId },
        include: { product: true },
      });
      broadcast('WMS_STOCK_LEVELS_REFRESH', { warehouseId: resolvedWarehouseId, stockLevels: updatedStockLevels });
    }

    res.status(200).json({
      success: true,
      order: updatedOrder,
    });
  } catch (error: any) {
    if (error.message && error.message.includes('Insufficient stock')) {
      return next(new AppError(error.message, 400));
    }
    next(error);
  }
};
