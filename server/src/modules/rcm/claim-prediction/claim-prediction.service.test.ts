import { ClaimPrediction } from './claim-prediction.model';
import { claimPredictionService } from './claim-prediction.service';
import { Charge } from '../charge/charge.model';

describe('claimPredictionService reimbursement prediction lifecycle', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replaces existing charge-level predictions before creating fresh line predictions', async () => {
    const charge = {
      _id: 'charge-1',
      patientId: 'patient-1',
      providerId: 'provider-1',
      facilityId: 'facility-1',
      chargeLines: [
        {
          lineNumber: 1,
          cptCode: 'D0140',
          units: 1,
          chargeAmount: 125,
          renderingProviderId: 'provider-1',
        },
        {
          lineNumber: 2,
          cptCode: 'D0220',
          units: 1,
          chargeAmount: 45,
          renderingProviderId: 'provider-1',
        },
      ],
    };
    const updateManySpy = jest.spyOn(ClaimPrediction, 'updateMany').mockResolvedValue({ modifiedCount: 2 } as any);
    jest.spyOn(Charge, 'findOne').mockResolvedValue(charge as any);
    jest.spyOn(claimPredictionService, 'predict')
      .mockImplementation(async (input: any) => ({
        _id: `prediction-${input.lineNumber}`,
        chargeId: input.chargeId,
        cptCode: input.cptCode,
        lineNumber: input.lineNumber,
      } as any));

    const result = await claimPredictionService.predictForCharge('charge-1', 'user-1');

    expect(updateManySpy).toHaveBeenCalledWith(
      { chargeId: 'charge-1', isDeleted: false },
      expect.objectContaining({
        isDeleted: true,
        active: false,
        updatedBy: 'user-1',
      }),
    );
    expect(result).toHaveLength(2);
    expect(claimPredictionService.predict).toHaveBeenCalledWith(expect.objectContaining({
      chargeId: 'charge-1',
      cptCode: 'D0140',
      lineNumber: 1,
    }));
  });
});
