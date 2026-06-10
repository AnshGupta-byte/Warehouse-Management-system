import { Router } from 'express';
import {
  getForecasts,
  triggerForecasting,
  getReorderRecommendations,
} from '../controllers/forecastController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.get('/', protect, getForecasts);
router.post('/trigger', protect, triggerForecasting);
router.get('/reorder-recommendations', protect, getReorderRecommendations);

export default router;
