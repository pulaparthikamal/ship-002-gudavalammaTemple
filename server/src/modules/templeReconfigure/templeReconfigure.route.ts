import { Router } from 'express';
import { templeReconfigureController } from './templeReconfigure.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import { resetCatalogSchema } from './templeReconfigure.schema';

const router = Router();

router.use(authMiddleware);

// Not exposed to any role by default in roles.constants.ts — SUPER_ADMIN bypasses
// permissionGuard entirely, so this is effectively SUPER_ADMIN-only, deliberately
// (this endpoint deletes catalog data).
router.get('/catalogs', permissionGuard('templeReconfigure', 'View'), asyncHandler(templeReconfigureController.listCatalogs));
router.post('/reset-catalog', permissionGuard('templeReconfigure', 'Update'), validate(resetCatalogSchema), asyncHandler(templeReconfigureController.resetCatalog));

export default router;
