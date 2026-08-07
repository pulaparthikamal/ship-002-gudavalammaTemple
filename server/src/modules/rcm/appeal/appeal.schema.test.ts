import {
  appealActionSchema,
  appealCorrespondenceSchema,
  appealDocumentRemoveSchema,
  appealDocumentSchema,
  appealFinalPacketSchema,
  appealReadinessSchema,
  appealSubmissionProofSchema,
  appealPayerRuleSchema,
  appealTemplateSchema,
  appealTemplatePreviewSchema,
} from './appeal.schema';

const appealId = '6a1d5a156f968497c0570c81';
const documentId = 'doc-123456';

describe('appeal packet management schemas', () => {
  it('accepts controlled submission channel tracking fields', () => {
    const parsed = appealActionSchema.parse({
      params: { id: appealId },
      body: {
        submissionChannel: 'PORTAL',
        trackingNumber: 'PORTAL-123',
        confirmationNumber: 'CONF-123',
        destination: 'Aetna portal',
        deliveryStatus: 'SENT',
      },
    });

    expect(parsed.body?.submissionChannel).toBe('PORTAL');
    expect(parsed.body?.deliveryStatus).toBe('SENT');
  });

  it('accepts appeal evidence document metadata or uploaded content payload', () => {
    const parsed = appealDocumentSchema.parse({
      params: { id: appealId },
      body: {
        documentType: 'Medical Records',
        fileName: 'clinical-notes.pdf',
        fileReference: '/api/v1/uploads/rcm/appeal-documents/clinical-notes.pdf',
        fileSize: 12345,
        notes: 'Progress note supporting medical necessity.',
      },
    });

    expect(parsed.body.fileName).toBe('clinical-notes.pdf');
    expect(parsed.body.fileReference).toContain('clinical-notes.pdf');
  });

  it('requires a reason when removing an appeal document', () => {
    expect(() => appealDocumentRemoveSchema.parse({
      params: { id: appealId, documentId },
      body: { reason: '' },
    })).toThrow();
  });

  it('accepts payer correspondence tracking payloads', () => {
    const parsed = appealCorrespondenceSchema.parse({
      params: { id: appealId },
      body: {
        correspondenceType: 'Portal Uploaded',
        status: 'CONFIRMED',
        channel: 'PORTAL',
        confirmationNumber: 'CN-999',
        notes: 'Packet uploaded and confirmed.',
      },
    });

    expect(parsed.body.status).toBe('CONFIRMED');
    expect(parsed.body.channel).toBe('PORTAL');
  });

  it('accepts reusable appeal letter template preview payloads', () => {
    const parsed = appealTemplatePreviewSchema.parse({
      params: { id: appealId },
      body: {
        templateName: 'Medical necessity v1',
        templateType: 'Medical Necessity',
        templateVersion: 1,
        bodyTemplate: 'Appeal {{claimId}} for {{denialReason}}.',
        placeholders: { claimId: 'CLM-1' },
      },
    });

    expect(parsed.body?.templateVersion).toBe(1);
  });

  it('accepts appeal readiness and final packet requests', () => {
    expect(appealReadinessSchema.parse({
      params: { id: appealId },
      body: { reason: 'Pre-submit check' },
    }).body?.reason).toBe('Pre-submit check');

    expect(appealFinalPacketSchema.parse({
      params: { id: appealId },
      body: { reason: 'Final packet generation', submissionChannel: 'PORTAL', submissionMethod: 'PORTAL' },
    }).body?.reason).toBe('Final packet generation');
  });

  it('accepts submission proof payloads', () => {
    const parsed = appealSubmissionProofSchema.parse({
      params: { id: appealId },
      body: {
        channel: 'FAX',
        confirmationNumber: 'FAX-123',
        deliveryStatus: 'CONFIRMED',
        proofDocumentReference: '/api/v1/uploads/rcm/appeal-documents/fax-confirmation.pdf',
      },
    });

    expect(parsed.body.channel).toBe('FAX');
    expect(parsed.body.deliveryStatus).toBe('CONFIRMED');
  });

  it('accepts persisted template creation payloads', () => {
    const parsed = appealTemplateSchema.parse({
      body: {
        templateName: 'Aetna medical necessity',
        templateType: 'MEDICAL_NECESSITY',
        bodyTemplate: 'Please review {{claimId}}.',
        active: true,
      },
    });

    expect(parsed.body.templateName).toBe('Aetna medical necessity');
  });

  it('accepts payer-specific appeal rule governance payloads', () => {
    const parsed = appealPayerRuleSchema.parse({
      body: {
        payerId: '60054',
        payerName: 'Aetna',
        effectiveDate: '2026-06-01',
        requiredEvidence: ['MEDICAL_RECORDS', 'EOB_ERA_DOCUMENTS'],
        requiredForms: ['Payer appeal cover sheet'],
        allowedSubmissionChannels: ['PORTAL', 'FAX'],
        deadlineDays: 180,
        appealLevels: ['LEVEL_1', 'LEVEL_2'],
        active: true,
      },
    });

    expect(parsed.body.payerId).toBe('60054');
    expect(parsed.body.allowedSubmissionChannels).toEqual(['PORTAL', 'FAX']);
  });

  it('accepts governed close payloads with reason, notes, and outcome category', () => {
    const parsed = appealActionSchema.parse({
      params: { id: appealId },
      body: {
        reason: 'Appeal recovery posted and AR resolved.',
        notes: 'Closed after reprocessed ERA payment and patient responsibility allocation.',
        outcomeCategory: 'OVERTURNED',
      },
    });

    expect(parsed.body?.outcomeCategory).toBe('OVERTURNED');
  });
});
