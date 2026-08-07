import { Router } from 'express';
import { asyncHandler } from '../../../utils/asyncHandler.util';
import { clearinghouseWebhookController } from './clearinghouse-webhook.controller';

const router = Router();

// External clearinghouse receivers intentionally do not use user JWT auth.
router.post('/acknowledgements', asyncHandler(clearinghouseWebhookController.acknowledgements));
router.post('/835', asyncHandler(clearinghouseWebhookController.era835));
router.post('/status', asyncHandler(clearinghouseWebhookController.claimStatus));
router.post('/events', asyncHandler(clearinghouseWebhookController.generic));

export default router;
