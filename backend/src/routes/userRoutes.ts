import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/authMiddleware';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/userController';

const router = Router();

router.use(authMiddleware, adminOnly);

router.get('/', listUsers);
router.get('/:id', getUser);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
