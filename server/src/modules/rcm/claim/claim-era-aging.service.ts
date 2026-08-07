import { envConfig } from '../../../config/env.config';
import { Claim } from './claim.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { registerRcmJobHandler } from '../background-job/rcm-queue.service';
import { appendStatusHistory } from '../workflow/workflow-history';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { assignAuditActor, auditActorPatch, normalizeObjectIdAuditActor } from '../shared/audit-actor.util';

export async function runAwaitingEraAgingCheck(updatedBy = 'rcm-era-aging') {
  const cutoff = new Date(Date.now() - envConfig.rcmAwaitingEraThresholdDays * 24 * 60 * 60 * 1000);
  const claims = await Claim.find({
    isDeleted: false,
    active: true,
    submissionStatus: 'Acknowledged',
    closureStatus: { $in: ['AWAITING_ERA', 'IN_PROGRESS', undefined] },
    $or: [
      { expectedEraBy: { $lte: new Date() } },
      { expectedEraBy: { $exists: false }, updated: { $lte: cutoff } },
    ],
  }).limit(100);

  for (const claim of claims) {
    const dedupeKey = `awaiting-era:${claim._id}`;
    const existing = await ArWorkItem.findOne({ dedupeKey, isDeleted: false });
    if (!existing) {
      await ArWorkItem.create({
        claimId: claim._id,
        patientId: claim.patientId,
        payerId: claim.payerId,
        category: 'AWAITING_ERA',
        status: 'OPEN',
        priority: 'High',
        reason: `ERA has not arrived within ${envConfig.rcmAwaitingEraThresholdDays} days.`,
        nextAction: 'Follow up with payer or clearinghouse for remittance status.',
        followUpDate: new Date(),
        dueDate: new Date(),
        sourceType: 'AWAITING_ERA_AGING',
        sourceId: claim._id,
        dedupeKey,
        active: true,
        created: new Date(),
        updated: new Date(),
        ...auditActorPatch('createdBy', updatedBy),
        ...auditActorPatch('updatedBy', updatedBy),
      });
    }

    claim.closureStatus = 'ERA_DELAYED';
    claim.lastPayerFollowUpAt = claim.lastPayerFollowUpAt ?? new Date();
    claim.followUpCount = (claim.followUpCount ?? 0) + 1;
    claim.statusHistory = appendStatusHistory(
      claim.statusHistory,
      'ERA_DELAYED',
      normalizeObjectIdAuditActor(updatedBy),
      'Accepted claim exceeded expected ERA threshold'
    );
    claim.updated = new Date();
    assignAuditActor(claim, 'updatedBy', updatedBy);
    await claim.save();

    publishRcmRealtimeEvent({
      eventType: 'CLAIM_ERA_DELAYED',
      title: 'ERA follow-up required',
      message: `Claim ${claim.claimId ?? claim._id} is waiting too long for ERA.`,
      entityType: 'claim',
      entityId: String(claim._id),
      claimId: String(claim._id),
      status: 'ERA_DELAYED',
    });
  }

  return { delayedClaims: claims.length };
}

registerRcmJobHandler('CHECK_AWAITING_ERA_AGING', async (job) => {
  await runAwaitingEraAgingCheck(String(job.updatedBy ?? 'rcm-era-aging'));
});
