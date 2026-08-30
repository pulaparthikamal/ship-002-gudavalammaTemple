import { Router } from 'express';
import { pageContentController } from './pageContent.controller';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';
import {
  getPageContentSchema,
  saveDraftSchema,
  publishSchema,
  listVersionsSchema,
  restoreVersionSchema,
} from './pageContent.schema';

const router = Router();

// Public: the live devotee-facing screens render the published widget tree.
router.get('/:screenKey', validate(getPageContentSchema), asyncHandler(pageContentController.getPublished));

router.use(authMiddleware);

router.get(
  '/:screenKey/draft',
  permissionGuard('pageContent', 'View'),
  validate(getPageContentSchema),
  asyncHandler(pageContentController.getDraft)
);
router.put(
  '/:screenKey/draft',
  permissionGuard('pageContent', 'Update'),
  validate(saveDraftSchema),
  asyncHandler(pageContentController.saveDraft)
);
router.post(
  '/:screenKey/publish',
  permissionGuard('pageContent', 'Update'),
  validate(publishSchema),
  asyncHandler(pageContentController.publish)
);
router.get(
  '/:screenKey/versions',
  permissionGuard('pageContent', 'View'),
  validate(listVersionsSchema),
  asyncHandler(pageContentController.listVersions)
);
router.post(
  '/:screenKey/versions/:versionId/restore',
  permissionGuard('pageContent', 'Update'),
  validate(restoreVersionSchema),
  asyncHandler(pageContentController.restoreVersion)
);

export default router;
