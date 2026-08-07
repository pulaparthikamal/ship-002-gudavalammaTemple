import { claimServiceTestUtils } from './claim.service';

describe('claim expected responsibility allocation', () => {
  it('allocates deductible remaining across claim lines instead of applying the full deductible to every line', () => {
    const accumulator = claimServiceTestUtils.createExpectedResponsibilityAccumulator();
    const eligibility = {
      _id: 'eligibility-1',
      planActive: true,
      deductibleRemaining: 500,
      outOfPocketRemaining: 7000,
    };

    const firstLine = claimServiceTestUtils.calculateExpectedResponsibility(300, eligibility, accumulator);
    const secondLine = claimServiceTestUtils.calculateExpectedResponsibility(300, eligibility, accumulator);

    expect(firstLine).toEqual(expect.objectContaining({
      deductibleAppliedAmount: 300,
      expectedPatientResponsibility: 300,
      expectedInsurancePayment: 0,
    }));
    expect(secondLine).toEqual(expect.objectContaining({
      deductibleAppliedAmount: 200,
      expectedPatientResponsibility: 200,
      expectedInsurancePayment: 100,
    }));
  });

  it('keeps a below-deductible multi-line claim fully patient-estimated before ERA', () => {
    const accumulator = claimServiceTestUtils.createExpectedResponsibilityAccumulator();
    const eligibility = {
      _id: 'eligibility-2',
      planActive: true,
      deductibleRemaining: 500,
      outOfPocketRemaining: 7000,
    };

    const lines = [120, 44, 135].map((allowed) =>
      claimServiceTestUtils.calculateExpectedResponsibility(allowed, eligibility, accumulator)
    );

    expect(lines.reduce((total, line) => total + Number(line.expectedPatientResponsibility ?? 0), 0)).toBe(299);
    expect(lines.reduce((total, line) => total + Number(line.expectedInsurancePayment ?? 0), 0)).toBe(0);
  });
});
