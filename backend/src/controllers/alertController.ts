import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { broadcast } from '../services/websocketService';

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isResolved } = req.query;
    const whereClause: any = {};

    if (isResolved !== undefined) {
      whereClause.isResolved = isResolved === 'true';
    }

    const alerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      alerts,
    });
  } catch (error) {
    next(error);
  }
};

export const markAlertAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.update({
      where: { id },
      data: { isRead: true },
    });

    broadcast('ALERT_UPDATED', alert);
    res.status(200).json({
      success: true,
      alert,
    });
  } catch (error) {
    next(error);
  }
};

export const resolveAlert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.update({
      where: { id },
      data: { isResolved: true, isRead: true },
    });

    broadcast('ALERT_UPDATED', alert);
    res.status(200).json({
      success: true,
      alert,
    });
  } catch (error) {
    next(error);
  }
};
