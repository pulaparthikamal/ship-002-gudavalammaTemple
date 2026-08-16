import { Router } from 'express';
import { bookingController } from './booking.controller';
import { asyncHandler } from '../../utils/asyncHandler.util';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { permissionGuard } from '../../middlewares/role.middleware';

const router = Router();

// Public: guests (no persistent session — see guestCheckout.util.ts) can
// still self-report their UPI payment reference for the booking/order/
// donation they just created, looked up by refId rather than requiring auth.
router.patch('/by-ref/:refId/payment-reference', asyncHandler(bookingController.submitPaymentReference));

router.use(authMiddleware);

// Fixed sub-paths registered before the '/:id' param routes.
router.get('/all', permissionGuard('bookingLedger', 'View'), asyncHandler(bookingController.listAll));
router.patch('/:id/mark-paid', permissionGuard('bookingLedger', 'Update'), asyncHandler(bookingController.markPaid));

router.get('/', asyncHandler(bookingController.list));
router.post('/:id/cancel', asyncHandler(bookingController.cancel));
router.get('/:id/receipt', asyncHandler(bookingController.receipt));

export default router;
