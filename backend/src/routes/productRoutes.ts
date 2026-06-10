import { Router } from 'express';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getCategories,
  createCategory,
} from '../controllers/productController';
import { protect, authorize } from '../middleware/authMiddleware';

const router = Router();

router.get('/', protect, getProducts);
router.post('/', protect, authorize('ADMIN', 'MANAGER'), createProduct);
router.put('/:id', protect, authorize('ADMIN', 'MANAGER'), updateProduct);
router.delete('/:id', protect, authorize('ADMIN'), deleteProduct);
router.post('/adjust-stock', protect, adjustStock);

router.get('/categories', protect, getCategories);
router.post('/categories', protect, authorize('ADMIN', 'MANAGER'), createCategory);

export default router;
