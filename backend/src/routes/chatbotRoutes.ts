import { Router } from 'express';
import { handleChatQuery } from '../controllers/chatbotController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/', protect, handleChatQuery);

export default router;
