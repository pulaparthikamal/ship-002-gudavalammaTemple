import { Router } from 'express';
import { appealController } from './appeal.controller';
import { validate } from '../../../middlewares/validate.middleware';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { permissionGuard } from '../../../middlewares/role.middleware';
import {
  appealActionSchema,
  appealCorrespondenceSchema,
  appealDocumentRemoveSchema,
  appealDocumentSchema,
  appealFinalPacketSchema,
  appealPayerRuleSchema,
  appealReadinessSchema,
  appealStatusSchema,
  appealTemplatePreviewSchema,
  appealTemplateSchema,
  appealTemplateStatusSchema,
  appealTemplateVersionSchema,
  appealSubmissionProofSchema,
  createAppealFromDenialSchema,
  createAppealSchema,
  updateAppealSchema,
} from './appeal.schema';

const router = Router();

router.use(authMiddleware);

router.get('/', permissionGuard('appeals', 'View'), asyncHandler(appealController.list));
router.get('/ops/dashboard', permissionGuard('appeals', 'View'), asyncHandler(appealController.getDashboard));
router.get('/templates', permissionGuard('appeals', 'View'), asyncHandler(appealController.listTemplates));
router.get('/payer-rules', permissionGuard('appeals', 'View'), asyncHandler(appealController.listPayerRules));
router.post('/payer-rules', permissionGuard('appeals', 'Add'), validate(appealPayerRuleSchema), asyncHandler(appealController.createPayerRule));
router.post('/templates', permissionGuard('appeals', 'Add'), validate(appealTemplateSchema), asyncHandler(appealController.createTemplate));
router.post('/templates/:templateId/version', permissionGuard('appeals', 'Add'), validate(appealTemplateVersionSchema), asyncHandler(appealController.createTemplateVersion));
router.patch('/templates/:templateId/activate', permissionGuard('appeals', 'Update'), validate(appealTemplateStatusSchema), asyncHandler(appealController.activateTemplate));
router.patch('/templates/:templateId/deactivate', permissionGuard('appeals', 'Update'), validate(appealTemplateStatusSchema), asyncHandler(appealController.deactivateTemplate));
router.post('/from-denial/:denialId', permissionGuard('appeals', 'Add'), validate(createAppealFromDenialSchema), asyncHandler(appealController.createFromDenial));
router.patch('/:id/status', permissionGuard('appeals', 'Update'), validate(appealStatusSchema), asyncHandler(appealController.changeStatus));
router.post('/:id/readiness', permissionGuard('appeals', 'Update'), validate(appealReadinessSchema), asyncHandler(appealController.runReadinessReview));
router.post('/:id/generate-packet', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.generatePacket));
router.post('/:id/generate-final-packet', permissionGuard('appeals', 'Update'), validate(appealFinalPacketSchema), asyncHandler(appealController.generateFinalPacket));
router.post('/:id/generate-ai-packet', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.generateAiPacket));
router.post('/:id/template-preview', permissionGuard('appeals', 'View'), validate(appealTemplatePreviewSchema), asyncHandler(appealController.previewTemplate));
router.post('/:id/documents', permissionGuard('appeals', 'Update'), validate(appealDocumentSchema), asyncHandler(appealController.addDocument));
router.patch('/:id/documents/:documentId/replace', permissionGuard('appeals', 'Update'), validate(appealDocumentSchema), asyncHandler(appealController.replaceDocument));
router.patch('/:id/documents/:documentId/remove', permissionGuard('appeals', 'Update'), validate(appealDocumentRemoveSchema), asyncHandler(appealController.removeDocument));
router.post('/:id/correspondence', permissionGuard('appeals', 'Update'), validate(appealCorrespondenceSchema), asyncHandler(appealController.recordCorrespondence));
router.post('/:id/submission-proof', permissionGuard('appeals', 'Update'), validate(appealSubmissionProofSchema), asyncHandler(appealController.recordSubmissionProof));
router.get('/:id/timeline', permissionGuard('appeals', 'View'), asyncHandler(appealController.getTimeline));
router.post('/:id/submit', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.submit));
router.post('/:id/record-payer-received', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.recordPayerReceived));
router.post('/:id/request-more-info', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.requestMoreInfo));
router.post('/:id/submit-evidence', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.submitEvidence));
router.post('/:id/record-outcome', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.recordOutcome));
router.post('/:id/close', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.close));
router.post('/:id/withdraw', permissionGuard('appeals', 'Update'), validate(appealActionSchema), asyncHandler(appealController.withdraw));
router.get('/:id', permissionGuard('appeals', 'View'), asyncHandler(appealController.getById));
router.post(
  '/',
  permissionGuard('appeals', 'Add'),
  validate(createAppealSchema),
  asyncHandler(appealController.create)
);
router.put(
  '/:id',
  permissionGuard('appeals', 'Update'),
  validate(updateAppealSchema),
  asyncHandler(appealController.update)
);
router.delete(
  '/:id',
  permissionGuard('appeals', 'Delete'),
  asyncHandler(appealController.delete)
);
router.post(
  '/bulk-delete',
  permissionGuard('appeals', 'Delete'),
  asyncHandler(appealController.bulkDelete)
);
router.patch(
  '/bulk-update',
  permissionGuard('appeals', 'Update'),
  asyncHandler(appealController.bulkUpdate)
);

export default router;
