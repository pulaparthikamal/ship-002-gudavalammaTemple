import { Router } from 'express';
import * as postController from './post.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler.util';

const router = Router();

// Public (no auth) — called directly from email links
router.get('/approval/:token/approve', asyncHandler(postController.approvePostViaEmail));
router.get('/approval/:token/reject', asyncHandler(postController.rejectPostViaEmail));
// Preview page — opens full styled HTML with approve/reject buttons
router.get('/approval/:token/preview', asyncHandler(postController.getApprovalPreviewHtml));

// Legacy JSON routes (for programmatic / frontend use)
router.get('/approval/:token', asyncHandler(postController.getApprovalPreviewJson));
router.post('/approval/:token/approve', asyncHandler(postController.approvePost));
router.post('/approval/:token/reject', asyncHandler(postController.rejectPost));

router.use(authMiddleware);

router.get('/', asyncHandler(postController.getPosts));
router.get('/scheduled', asyncHandler(postController.getScheduledPosts));
router.get('/posted', asyncHandler(postController.getPostedPosts));
router.post('/', asyncHandler(postController.createPost));
router.post('/linkedin/publish', asyncHandler(postController.publishLinkedIn));
router.post('/:id/send-now', asyncHandler(postController.sendPostNow));
router.post('/:id/send-now-linkedin', asyncHandler(postController.sendLinkedInPostNow));
router.post('/:id/send-approval-email', asyncHandler(postController.sendApprovalEmail));
router.post('/bulk-delete', asyncHandler(postController.bulkDeletePosts));
router.post('/bulk-approve', asyncHandler(postController.bulkApproveById));
router.post('/bulk-reject', asyncHandler(postController.bulkRejectById));
router.put('/:id', asyncHandler(postController.updatePost));
router.delete('/:id', asyncHandler(postController.deletePost));


export default router;

