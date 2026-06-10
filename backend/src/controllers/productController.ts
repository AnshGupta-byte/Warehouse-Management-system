import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AppError } from '../middleware/errorMiddleware';
import { broadcast } from '../services/websocketService';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, page = '1', limit = '100' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};

    if (category) {
      whereClause.categoryId = category as string;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: true,
          stockLevels: {
            include: {
              warehouse: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      prisma.product.count({ where: whereClause }),
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      products,
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      description,
      categoryId,
      unit,
      unitPrice,
      reorderPoint,
      reorderQty,
      safetyStock,
      sku,
      initialStocks, // Array of { warehouseId: string, quantity: number, aisle?: string, shelf?: string, bin?: string }
    } = req.body;

    if (!name || !categoryId || !unitPrice) {
      return next(new AppError('Please provide name, categoryId, and unitPrice', 400));
    }

    // Generate SKU if not provided
    let finalSku = sku;
    if (!finalSku) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      const prefix = category ? category.name.substring(0, 3).toUpperCase() : 'PRD';
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      finalSku = `${prefix}-${randomNum}`;
    }

    // Check SKU uniqueness
    const skuExists = await prisma.product.findUnique({ where: { sku: finalSku } });
    if (skuExists) {
      return next(new AppError('A product with this SKU already exists', 400));
    }

    // QR & Barcode mocks (storing the text value to render dynamically in frontend)
    const barcodeUrl = finalSku;
    const qrCodeUrl = `wms://product/${finalSku}`;

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        categoryId,
        unit: unit || 'units',
        unitPrice: parseFloat(unitPrice),
        reorderPoint: reorderPoint ? parseInt(reorderPoint) : 10,
        reorderQty: reorderQty ? parseInt(reorderQty) : 50,
        safetyStock: safetyStock ? parseInt(safetyStock) : 5,
        sku: finalSku,
        barcodeUrl,
        qrCodeUrl,
      },
      include: {
        category: true,
      },
    });

    // Create initial stock levels and movements
    if (initialStocks && Array.isArray(initialStocks)) {
      for (const stock of initialStocks) {
        const qty = parseInt(stock.quantity) || 0;
        if (qty > 0) {
          await prisma.stockLevel.create({
            data: {
              productId: newProduct.id,
              warehouseId: stock.warehouseId,
              quantity: qty,
              aisle: stock.aisle || 'A',
              shelf: stock.shelf || '01',
              bin: stock.bin || '01',
            },
          });

          await prisma.stockMovement.create({
            data: {
              productId: newProduct.id,
              warehouseId: stock.warehouseId,
              type: 'IN',
              quantity: qty,
              reason: 'Initial stock intake',
              reference: 'SETUP',
            },
          });
        }
      }
    }

    const createdProduct = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: {
        category: true,
        stockLevels: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    broadcast('PRODUCT_CREATED', createdProduct);
    res.status(201).json({
      success: true,
      product: createdProduct,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      categoryId,
      unit,
      unitPrice,
      reorderPoint,
      reorderQty,
      safetyStock,
    } = req.body;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return next(new AppError('Product not found', 404));
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        categoryId: categoryId || undefined,
        unit: unit || undefined,
        unitPrice: unitPrice ? parseFloat(unitPrice) : undefined,
        reorderPoint: reorderPoint ? parseInt(reorderPoint) : undefined,
        reorderQty: reorderQty ? parseInt(reorderQty) : undefined,
        safetyStock: safetyStock ? parseInt(safetyStock) : undefined,
      },
      include: {
        category: true,
        stockLevels: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    broadcast('PRODUCT_UPDATED', updated);
    res.status(200).json({
      success: true,
      product: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return next(new AppError('Product not found', 404));
    }

    await prisma.product.delete({ where: { id } });

    broadcast('PRODUCT_DELETED', { id });
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId, warehouseId, type, quantity, reason, reference, aisle, shelf, bin } = req.body;

    if (!productId || !warehouseId || !type || quantity === undefined) {
      return next(new AppError('Please provide productId, warehouseId, type, and quantity', 400));
    }

    if (!['IN', 'OUT', 'ADJUSTMENT'].includes(type)) {
      return next(new AppError('Type must be IN, OUT, or ADJUSTMENT', 400));
    }

    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      return next(new AppError('Quantity must be greater than 0', 400));
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return next(new AppError('Product not found', 404));
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) {
      return next(new AppError('Warehouse not found', 404));
    }

    // Find or create stock level
    let stockLevel = await prisma.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    let newQuantity = stockLevel ? stockLevel.quantity : 0;

    if (type === 'IN') {
      newQuantity += qty;
    } else if (type === 'OUT') {
      if (newQuantity < qty) {
        return next(new AppError('Insufficient stock levels in this warehouse', 400));
      }
      newQuantity -= qty;
    } else { // ADJUSTMENT
      // In adjustment, quantity is the final target quantity, or we can adjust by offset. Let's do absolute replacement for adjustment
      newQuantity = qty;
    }

    if (!stockLevel) {
      stockLevel = await prisma.stockLevel.create({
        data: {
          productId,
          warehouseId,
          quantity: newQuantity,
          aisle: aisle || 'A',
          shelf: shelf || '01',
          bin: bin || '01',
        },
      });
    } else {
      stockLevel = await prisma.stockLevel.update({
        where: { id: stockLevel.id },
        data: {
          quantity: newQuantity,
          aisle: aisle || stockLevel.aisle,
          shelf: shelf || stockLevel.shelf,
          bin: bin || stockLevel.bin,
        },
      });
    }

    // Log movement
    await prisma.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type,
        quantity: qty,
        reason,
        reference,
      },
    });

    // Check if new stock levels trigger low-stock alerts
    const totalStock = await prisma.stockLevel.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    
    const overallQty = totalStock._sum.quantity || 0;
    if (overallQty <= product.reorderPoint) {
      // Trigger low stock alert
      const existingAlert = await prisma.alert.findFirst({
        where: { productId, type: 'LOW_STOCK', isResolved: false },
      });

      if (!existingAlert) {
        const newAlert = await prisma.alert.create({
          data: {
            productId,
            warehouseId,
            type: 'LOW_STOCK',
            severity: 'CRITICAL',
            title: `Low stock alert: ${product.name}`,
            message: `${product.name} (SKU: ${product.sku}) is running low. Total stock is ${overallQty}, reorder point is ${product.reorderPoint}.`,
          },
        });
        broadcast('ALERT_CREATED', newAlert);
      }
    }

    const updatedProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        stockLevels: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    broadcast('STOCK_UPDATED', { productId, warehouseId, stockLevel, product: updatedProduct });
    
    res.status(200).json({
      success: true,
      stockLevel,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return next(new AppError('Please provide a category name', 400));
    }
    const cat = await prisma.category.create({
      data: { name, color: color || '#3b82f6' },
    });
    res.status(201).json({
      success: true,
      category: cat,
    });
  } catch (error) {
    next(error);
  }
};
