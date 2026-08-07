import { appealService } from '../appeal/appeal.service';
import { Appeal } from '../appeal/appeal.model';
import { arWorkItemService } from '../ar-work-item/ar-work-item.service';
import { claimTrackingService } from '../claim-tracking/claim-tracking.service';
import { denialService } from '../denial/denial.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { rcmAiService } from './rcm-ai.service';

jest.mock('./rcm-ai.service', () => ({
  rcmAiService: {
    analyzeAckRejection: jest.fn(),
    analyzeDenial: jest.fn(),
    generateAppealPacket: jest.fn(),
    prioritizeArWork: jest.fn(),
  },
}));

jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));

jest.mock('../../../utils/mongoose-transaction.util', () => ({
  withMongoTransaction: jest.fn(async (operation: (session?: unknown) => Promise<unknown>) => operation(undefined)),
}));

describe('advisory RCM AI actions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('persists claim rejection analysis without replacing deterministic remediation', async () => {
    const item: any = {
      _id: 'tracking-1',
      normalizedStatus: 'REJECTED',
      nextActionRequired: 'Correct the parsed acknowledgement error.',
      remediationFieldPath: 'claim.subscriber.memberId',
      remediationSeverity: 'BLOCKING',
      aiRecommendationHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(claimTrackingService, 'getById').mockResolvedValue(item);
    (rcmAiService.analyzeAckRejection as jest.Mock).mockResolvedValue({
      status: 'COMPLETED',
      rootCause: 'Suggested root cause',
      correctionType: 'DATA_CORRECTION',
      affectedFields: ['claim.payerId'],
      recommendedActions: ['Use an AI suggested action.'],
      correctedClaimRecommended: true,
      priority: 'HIGH',
      confidence: 0.9,
      source: 'agentic',
    });

    await claimTrackingService.analyzeRejection('tracking-1', 'en', 'user-1');

    expect(item.nextActionRequired).toBe('Correct the parsed acknowledgement error.');
    expect(item.remediationFieldPath).toBe('claim.subscriber.memberId');
    expect(item.remediationSeverity).toBe('BLOCKING');
    expect(item.aiRejectionAnalysis.rootCause).toBe('Suggested root cause');
  });

  it('persists denial analysis without replacing rule-based recovery decisions', async () => {
    const item: any = {
      _id: 'denial-1',
      denialStatus: 'OPEN',
      rootCause: 'MEDICAL_NECESSITY',
      recoveryRecommendation: 'APPEAL',
      recommendationReason: 'Rule-based appeal path.',
      recommendedAction: 'Validate payer policy before appeal.',
      aiRecommendationHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(denialService, 'getById').mockResolvedValue(item);
    (rcmAiService.analyzeDenial as jest.Mock).mockResolvedValue({
      status: 'COMPLETED',
      rootCause: 'Alternative AI hypothesis',
      recommendation: 'WRITE_OFF',
      recommendationReason: 'AI recommendation must remain advisory.',
      evidenceNeeded: [],
      missingDocumentation: [],
      payerPolicyNotes: [],
      nextBestAction: 'Write off now.',
      confidence: 0.8,
      source: 'agentic',
    });

    await denialService.runAiAnalysis('denial-1', 'en', 'user-1');

    expect(item.rootCause).toBe('MEDICAL_NECESSITY');
    expect(item.recoveryRecommendation).toBe('APPEAL');
    expect(item.recommendationReason).toBe('Rule-based appeal path.');
    expect(item.recommendedAction).toBe('Validate payer policy before appeal.');
    expect(item.aiAnalysis.recommendation).toBe('WRITE_OFF');
  });

  it('persists AR prioritization without rerouting the operational work item', async () => {
    const item: any = {
      _id: 'ar-1',
      priority: 'medium',
      team: 'Denials',
      nextAction: 'Await payer response.',
      suggestedFix: 'Continue appeal workflow.',
      aiRecommendationHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(arWorkItemService, 'getById').mockResolvedValue(item);
    (rcmAiService.prioritizeArWork as jest.Mock).mockResolvedValue({
      status: 'COMPLETED',
      priority: 'high',
      financialImpact: 125,
      slaRisk: 'HIGH',
      recommendedOwnerQueue: 'Supervisor',
      nextAction: 'Escalate.',
      reason: 'Potential deadline.',
      confidence: 0.9,
      source: 'agentic',
    });

    await arWorkItemService.prioritizeWithAi('ar-1', 'en', 'user-1');

    expect(item.priority).toBe('medium');
    expect(item.team).toBe('Denials');
    expect(item.nextAction).toBe('Await payer response.');
    expect(item.suggestedFix).toBe('Continue appeal workflow.');
    expect(item.aiPriorityAnalysis.priority).toBe('high');
  });

  it('stores an AI appeal draft without changing packet readiness or appeal status', async () => {
    const item: any = {
      _id: 'appeal-1',
      appealStatus: 'PACKET_GENERATED',
      packetStatus: 'READY',
      generatedAppealLetterText: 'Approved operator packet.',
      evidenceSummary: 'Approved evidence.',
      aiPacketHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Appeal, 'findOne').mockReturnValue({
      session: jest.fn().mockResolvedValue(item),
    } as any);
    (rcmAiService.generateAppealPacket as jest.Mock).mockResolvedValue({
      status: 'COMPLETED',
      appealLetterDraft: 'AI draft only.',
      evidenceChecklist: ['Suggested evidence'],
      missingDocs: [],
      overturnProbability: 0.75,
      confidence: 0.8,
      source: 'agentic',
    });

    await appealService.generateAiPacket('appeal-1', {}, 'en', 'user-1');

    expect(item.appealStatus).toBe('PACKET_GENERATED');
    expect(item.packetStatus).toBe('READY');
    expect(item.generatedAppealLetterText).toBe('Approved operator packet.');
    expect(item.evidenceSummary).toBe('Approved evidence.');
    expect(item.aiPacketDraft.appealLetterDraft).toBe('AI draft only.');
    expect(publishRcmRealtimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'AI_RECOMMENDATION_RECORDED' }),
    );
  });
});
