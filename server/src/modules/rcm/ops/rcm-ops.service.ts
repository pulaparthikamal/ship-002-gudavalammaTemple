import { envConfig } from '../../../config/env.config';
import { claimSubmissionIntegrationConfig } from '../claim-submission/claim-submission.integration.config';
import { eligibilityIntegrationConfig } from '../eligibility-verification/eligibility-verification.integration.config';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { Claim } from '../claim/claim.model';
import { ClearinghouseEvent } from '../clearinghouse-event/clearinghouse-event.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { RcmBackgroundJob } from '../background-job/background-job.model';
import { getRcmQueueHealth } from '../background-job/rcm-queue.service';
import '../claim/claim-era-aging.service';
import '../era-exception/era-exception.service';
import '../denial/denial-workflow.service';
import '../appeal/appeal.service';
import '../corrected-claim/corrected-claim.service';
import { EraException } from '../era-exception/era-exception.model';
import { Denial } from '../denial/denial.model';
import { Appeal } from '../appeal/appeal.model';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';

export const rcmOpsService = {
  async health() {
    const [
      queue,
      webhookCounts,
      submissionCounts,
      eraCounts,
      latestFailedJob,
      latestWebhookEvent,
      pendingAcknowledgements,
      acceptedClaimsAwaitingEra,
      eraExceptions,
      postingImbalances,
      eraExceptionCount,
      staleQueueJobs,
      recoveredQueueJobs,
      eraDelayedClaims,
      eraFollowUpJobs,
      overdueDenials,
      overdueAppeals,
      staleCorrectedClaims,
    ] = await Promise.all([
      getRcmQueueHealth(),
      ClearinghouseEvent.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      ClaimSubmission.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$normalizedStatus', count: { $sum: 1 } } },
      ]),
      EraEobProcessing.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$reconciliationStatus', count: { $sum: 1 } } },
      ]),
      RcmBackgroundJob.findOne({
        isDeleted: false,
        status: { $in: ['FAILED', 'DEAD_LETTER'] },
      }).sort({ updated: -1 }).lean(),
      ClearinghouseEvent.findOne({ isDeleted: false }).sort({ updated: -1, created: -1 }).lean(),
      ClaimSubmission.countDocuments({
        isDeleted: false,
        normalizedStatus: { $in: ['PENDING', 'SUBMITTED'] },
      }),
      ClaimSubmission.countDocuments({
        isDeleted: false,
        normalizedStatus: { $in: ['ACCEPTED'] },
        acknowledgementStatus: { $not: /rejected|failed/i },
      }),
      EraEobProcessing.countDocuments({
        isDeleted: false,
        reconciliationStatus: { $in: ['EXCEPTION', 'PARTIALLY_POSTED'] },
      }),
      EraEobProcessing.countDocuments({
        isDeleted: false,
        unmatchedAmount: { $gt: 0 },
      }),
      EraException.countDocuments({
        isDeleted: false,
        status: { $in: ['OPEN', 'IN_REVIEW', 'ESCALATED', 'REPROCESSING'] },
      }),
      RcmBackgroundJob.countDocuments({ isDeleted: false, status: 'STALE' }),
      RcmBackgroundJob.countDocuments({ isDeleted: false, recoveredAt: { $exists: true } }),
      Claim.countDocuments({
        isDeleted: false,
        closureStatus: { $in: ['ERA_DELAYED', 'FOLLOW_UP_REQUIRED'] },
      }),
      RcmBackgroundJob.countDocuments({
        isDeleted: false,
        jobType: 'CHECK_AWAITING_ERA_AGING',
        status: { $in: ['QUEUED', 'FAILED', 'RUNNING'] },
      }),
      Denial.countDocuments({
        isDeleted: false,
        denialStatus: { $in: ['OPEN', 'APPEAL_READY', 'APPEALED', 'PAYER_REVIEW', 'CORRECTED_CLAIM_PENDING'] },
        $or: [{ slaDueAt: { $lte: new Date() } }, { appealDeadline: { $lte: new Date() } }],
      }),
      Appeal.countDocuments({
        isDeleted: false,
        appealStatus: { $in: ['SUBMITTED', 'PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'EVIDENCE_SUBMITTED'] },
        $or: [{ dueDate: { $lte: new Date() } }, { appealDeadline: { $lte: new Date() } }, { payerResponseDueAt: { $lte: new Date() } }],
      }),
      CorrectedClaim.countDocuments({
        isDeleted: false,
        correctedClaimStatus: { $in: ['DRAFT', 'READY_FOR_REVIEW', 'SUBMITTED', 'PENDING', 'REJECTED'] },
        agingDueAt: { $lte: new Date() },
      }),
    ]);

    return {
      status: queue.deadLetter > 0 || queue.failed > 0 || !queue.worker?.running ? 'DEGRADED' : 'OK',
      environment: envConfig.nodeEnv,
      queue,
      warnings: [
        !queue.worker?.running ? 'No active Mongo queue worker.' : '',
        queue.deadLetter > 0 ? 'Dead-letter jobs need review.' : '',
        acceptedClaimsAwaitingEra > 0 ? 'Accepted claims are awaiting ERA.' : '',
        eraExceptions > 0 ? 'ERA exceptions need review.' : '',
        eraExceptionCount > 0 ? 'ERA exception workbench has open items.' : '',
        staleQueueJobs > 0 ? 'Stale queue jobs need recovery review.' : '',
        overdueDenials > 0 ? 'Denial SLA breaches need escalation.' : '',
        overdueAppeals > 0 ? 'Appeal SLA breaches need escalation.' : '',
      ].filter(Boolean),
      integrations: {
        stediEligibility: {
          enabled: envConfig.eligibilityVendorEnabled,
          endpointConfigured: Boolean(envConfig.stediEligibilityEndpoint.trim()),
          apiKeyConfigured: Boolean(envConfig.stediEligibilityApiKey.trim()),
        },
        stediClaimSubmission: {
          enabled: claimSubmissionIntegrationConfig.enabled,
          submitEndpointConfigured: Boolean(claimSubmissionIntegrationConfig.request.submitUrl),
          apiKeyConfigured: Boolean(claimSubmissionIntegrationConfig.stedi.apiKey),
          usageIndicator: claimSubmissionIntegrationConfig.request.usageIndicator,
          webhookSecretConfigured: Boolean(claimSubmissionIntegrationConfig.webhook.secret),
        },
        eligibilityVendor: eligibilityIntegrationConfig.vendorName,
      },
      metrics: {
        webhookEventsByStatus: webhookCounts,
        claimSubmissionsByStatus: submissionCounts,
        eraReconciliationByStatus: eraCounts,
        pendingAcknowledgements,
        acceptedClaimsAwaitingEra,
        pendingEraCount: acceptedClaimsAwaitingEra,
        eraExceptions,
        eraExceptionWorkbenchOpen: eraExceptionCount,
        postingImbalances,
        staleQueueJobs,
        recoveredQueueJobs,
        eraDelayedClaims,
        eraFollowUpJobs,
        overdueDenials,
        overdueAppeals,
        staleCorrectedClaims,
        latestFailedJob: latestFailedJob
          ? {
            id: String(latestFailedJob._id),
            jobType: latestFailedJob.jobType,
            status: latestFailedJob.status,
            attempts: latestFailedJob.attempts,
            lastError: latestFailedJob.lastError,
            updated: latestFailedJob.updated,
          }
          : null,
        latestWebhookEvent: latestWebhookEvent
          ? {
            id: String(latestWebhookEvent._id),
            eventType: latestWebhookEvent.eventType,
            status: latestWebhookEvent.status,
            updated: latestWebhookEvent.updated,
          }
          : null,
      },
    };
  },
};
