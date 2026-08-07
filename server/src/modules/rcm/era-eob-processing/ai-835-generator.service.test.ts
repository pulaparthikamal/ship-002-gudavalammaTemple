import { ai835GeneratorService } from './ai-835-generator.service';
import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';

jest.mock('../claim/claim.model');
jest.mock('../claim-submission/claim-submission.model');

describe('Ai835GeneratorService', () => {
  const mockClaim = {
    _id: '665000000000000000000101',
    claimId: 'CLAIM-123',
    payerId: 'PAYER-XYZ',
    totalChargeAmount: 150,
    clearingHouse: 'Test Payer',
    claimLines: [
      {
        _id: '665000000000000000000102',
        cptCode: '99213',
        chargeAmount: 150,
        expectedAllowedAmount: 120,
        expectedInsurancePayment: 100,
        serviceDateFrom: '2026-05-01',
      },
    ],
  };

  const mockSubmission = {
    _id: '665000000000000000000103',
    controlNumber: 'SUB-456',
    payerClaimNumber: 'PAYER-SUB-456',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate three scenarios with correct formats using local generator if OpenAI API Key is missing', async () => {
    (Claim.findOne as jest.Mock).mockResolvedValue(mockClaim);
    (ClaimSubmission.findOne as jest.Mock).mockResolvedValue(mockSubmission);

    const result = await ai835GeneratorService.generateAi835(
      '665000000000000000000101',
      '665000000000000000000103'
    );

    expect(result).toHaveProperty('fullPayment835');
    expect(result).toHaveProperty('denialPayment835');
    expect(result).toHaveProperty('denialCorrection835');

    // Verify CLP matches controlNumber
    expect(result.fullPayment835).toContain('CLP*SUB-456*1*150*100*0.01*12*PAYER-SUB-456~');
    expect(result.denialPayment835).toContain('CLP*SUB-456*4*150*0*0*12*PAYER-SUB-456~');
    expect(result.denialCorrection835).toContain('CLP*SUB-456*2*150*100*0.01*12*PAYER-SUB-456~');

    expect(result.fullPayment835).toContain('CAS*CO*45*49.99~');
    expect(result.fullPayment835).toContain('CAS*PR*1*0.01~');
    expect(result.denialCorrection835).toContain('CAS*CO*45*49.99~');
    expect(result.denialCorrection835).toContain('CAS*PR*1*0.01~');

    // Verify REF*6R matches line ID
    expect(result.fullPayment835).toContain('REF*6R*665000000000000000000102~');
    expect(result.denialPayment835).toContain('REF*6R*665000000000000000000102~');
    expect(result.denialCorrection835).toContain('REF*6R*665000000000000000000102~');
  });

  it('should throw AppError if Claim is not found', async () => {
    (Claim.findOne as jest.Mock).mockResolvedValue(null);
    (ClaimSubmission.findOne as jest.Mock).mockResolvedValue(mockSubmission);

    await expect(
      ai835GeneratorService.generateAi835('665000000000000000000101', '665000000000000000000103')
    ).rejects.toThrow('Claim not found.');
  });

  it('should throw AppError if ClaimSubmission is not found', async () => {
    (Claim.findOne as jest.Mock).mockResolvedValue(mockClaim);
    (ClaimSubmission.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      ai835GeneratorService.generateAi835('665000000000000000000101', '665000000000000000000103')
    ).rejects.toThrow('Claim submission not found.');
  });
});
