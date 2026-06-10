import { Router } from 'express';
import { getOrders, createOrder, updateOrderStatus } from '../controllers/orderController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.get('/', protect, getOrders);
router.post('/', protect, createOrder);
router.put('/:id/status', protect, updateOrderStatus);

export default router;
