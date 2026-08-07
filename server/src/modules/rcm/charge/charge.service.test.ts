import { Charge } from './charge.model';
import { chargeService } from './charge.service';
import { CodingReview } from '../coding-review/coding-review.model';
import { Claim } from '../claim/claim.model';
import { chargeMasterService } from '../charge-master/charge-master.service';

describe('chargeService lifecycle and pricing protections', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reprices charge lines from active ChargeMaster and ignores client billed amount', async () => {
    jest.spyOn(chargeMasterService, 'getByCptCode').mockResolvedValue({
      _id: 'charge-master-1',
      cptCode: 'D0140',
      defaultChargeAmount: 125,
    } as any);
    jest.spyOn(Charge, 'create').mockImplementation(async (payload: any) => payload as any);

    const result = await chargeService.create({
      encounterId: 'encounter-1',
      patientId: 'patient-1',
      providerId: 'provider-1',
      facilityId: 'facility-1',
      serviceDate: new Date('2026-05-27T00:00:00.000Z'),
      placeOfService: '11',
      documentationComplete: true,
      chargeLines: [{
        lineNumber: 1,
        cptCode: 'd0140',
        icdCodes: ['K08.89'],
        icdPointers: [1],
        units: 2,
        chargeAmount: 1,
        renderingProviderId: 'provider-1',
      }],
    }, 'en', 'user-1');

    expect(result.chargeLines[0].cptCode).toBe('D0140');
    expect(result.chargeLines[0].chargeAmount).toBe(250);
    expect(result.chargeLines[0].pricingStatus).toBe('CHARGEMASTER_PRICED');
    expect(result.totalChargeAmount).toBe(250);
  });

  it('blocks generic line edits while a charge is pending coding review', async () => {
    const item = {
      _id: 'charge-1',
      encounterId: 'encounter-1',
      patientId: 'patient-1',
      providerId: 'provider-1',
      facilityId: 'facility-1',
      serviceDate: new Date('2026-05-27T00:00:00.000Z'),
      placeOfService: '11',
      chargeStatus: 'Submitted',
      codingReviewStatus: 'Pending',
      documentationComplete: true,
      chargeLines: [{
        lineNumber: 1,
        cptCode: 'D0140',
        icdCodes: ['K08.89'],
        icdPointers: [1],
        units: 1,
        chargeAmount: 125,
        renderingProviderId: 'provider-1',
      }],
      toObject() {
        return { ...this };
      },
      save: jest.fn(),
    };

    jest.spyOn(Charge, 'findOne').mockResolvedValue(item as any);
    jest.spyOn(Claim, 'exists').mockResolvedValue(null as any);
    jest.spyOn(chargeMasterService, 'getByCptCode').mockResolvedValue({
      _id: 'charge-master-1',
      cptCode: 'D0140',
      defaultChargeAmount: 125,
    } as any);

    await expect(chargeService.update('charge-1', {
      chargeLines: [{
        lineNumber: 1,
        cptCode: 'D0140',
        icdCodes: ['K08.89'],
        icdPointers: [1],
        units: 2,
        chargeAmount: 250,
        renderingProviderId: 'provider-1',
      }],
    }, 'en', 'user-1')).rejects.toThrow('cannot be changed through generic edit');
    expect(item.save).not.toHaveBeenCalled();
  });

  it('blocks deleting submitted charges even when no coding review or claim exists', async () => {
    jest.spyOn(CodingReview, 'exists').mockResolvedValue(null as any);
    jest.spyOn(Claim, 'exists').mockResolvedValue(null as any);
    jest.spyOn(Charge, 'findOne').mockResolvedValue({
      _id: 'charge-1',
      chargeStatus: 'Submitted',
      codingReviewStatus: 'Pending',
    } as any);
    jest.spyOn(Charge, 'findOneAndUpdate');

    await expect(chargeService.softDelete('charge-1', 'en', 'user-1'))
      .rejects.toThrow('cannot be deleted');
    expect(Charge.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
