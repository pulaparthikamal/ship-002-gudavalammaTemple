import { Router, Request, Response } from 'express';
import { Application, IApplication } from '../models/application.model';
import { deploymentService } from '../services/deployment.service';
import { trackDelivery } from '../services/deploymentQueue.service';
import { logger } from '../../../utils/logger.util';

const router = Router();

type CommitInfo = {
  sha?: string;
  message?: string;
  author?: string;
  ref: string;
};

type ChangedFile = { path: string; changeType: string };

type GitCommitNode = { added?: string[]; modified?: string[]; removed?: string[] };

// Aggregate the files changed across a push (newest change type wins per path).
function collectChangedFiles(commits: GitCommitNode[]): ChangedFile[] {
  const fileMap = new Map<string, string>();
  for (const c of commits) {
    for (const p of c.added ?? []) fileMap.set(p, 'A');
    for (const p of c.modified ?? []) fileMap.set(p, 'M');
    for (const p of c.removed ?? []) fileMap.set(p, 'D');
  }
  return Array.from(fileMap, ([path, changeType]) => ({ path, changeType }));
}

function enqueueDeployment(params: {
  appId: string;
  targetId: string;
  branch: string;
  commit: CommitInfo;
  deliveryId?: string;
  changedFiles?: ChangedFile[];
}): void {
  // Predict-Then-Deploy: trigger() runs the prediction workflow before the
  // pipeline when no predictionId is supplied (as is the case for webhooks).
  deploymentService.trigger({
    applicationId: params.appId,
    targetId: params.targetId,
    branch: params.branch,
    commitSha: params.commit.sha,
    trigger: 'webhook',
    commit: params.commit,
    deliveryId: params.deliveryId,
    changedFiles: params.changedFiles,
  }).catch((err) => {
    logger.error('[Webhook] Failed to enqueue deployment:', err?.message);
  });
}

// POST /api/v1/deploymentAgent/webhooks/github/:appId
router.post('/github/:appId', async (req: Request, res: Response) => {
  const { appId } = req.params;

  let application: IApplication | null;
  try {
    application = await Application.findOne({ _id: appId, active: true });
  } catch {
    return res.status(404).json({ error: 'Application not found.' });
  }

  if (!application) {
    return res.status(404).json({ error: 'Application not found.' });
  }

  const event = req.headers['x-github-event'] as string | undefined;
  const deliveryId = req.headers['x-github-delivery'] as string | undefined;

  if (event === 'ping') {
    return res.status(200).json({ ok: true });
  }

  if (deliveryId && !trackDelivery(deliveryId)) {
    return res.status(202).json({ ignored: true, reason: 'duplicate' });
  }

  const autoDeploy = application.autoDeploy;
  if (!autoDeploy?.enabled) {
    return res.status(202).json({ ignored: true, reason: 'auto-deploy disabled' });
  }

  const targetId = autoDeploy.targetId?.toString();
  if (!targetId) {
    return res.status(202).json({ ignored: true, reason: 'no auto-deploy target configured' });
  }

  const configuredBranch = autoDeploy.branch || application.repository.branch || 'main';

  if (event === 'pull_request') {
    const prPayload = req.body as {
      action?: string;
      pull_request?: {
        merged?: boolean;
        merge_commit_sha?: string | null;
        title?: string;
        base?: { ref?: string };
        user?: { login?: string };
      };
    };

    if (prPayload.action !== 'closed' || !prPayload.pull_request?.merged) {
      return res.status(202).json({ ignored: true, reason: 'pull_request not merged' });
    }

    const mergedIntoBranch = prPayload.pull_request.base?.ref || '';
    if (mergedIntoBranch !== configuredBranch) {
      return res.status(202).json({ ignored: true, reason: `branch mismatch (merged into: ${mergedIntoBranch}, configured: ${configuredBranch})` });
    }

    const commit: CommitInfo = {
      sha: prPayload.pull_request.merge_commit_sha ?? undefined,
      message: prPayload.pull_request.title?.slice(0, 500),
      author: prPayload.pull_request.user?.login,
      ref: `refs/heads/${mergedIntoBranch}`,
    };

    enqueueDeployment({ appId, targetId, branch: mergedIntoBranch, commit, deliveryId });
    return res.status(202).json({ queued: true, branch: mergedIntoBranch, sha: commit.sha });
  }

  if (event !== 'push') {
    return res.status(202).json({ ignored: true, reason: `Unsupported event: ${event}` });
  }

  const payload = req.body as {
    ref?: string;
    deleted?: boolean;
    head_commit?: ({ id?: string; message?: string; author?: { name?: string } } & GitCommitNode) | null;
    commits?: GitCommitNode[];
    pusher?: { name?: string };
  };

  const ref = payload.ref || '';
  if (ref.startsWith('refs/tags/')) {
    return res.status(202).json({ ignored: true, reason: 'tag push' });
  }

  if (payload.deleted === true || !payload.head_commit) {
    return res.status(202).json({ ignored: true, reason: 'branch deletion or empty commit' });
  }

  const pushedBranch = ref.replace('refs/heads/', '');
  if (pushedBranch !== configuredBranch) {
    return res.status(202).json({ ignored: true, reason: `branch mismatch (pushed: ${pushedBranch}, configured: ${configuredBranch})` });
  }

  const commit: CommitInfo = {
    sha: payload.head_commit.id,
    message: payload.head_commit.message?.slice(0, 500),
    author: payload.head_commit.author?.name || payload.pusher?.name,
    ref,
  };

  // Prefer the full push commit range; fall back to the head commit's file lists.
  const changedFiles = collectChangedFiles(
    payload.commits?.length ? payload.commits : [payload.head_commit],
  );

  enqueueDeployment({ appId, targetId, branch: pushedBranch, commit, deliveryId, changedFiles });
  return res.status(202).json({ queued: true, branch: pushedBranch, sha: commit.sha });
});

export default router;
