import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AppError } from '../middleware/errorMiddleware';

export const getWarehouses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        _count: {
          select: { stockLevels: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      warehouses,
    });
  } catch (error) {
    next(error);
  }
};

export const getWarehouseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        stockLevels: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    res.status(200).json({
      success: true,
      warehouse,
    });
  } catch (error) {
    next(error);
  }
};

export const createWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, location, capacity } = req.body;

    if (!name || !location || !capacity) {
      return next(new AppError('Please provide name, location, and capacity', 400));
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name,
        location,
        capacity: parseInt(capacity, 10),
      },
    });

    res.status(201).json({
      success: true,
      warehouse,
    });
  } catch (error) {
    next(error);
  }
};

export const updateWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, location, capacity } = req.body;

    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('Warehouse not found', 404));
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        name: name || undefined,
        location: location || undefined,
        capacity: capacity ? parseInt(capacity, 10) : undefined,
      },
    });

    res.status(200).json({
      success: true,
      warehouse: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('Warehouse not found', 404));
    }

    await prisma.warehouse.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: 'Warehouse deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getWarehouseHeatmap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        stockLevels: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                category: {
                  select: { name: true, color: true },
                },
              },
            },
          },
        },
      },
    });

    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    // Heatmap grid parameters
    // We mock a grid map with aisles A, B, C, D, E and shelves 01, 02, 03, 04, 05
    const aisles = ['A', 'B', 'C', 'D', 'E'];
    const shelves = ['01', '02', '03', '04', '05'];
    
    // Create grid map
    const grid: any[] = [];
    
    aisles.forEach((aisle) => {
      shelves.forEach((shelf) => {
        // Find matching stock levels in this grid cell
        const items = warehouse.stockLevels.filter(
          (sl) => sl.aisle === aisle && sl.shelf === shelf
        );

        const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
        
        // Calculate utilization based on max capacity per shelf slot (e.g. 500 units per shelf slot)
        const slotCapacity = 500;
        const utilization = Math.min((totalQty / slotCapacity) * 100, 100);

        grid.push({
          aisle,
          shelf,
          label: `${aisle}-${shelf}`,
          totalQuantity: totalQty,
          utilization: parseFloat(utilization.toFixed(2)),
          products: items.map((sl) => ({
            productId: sl.productId,
            name: sl.product.name,
            sku: sl.product.sku,
            quantity: sl.quantity,
            bin: sl.bin,
            category: sl.product.category.name,
            color: sl.product.category.color,
          })),
        });
      });
    });

    res.status(200).json({
      success: true,
      warehouse: {
        id: warehouse.id,
        name: warehouse.name,
        capacity: warehouse.capacity,
      },
      heatmap: grid,
    });
  } catch (error) {
    next(error);
  }
};
