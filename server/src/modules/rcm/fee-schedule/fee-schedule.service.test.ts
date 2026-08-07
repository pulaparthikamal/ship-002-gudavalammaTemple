import { feeScheduleService } from './fee-schedule.service';
import { FeeSchedule } from './fee-schedule.model';

function mockFind(candidates: any[]) {
  jest.spyOn(FeeSchedule, 'find').mockReturnValue({
    sort: jest.fn().mockResolvedValue(candidates),
  } as any);
}

describe('feeScheduleService.findBestMatchDetailed', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns exact payer/provider/facility/state/POS/plan/group/network match first', async () => {
    const exact = {
      _id: 'fee-exact',
      payerId: 'AETNA',
      cptCode: '99213',
      providerId: 'provider-a',
      facilityId: 'facility-tx',
      state: 'TX',
      placeOfServiceCode: '11',
      planName: 'Aetna Commercial Texas PPO',
      groupNumber: 'GRP-AETNA',
      network: 'IN_NETWORK',
      coverageType: 'PRIMARY',
      allowedAmount: 110,
      modifiers: [],
      effectiveDate: new Date('2026-01-01'),
    };
    mockFind([
      { ...exact, _id: 'fee-generic', providerId: undefined, facilityId: undefined, allowedAmount: 100 },
      exact,
    ]);

    const result = await feeScheduleService.findBestMatchDetailed({
      payerIds: ['AETNA'],
      cptCode: '99213',
      providerId: 'provider-a',
      facilityId: 'facility-tx',
      state: 'TX',
      placeOfServiceCode: '11',
      planName: 'Aetna Commercial Texas PPO',
      groupNumber: 'GRP-AETNA',
      network: 'IN_NETWORK',
      coverageType: 'PRIMARY',
      serviceDate: '2026-05-13',
    });

    expect(result?.allowedAmount).toBe(110);
    expect(result?.matchedBy).toBe('payer-provider-facility-cpt-state-pos-plan-group-network');
    expect(result?.confidence).toBe(100);
  });

  it('falls back to payer/CPT/POS when provider/state plan rates are absent', async () => {
    mockFind([
      {
        _id: 'fee-pos',
        payerId: 'AETNA',
        cptCode: '99213',
        placeOfServiceCode: '11',
        allowedAmount: 105,
        modifiers: [],
        effectiveDate: new Date('2026-01-01'),
      },
      {
        _id: 'fee-payer-cpt',
        payerId: 'AETNA',
        cptCode: '99213',
        allowedAmount: 90,
        modifiers: [],
        effectiveDate: new Date('2026-01-01'),
      },
    ]);

    const result = await feeScheduleService.findBestMatchDetailed({
      payerIds: ['AETNA'],
      cptCode: '99213',
      placeOfServiceCode: '11',
      serviceDate: '2026-05-13',
    });

    expect(result?.allowedAmount).toBe(105);
    expect(result?.matchedBy).toBe('payer-cpt-pos');
  });

  it('returns null when no configured contract rate exists', async () => {
    mockFind([]);

    const result = await feeScheduleService.findBestMatchDetailed({
      payerIds: ['AETNA'],
      cptCode: '99213',
      placeOfServiceCode: '11',
      serviceDate: '2026-05-13',
    });

    expect(result).toBeNull();
  });
});
