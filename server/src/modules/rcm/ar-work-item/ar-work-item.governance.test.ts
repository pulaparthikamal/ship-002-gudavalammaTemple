import { arWorkItemService } from './ar-work-item.service';
import { ArWorkItem } from './ar-work-item.model';
import { Denial } from '../denial/denial.model';

jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: {
    syncClaimClosureStatus: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));

describe('arWorkItemService denial governance', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('does not write queue worker names into ObjectId audit fields', async () => {
    const createdItem: any = {
      _id: 'ar-queue-1',
      status: 'OPEN',
      category: 'NO_RESPONSE',
      balanceAmount: 125,
    };
    jest.spyOn(ArWorkItem, 'create').mockResolvedValue(createdItem);

    const result = await arWorkItemService.create(
      { category: 'NO_RESPONSE', createdBy: 'bad-actor', updatedBy: 'bad-actor' },
      'en',
      'rcm-mongo-queue-worker'
    );

    const createPayload = (ArWorkItem.create as jest.Mock).mock.calls[0][0];
    expect(createPayload.createdBy).toBeUndefined();
    expect(createPayload.updatedBy).toBeUndefined();
    expect(result).toBe(createdItem);
  });

  it('does not allow AR closure to resolve an open linked denial', async () => {
    const arItem: any = {
      _id: 'ar-1',
      denialId: 'denial-1',
      status: 'OPEN',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(ArWorkItem, 'findOne').mockResolvedValue(arItem);
    jest.spyOn(Denial, 'findOne').mockResolvedValue({ _id: 'denial-1', denialStatus: 'OPEN' } as any);

    await expect(arWorkItemService.changeStatus(
      'ar-1',
      { status: 'CLOSED', reason: 'Manual AR close.' },
      'en',
      'user-1'
    )).rejects.toThrow('Linked denial is still open');

    expect(arItem.save).not.toHaveBeenCalled();
  });

  it('allows AR closure when the linked denial is already terminal', async () => {
    const arItem: any = {
      _id: 'ar-2',
      denialId: 'denial-2',
      status: 'OPEN',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(ArWorkItem, 'findOne').mockResolvedValue(arItem);
    jest.spyOn(Denial, 'findOne').mockResolvedValue({ _id: 'denial-2', denialStatus: 'WRITTEN_OFF' } as any);

    const result = await arWorkItemService.changeStatus(
      'ar-2',
      { status: 'CLOSED', reason: 'Denial write-off approved.' },
      'en',
      'user-1'
    );

    expect(result.status).toBe('CLOSED');
    expect(arItem.save).toHaveBeenCalled();
  });
});
