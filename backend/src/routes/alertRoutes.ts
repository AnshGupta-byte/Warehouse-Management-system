import { Router } from 'express';
import { getAlerts, markAlertAsRead, resolveAlert } from '../controllers/alertController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.get('/', protect, getAlerts);
router.put('/:id/read', protect, markAlertAsRead);
router.put('/:id/resolve', protect, resolveAlert);

export default router;
