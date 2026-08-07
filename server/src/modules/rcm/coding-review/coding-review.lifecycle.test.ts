import { CodingReview } from './coding-review.model';
import { codingReviewService } from './coding-review.service';
import { codingReviewController } from './coding-review.controller';

describe('codingReview lifecycle protections', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks generic manual coding review creation', async () => {
    await expect(codingReviewService.create({
      chargeId: 'charge-1',
      encounterId: 'encounter-1',
      patientId: 'patient-1',
    }, 'en', 'user-1')).rejects.toThrow('system-generated');
  });

  it('blocks generic coding review deletion', async () => {
    jest.spyOn(CodingReview, 'findOne').mockResolvedValue({ _id: 'review-1' } as any);

    await expect(codingReviewService.softDelete('review-1', 'en', 'user-1'))
      .rejects.toThrow('append-only workflow records');
  });

  it('routes bulk delete through the protected lifecycle service', async () => {
    const req = { body: { ids: ['review-1'] }, locale: 'en', user: { _id: 'user-1' } } as any;
    const res = { json: jest.fn() } as any;
    jest.spyOn(codingReviewService, 'softDelete').mockRejectedValue(new Error('blocked'));

    await expect(codingReviewController.bulkDelete(req, res)).rejects.toThrow('blocked');
  });
});
