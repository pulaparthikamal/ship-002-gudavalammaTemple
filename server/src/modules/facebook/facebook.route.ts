import { Router } from 'express';
import { facebookController } from './facebook.controller';

const router = Router();

// These routes will be mounted at /auth/facebook in app.ts
router.get('/', facebookController.login);
router.get('/callback', facebookController.callback);
router.get('/pages', facebookController.getPages);
router.post('/pages/active', facebookController.setActivePage);
router.post('/post', facebookController.postToPage);

export default router;
