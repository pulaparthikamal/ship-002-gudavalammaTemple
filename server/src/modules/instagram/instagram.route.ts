import { Router } from 'express';
import { instagramController } from './instagram.controller';

const router = Router();

router.get('/', instagramController.login);
router.get('/callback', instagramController.callback);
router.get('/accounts', instagramController.getAccounts);

export default router;
