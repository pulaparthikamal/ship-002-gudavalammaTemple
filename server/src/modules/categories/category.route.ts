import { Router } from 'express';
import * as categoryController from './category.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';

const router = Router();

router.use(authMiddleware);

router.post('/', asyncHandler(categoryController.createCategory));
router.get('/', asyncHandler(categoryController.getCategories));
router.get('/audience-suggestions', asyncHandler(categoryController.getAudienceSuggestions));
router.delete('/audience-suggestions/:value', asyncHandler(categoryController.deleteAudienceSuggestion));
router.put('/:id', asyncHandler(categoryController.updateCategory));
router.delete('/:id', asyncHandler(categoryController.deleteCategory));

export default router;

