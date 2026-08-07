import { runAwaitingEraAgingCheck } from './claim-era-aging.service';
import { Claim } from './claim.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { envConfig } from '../../../config/env.config';

describe('runAwaitingEraAgingCheck', () => {
  const originalThreshold = envConfig.rcmAwaitingEraThresholdDays;

  afterEach(() => {
    (envConfig as any).rcmAwaitingEraThresholdDays = originalThreshold;
    jest.restoreAllMocks();
  });

  it('marks overdue acknowledged claims delayed and creates a payer follow-up AR item', async () => {
    (envConfig as any).rcmAwaitingEraThresholdDays = 1;
    const claim: any = {
      _id: 'claim-1',
      claimId: 'CLM-1',
      patientId: 'patient-1',
      payerId: 'payer-1',
      submissionStatus: 'Acknowledged',
      closureStatus: 'AWAITING_ERA',
      expectedEraBy: new Date(Date.now() - 24 * 60 * 60 * 1000),
      statusHistory: [],
      followUpCount: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(Claim, 'find').mockReturnValue({
      limit: jest.fn().mockResolvedValue([claim]),
    } as any);
    jest.spyOn(ArWorkItem, 'findOne').mockResolvedValue(null as any);
    jest.spyOn(ArWorkItem, 'create').mockResolvedValue([{ _id: 'ar-1' }] as any);

    const result = await runAwaitingEraAgingCheck('aging-worker');

    expect(result.delayedClaims).toBe(1);
    expect(ArWorkItem.create).toHaveBeenCalledWith(expect.objectContaining({
      claimId: claim._id,
      category: 'AWAITING_ERA',
      status: 'OPEN',
      dedupeKey: 'awaiting-era:claim-1',
    }));
    const createPayload = (ArWorkItem.create as jest.Mock).mock.calls[0][0];
    expect(createPayload.createdBy).toBeUndefined();
    expect(createPayload.updatedBy).toBeUndefined();
    expect(claim.closureStatus).toBe('ERA_DELAYED');
    expect(claim.followUpCount).toBe(1);
    expect(claim.statusHistory[0].changedBy).toBeUndefined();
    expect(claim.save).toHaveBeenCalled();
  });
});
