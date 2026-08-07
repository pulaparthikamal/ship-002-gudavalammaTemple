import { adjustmentService } from './adjustment/adjustment.service';
import { eraEobProcessingService } from './era-eob-processing/era-eob-processing.service';

describe('financial generated record append-only protections', () => {
  it('blocks generic adjustment create, update, and delete mutations', async () => {
    await expect(adjustmentService.create({}, 'en', 'user-1')).rejects.toThrow('controlled ERA, reversal, or write-off workflows');
    await expect(adjustmentService.update('adjustment-1', {}, 'en', 'user-1')).rejects.toThrow('append-only');
    await expect(adjustmentService.softDelete('adjustment-1', 'en', 'user-1')).rejects.toThrow('cannot be deleted');
  });

  it('blocks generic ERA create, update, and delete mutations while preserving controlled endpoints', async () => {
    await expect(eraEobProcessingService.create({}, 'en', 'user-1')).rejects.toThrow('controlled 835 import or replay');
    await expect(eraEobProcessingService.update('era-1', {}, 'en', 'user-1')).rejects.toThrow('append-only');
    await expect(eraEobProcessingService.softDelete('era-1', 'en', 'user-1')).rejects.toThrow('cannot be deleted');
  });
});
