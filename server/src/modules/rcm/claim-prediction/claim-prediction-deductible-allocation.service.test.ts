import { claimPredictionServiceTestUtils } from './claim-prediction.service';

describe('claim prediction benefit allocation', () => {
  it('shares deductible remaining across batch prediction lines', () => {
    const accumulator = claimPredictionServiceTestUtils.createBenefitResponsibilityAccumulator();
    const context = {
      eligibility: {
        _id: 'eligibility-1',
        planActive: true,
        deductibleRemaining: 500,
        outOfPocketRemaining: 7000,
      },
    };

    const firstLine = claimPredictionServiceTestUtils.calculateBenefitResponsibility(300, context as any, accumulator);
    const secondLine = claimPredictionServiceTestUtils.calculateBenefitResponsibility(300, context as any, accumulator);

    expect(firstLine).toEqual(expect.objectContaining({
      patientResponsibility: 300,
      insurancePaid: 0,
    }));
    expect(secondLine).toEqual(expect.objectContaining({
      patientResponsibility: 200,
      insurancePaid: 100,
    }));
  });
});
