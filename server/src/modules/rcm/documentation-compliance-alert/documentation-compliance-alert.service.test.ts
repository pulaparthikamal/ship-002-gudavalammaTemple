import { documentationComplianceAlertService } from './documentation-compliance-alert.service';
import { Document } from '../document/document.model';
import { Encounter } from '../encounter/encounter.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { ProcedureCode } from '../procedure-code/procedure-code.model';

function sessionLean<T>(value: T) {
  return {
    session: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  };
}

function selectSessionLean<T>(value: T) {
  return {
    select: jest.fn().mockReturnValue(sessionLean(value)),
  };
}

function buildClaim(overrides: Record<string, unknown> = {}) {
  return {
    _id: '665000000000000000000001',
    patientId: '665000000000000000000002',
    encounterId: '665000000000000000000003',
    claimLines: [
      {
        cptCode: '70551',
        priorAuthorizationId: '665000000000000000000004',
        referralId: '665000000000000000000005',
      },
    ],
    ...overrides,
  };
}

describe('documentationComplianceAlertService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('does not let patient-level documents satisfy claim-specific MRI documentation', async () => {
    const procedureFindSpy = jest.spyOn(ProcedureCode, 'find').mockReturnValue(sessionLean([]) as any);
    let documentQuery: any;
    const documentFindSpy = jest.spyOn(Document as any, 'find').mockImplementation((query: any) => {
      documentQuery = query;
      return selectSessionLean([]) as any;
    });
    jest.spyOn(Encounter, 'findOne').mockReturnValue(selectSessionLean({}) as any);
    jest.spyOn(PriorAuthorization, 'find').mockReturnValue(selectSessionLean([]) as any);

    const result = await documentationComplianceAlertService.calculateForClaim(buildClaim());

    expect(procedureFindSpy).toHaveBeenCalled();
    expect(documentFindSpy).toHaveBeenCalledWith(expect.objectContaining({
      $or: expect.not.arrayContaining([
        expect.objectContaining({ patientId: '665000000000000000000002' }),
      ]),
    }));
    expect(documentQuery.$or).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ patientId: '665000000000000000000002' }),
    ]));
    expect(result?.requiredDocuments).toEqual(['Clinical Note', 'Authorization Document']);
    expect(result?.missingDocuments).toEqual(['Clinical Note', 'Authorization Document']);
  });

  it('does not treat linked authorization and referral records as uploaded documents by themselves', async () => {
    jest.spyOn(ProcedureCode, 'find').mockReturnValue(sessionLean([]) as any);
    jest.spyOn(Document, 'find').mockReturnValue(selectSessionLean([]) as any);
    jest.spyOn(Encounter, 'findOne').mockReturnValue(selectSessionLean({
      clinicalNotes: 'Therapy visit notes are present on the encounter.',
    }) as any);
    jest.spyOn(PriorAuthorization, 'find').mockReturnValue(selectSessionLean([
      {
        authNumber: 'AUTH-123',
        documentChecklist: [],
      },
    ]) as any);

    const result = await documentationComplianceAlertService.calculateForClaim(buildClaim({
      claimLines: [
        {
          cptCode: '97110',
          priorAuthorizationId: '665000000000000000000004',
          referralId: '665000000000000000000005',
        },
      ],
    }));

    expect(result?.requiredDocuments).toEqual(['Referral', 'Progress Note']);
    expect(result?.matchedDocuments).toEqual(['Progress Note']);
    expect(result?.missingDocuments).toEqual(['Referral']);
  });

  it('allows completed authorization checklist documents to satisfy authorization evidence', async () => {
    jest.spyOn(ProcedureCode, 'find').mockReturnValue(sessionLean([]) as any);
    jest.spyOn(Document, 'find').mockReturnValue(selectSessionLean([
      {
        documentType: 'Clinical Note',
        documentCategory: 'Clinical Note',
        fileName: 'clinical-note.pdf',
        tags: [],
      },
    ]) as any);
    jest.spyOn(Encounter, 'findOne').mockReturnValue(selectSessionLean({}) as any);
    jest.spyOn(PriorAuthorization, 'find').mockReturnValue(selectSessionLean([
      {
        documentChecklist: [
          {
            complete: true,
            documentType: 'Authorization Document',
          },
        ],
      },
    ]) as any);

    const result = await documentationComplianceAlertService.calculateForClaim(buildClaim());

    expect(result?.status).toBe('PASS');
    expect(result?.missingDocuments).toEqual([]);
    expect(result?.matchedDocuments).toEqual(['Clinical Note', 'Authorization Document']);
  });

  it('requires clinical note and consent for dental prosthodontic claims', async () => {
    jest.spyOn(ProcedureCode, 'find').mockReturnValue(sessionLean([]) as any);
    jest.spyOn(Document, 'find').mockReturnValue(selectSessionLean([]) as any);
    jest.spyOn(Encounter, 'findOne').mockReturnValue(selectSessionLean({}) as any);
    jest.spyOn(PriorAuthorization, 'find').mockReturnValue(selectSessionLean([]) as any);

    const result = await documentationComplianceAlertService.calculateForClaim(buildClaim({
      claimLines: [{ cptCode: 'D5110' }],
    }));

    expect(result?.requiredDocuments).toEqual(['Clinical Note', 'Consent Form']);
    expect(result?.missingDocuments).toEqual(['Clinical Note', 'Consent Form']);
  });

  it('allows claim attachments to satisfy dental consent requirements before document sync', async () => {
    jest.spyOn(ProcedureCode, 'find').mockReturnValue(sessionLean([]) as any);
    jest.spyOn(Document, 'find').mockReturnValue(selectSessionLean([]) as any);
    jest.spyOn(Encounter, 'findOne').mockReturnValue(selectSessionLean({
      clinicalNotes: 'Patient is edentulous and treatment plan was reviewed.',
    }) as any);
    jest.spyOn(PriorAuthorization, 'find').mockReturnValue(selectSessionLean([]) as any);

    const result = await documentationComplianceAlertService.calculateForClaim(buildClaim({
      attachments: [
        {
          documentType: 'Consent Form',
          title: 'signed-consent.pdf',
          fileUrl: '/uploads/claim-documents/signed-consent.pdf',
        },
      ],
      claimLines: [{ cptCode: 'D5110' }],
    }));

    expect(result?.status).toBe('PASS');
    expect(result?.missingDocuments).toEqual([]);
    expect(result?.matchedDocuments).toEqual(['Clinical Note', 'Consent Form']);
  });

  it('matches encounter notes for urgent dental progress note requirements', async () => {
    jest.spyOn(ProcedureCode, 'find').mockReturnValue(sessionLean([]) as any);
    jest.spyOn(Document, 'find').mockReturnValue(selectSessionLean([]) as any);
    jest.spyOn(Encounter, 'findOne').mockReturnValue(selectSessionLean({
      clinicalNotes: 'Patient received palliative dental treatment for acute pain.',
    }) as any);
    jest.spyOn(PriorAuthorization, 'find').mockReturnValue(selectSessionLean([]) as any);

    const result = await documentationComplianceAlertService.calculateForClaim(buildClaim({
      claimLines: [{ cptCode: 'D9110' }],
    }));

    expect(result?.requiredDocuments).toEqual(['Clinical Note', 'Progress Note']);
    expect(result?.missingDocuments).toEqual([]);
    expect(result?.matchedDocuments).toEqual(['Clinical Note', 'Progress Note']);
  });
});
