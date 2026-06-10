import { Router } from 'express';
import {
  getWarehouses,
  getWarehouseById,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseHeatmap,
} from '../controllers/warehouseController';
import { protect, authorize } from '../middleware/authMiddleware';

const router = Router();

router.get('/', protect, getWarehouses);
router.get('/:id', protect, getWarehouseById);
router.post('/', protect, authorize('ADMIN'), createWarehouse);
router.put('/:id', protect, authorize('ADMIN'), updateWarehouse);
router.delete('/:id', protect, authorize('ADMIN'), deleteWarehouse);
router.get('/:id/heatmap', protect, getWarehouseHeatmap);

export default router;
