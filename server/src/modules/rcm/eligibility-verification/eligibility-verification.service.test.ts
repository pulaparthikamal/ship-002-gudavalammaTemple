import { eligibilityVerificationService, redactEligibilityPayload } from './eligibility-verification.service';
import { EligibilityVerification } from './eligibility-verification.model';

describe('redactEligibilityPayload', () => {
  it('redacts member, name, DOB, address, and phone fields from eligibility payload snapshots', () => {
    const payload = {
      correlationId: 'IV-123',
      payer: {
        payerId: 'AETNA',
      },
      subscriber: {
        id: 'SUB-123',
        memberId: 'MEMBER-123',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        address: {
          addressLine1: '100 Main St',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
        },
        phone: '5125551212',
      },
      benefits: {
        copayAmount: 25,
      },
    };

    const redacted = redactEligibilityPayload(payload) as Record<string, any>;

    expect(redacted.correlationId).toBe('IV-123');
    expect(redacted.payer.payerId).toBe('AETNA');
    expect(redacted.subscriber.id).toBe('[REDACTED]');
    expect(redacted.subscriber.memberId).toBe('[REDACTED]');
    expect(redacted.subscriber.firstName).toBe('[REDACTED]');
    expect(redacted.subscriber.lastName).toBe('[REDACTED]');
    expect(redacted.subscriber.dateOfBirth).toBe('[REDACTED]');
    expect(redacted.subscriber.address).toBe('[REDACTED]');
    expect(redacted.subscriber.phone).toBe('[REDACTED]');
    expect(redacted.benefits.copayAmount).toBe(25);
  });

  it('redacts non-JSON raw response strings by default', () => {
    expect(redactEligibilityPayload('Jane Doe MEMBER-123 1990-01-01')).toBe('[REDACTED]');
    expect(redactEligibilityPayload({ value: 'Jane Doe MEMBER-123 1990-01-01' })).toEqual({ value: '[REDACTED]' });
  });

  it('redacts manual eligibility create payloads by default', async () => {
    const createSpy = jest.spyOn(EligibilityVerification, 'create').mockImplementation(async (payload: any) => payload);

    const item = await eligibilityVerificationService.create(
      {
        patientId: '665000000000000000000001',
        payerId: 'AETNA',
        serviceDate: new Date('2026-05-13T00:00:00.000Z'),
        planActive: true,
        rawRequestPayload: {
          subscriber: {
            memberId: 'MEMBER-123',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            phone: '5125551212',
          },
        },
        rawResponsePayload: {
          member: {
            id: 'MEMBER-123',
            name: 'Jane Doe',
            address: {
              addressLine1: '100 Main St',
              city: 'Austin',
            },
          },
        },
      },
      'en',
      { _id: '665000000000000000000099' }
    ) as any;

    expect(createSpy).toHaveBeenCalled();
    expect(item.rawRequestPayload.subscriber.memberId).toBe('[REDACTED]');
    expect(item.rawRequestPayload.subscriber.firstName).toBe('[REDACTED]');
    expect(item.rawRequestPayload.subscriber.phone).toBe('[REDACTED]');
    expect(item.rawResponsePayload.member.id).toBe('[REDACTED]');
    expect(item.rawResponsePayload.member.name).toBe('[REDACTED]');
    expect(item.rawResponsePayload.member.address).toBe('[REDACTED]');

    createSpy.mockRestore();
  });
});
