import { mapAcknowledgementToRemediation } from './claim-submission.remediation';

describe('mapAcknowledgementToRemediation', () => {
  it('maps 999 rejection to an X12 syntax readiness defect', () => {
    const remediation = mapAcknowledgementToRemediation({
      acknowledgementType: '999 Functional Acknowledgement',
      acknowledgementStatus: 'REJECTED',
      statusCode: 'R',
    });

    expect(remediation).toEqual(
      expect.objectContaining({
        readinessCode: 'ACK999_X12_SYNTAX_REJECTED',
        fieldPath: 'claim.edi837',
        severity: 'BLOCKING',
      }),
    );
  });

  it('maps 277CA service-line rejection to a service-line remediation task', () => {
    const remediation = mapAcknowledgementToRemediation({
      acknowledgementType: '277CA Claim Acknowledgement',
      acknowledgementStatus: 'REJECTED',
      stcCategoryCode: 'A8',
      stcStatusCode: '21',
      affectedServiceLine: '2',
    });

    expect(remediation).toEqual(
      expect.objectContaining({
        readinessCode: 'ACK277_SERVICE_LINE_REJECTED',
        fieldPath: 'claim.claimLines',
        serviceLineReference: '2',
        severity: 'BLOCKING',
      }),
    );
  });

  it('does not produce remediation for accepted acknowledgements', () => {
    expect(mapAcknowledgementToRemediation({
      acknowledgementType: '277CA Claim Acknowledgement',
      acknowledgementStatus: 'ACCEPTED',
      stcCategoryCode: 'A2',
    })).toBeUndefined();
  });
});
