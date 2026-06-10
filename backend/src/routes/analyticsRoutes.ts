import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  getABCClassification,
  getSalesTrends,
  getInventoryTurnover,
} from '../controllers/analyticsController';

const router = Router();

router.use(authMiddleware);

router.get('/abc', getABCClassification);
router.get('/trends', getSalesTrends);
router.get('/turnover', getInventoryTurnover);

export default router;
