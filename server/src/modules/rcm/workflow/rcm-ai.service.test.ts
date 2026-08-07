import { rcmAiService } from './rcm-ai.service';

describe('rcmAiService.suggestEncounterCodes', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('normalizes structured diagnosis and procedure suggestions from the agentic server', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          summary: 'Reviewed encounter documentation.',
          diagnosisCodes: [
            {
              code: 'E11.9',
              description: 'Type 2 diabetes mellitus without complications',
              confidence: 0.94,
              reasoning: 'Diabetes follow-up documented in the note.',
            },
          ],
          procedureCodes: [
            {
              code: '99214',
              description: 'Established patient office visit',
              confidence: 0.89,
              reasoning: 'Moderate-complexity follow-up evaluation and management documented.',
            },
          ],
          suggestedFixes: ['Confirm medical decision making supports 99214.'],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    ) as typeof fetch;

    const result = await rcmAiService.suggestEncounterCodes({
      encounterNote: 'Patient with type 2 diabetes seen for follow-up. Moderate complexity visit.',
      existingDiagnosisCodes: [],
      existingProcedureCodes: [],
    });

    expect(result.status).toBe('success');
    expect(result.summary).toBe('Reviewed encounter documentation.');
    expect(result.diagnosisCodes).toEqual([
      expect.objectContaining({
        code: 'E11.9',
        description: 'Type 2 diabetes mellitus without complications',
      }),
    ]);
    expect(result.procedureCodes).toEqual([
      expect.objectContaining({
        code: '99214',
        description: 'Established patient office visit',
      }),
    ]);
    expect(result.suggestedFixes).toContain('Confirm medical decision making supports 99214.');
  });

  it('classifies generic suggested codes into diagnosis and procedure groups', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          suggestedCodes: [
            {
              code: 'J01.90',
              description: 'Acute sinusitis',
              confidence: 0.82,
              reasoning: 'Sinus pain and congestion were documented.',
            },
            {
              code: '99213',
              description: 'Established patient office visit',
              confidence: 0.88,
              reasoning: 'Low-complexity evaluation and management documented.',
            },
          ],
          recommendedActions: ['Review whether an antibiotic was prescribed.'],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    ) as typeof fetch;

    const result = await rcmAiService.suggestEncounterCodes({
      encounterNote: 'Patient evaluated for sinus congestion and facial pressure during an office visit.',
    });

    expect(result.status).toBe('success');
    expect(result.diagnosisCodes.map((item) => item.code)).toEqual(['J01.90']);
    expect(result.procedureCodes.map((item) => item.code)).toEqual(['99213']);
    expect(result.suggestedFixes).toContain('Review whether an antibiotic was prescribed.');
  });

  it('normalizes dental CDT aliases into procedure suggestions from the agentic server', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          summary: 'Dental recall coding completed.',
          procedureCodes: [],
          diagnosisCodes: [
            {
              code: 'Z01.21',
              description: 'Encounter for dental examination with abnormal findings',
              confidence: 0.92,
              reasoning: 'Recall exam documented with early occlusal caries.',
            },
            {
              code: 'K02.9',
              description: 'Dental caries, unspecified',
              confidence: 0.95,
              reasoning: 'Early occlusal caries on tooth #19 documented.',
            },
          ],
          cdtCodes: [
            {
              code: 'D0120',
              description: 'Periodic oral evaluation - established patient',
              confidence: 0.98,
              reasoning: 'Established adult patient presents for recall exam.',
              units: 1,
            },
            {
              code: 'D0274',
              description: 'Bitewing radiographic images - four images',
              confidence: 0.98,
              reasoning: 'Four bitewing radiographs taken.',
              units: 1,
            },
            {
              code: 'D1110',
              description: 'Prophylaxis - adult',
              confidence: 0.98,
              reasoning: 'Adult prophylaxis completed.',
              units: 1,
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    ) as typeof fetch;

    const result = await rcmAiService.suggestEncounterCodes({
      encounterNote:
        'Established adult patient presents for recall exam. Four bitewing radiographs taken. Early occlusal caries on tooth #19. Adult prophylaxis completed.',
      existingDiagnosisCodes: [],
      existingProcedureCodes: [],
    });

    expect(result.status).toBe('success');
    expect(result.diagnosisCodes.map((item) => item.code)).toEqual(['Z01.21', 'K02.9']);
    expect(result.procedureCodes.map((item) => item.code)).toEqual(['D0120', 'D0274', 'D1110']);
  });
});

describe('rcmAiService financial-safety fallbacks', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('does not return a falsely low denial risk when AI denial prediction fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('AI unavailable')) as typeof fetch;

    const result = await rcmAiService.predictDenial({ claimId: 'claim-1' }, 'payer-1');

    expect(result.status).toBe('error');
    expect(result.denialProbability).toBe(1);
    expect(result.potentialRejectionReasons.join(' ')).toContain('Manual review');
  });

  it('does not mark authorization as unnecessary when AI authorization prediction fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('AI unavailable')) as typeof fetch;

    const result = await rcmAiService.predictAuth('99214', 'payer-1', ['E11.9']);

    expect(result.status).toBe('error');
    expect(result.requiresAuth).toBe(true);
    expect(result.ruleSource).toBe('AI_UNAVAILABLE_MANUAL_REVIEW');
  });
});
