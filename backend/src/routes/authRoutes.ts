import { Router } from 'express';
import { login, register, getMe } from '../controllers/authController';
import { protect, authorize } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', login);
router.post('/register', protect, authorize('ADMIN'), register);
router.get('/me', protect, getMe);

export default router;
