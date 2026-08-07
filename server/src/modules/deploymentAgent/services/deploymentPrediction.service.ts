import { Types } from 'mongoose';
import {
  DeploymentPrediction,
  IChangedFile,
  ICommitEntry,
  IImpactedComponent,
  IPredictionRisk,
  PredictionRecommendation,
} from '../models/deploymentPrediction.model';
import { IApplication, IComponent } from '../models/application.model';
import { IDeploymentTarget } from '../models/deploymentTarget.model';
import { Deployment, ICommitInfo } from '../models/deployment.model';
import { DeploymentHealthCheckLog } from '../models/deploymentHealthCheckLog.model';
import { applicationService } from './application.service';
import { deploymentTargetService } from './deploymentTarget.service';
import { sshUtil } from '../utils/ssh.util';
import { deploymentPathUtil } from '../utils/path.util';
import { envConfig } from '../../../config/env.config';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export interface PredictDeploymentInput {
  applicationId: string;
  targetId: string;
  branch?: string;
  commitSha?: string;
  commit?: ICommitInfo;
  changedFiles?: IChangedFile[];
  triggeredBy?: Types.ObjectId;
}

interface AiPredictionResult {
  riskScore: number;
  failureProbability: number;
  confidenceScore: number;
  recommendation: PredictionRecommendation;
  summary: string;
  risks: IPredictionRisk[];
  impactedComponents: IImpactedComponent[];
  recommendations: string[];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function requireScore(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new AppError(`AI prediction response is missing a valid ${field}.`, HTTP_STATUS.BAD_GATEWAY);
  }
  return clamp(num);
}

const VALID_SEVERITIES: ReadonlyArray<IPredictionRisk['severity']> = ['low', 'medium', 'high', 'critical'];

/**
 * Correct LLM recommendation inconsistencies.
 *
 * The LLM produces a recommendation independently of the numeric scores it also
 * generates, so they can disagree. Apply deterministic thresholds as a post-processing
 * step to guarantee the recommendation always matches the scores:
 *
 *   proceed              : riskScore <  35  AND failureProbability <  25
 *   proceed_with_caution : riskScore 35–69  OR  failureProbability 25–59
 *   block                : riskScore >= 70  OR  failureProbability >= 60
 *
 * The LLM's recommendation is used only when the scores fall in the middle band
 * (where either value could be argued either way). Hard floor/ceiling rules prevent
 * obviously wrong results like proceed_with_caution at risk=12/failure=5.
 */
function normalizeRecommendation(
  riskScore: number,
  failureProbability: number,
  aiRecommendation: PredictionRecommendation,
): PredictionRecommendation {
  if (riskScore >= 70 || failureProbability >= 60) return 'block';
  if (riskScore < 35 && failureProbability < 25) return 'proceed';
  // Middle band: trust the LLM, but never allow "proceed" when scores aren't low
  return aiRecommendation === 'proceed' ? 'proceed_with_caution' : aiRecommendation;
}

/**
 * Coerce LLM-returned risks to the persisted schema's contract. The model
 * enforces a `severity` enum and a required `issue`, so a stray value (e.g.
 * `severity: "moderate"`) or a missing field would otherwise throw a Mongoose
 * ValidationError and fail the whole prediction. Drop unusable entries and
 * normalise the rest rather than trusting the model's exact shape.
 */
function sanitizeAiRisks(input: unknown): IPredictionRisk[] {
  if (!Array.isArray(input)) return [];
  const out: IPredictionRisk[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const issue = typeof o.issue === 'string' ? o.issue.trim() : '';
    if (!issue) continue; // required by the schema
    const sev = String(o.severity ?? '').toLowerCase();
    out.push({
      severity: (VALID_SEVERITIES as readonly string[]).includes(sev)
        ? (sev as IPredictionRisk['severity'])
        : 'medium',
      area: typeof o.area === 'string' && o.area.trim() ? o.area.trim() : 'commit',
      issue,
      mitigation: typeof o.mitigation === 'string' && o.mitigation.trim() ? o.mitigation.trim() : undefined,
    });
  }
  return out;
}

/** Coerce LLM-returned impacted components; `key` is required by the schema. */
function sanitizeAiImpacted(input: unknown): IImpactedComponent[] {
  if (!Array.isArray(input)) return [];
  const out: IImpactedComponent[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key.trim() : '';
    if (!key) continue; // required by the schema
    out.push({
      key,
      type: typeof o.type === 'string' ? o.type : undefined,
      reason: typeof o.reason === 'string' ? o.reason : undefined,
      downstream: Boolean(o.downstream),
    });
  }
  return out;
}

/** Coerce LLM-returned recommendations to non-empty strings (model field is [String]). */
function sanitizeAiRecommendations(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((r) => {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object') {
        const o = r as Record<string, unknown>;
        return String(o.text ?? o.recommendation ?? o.message ?? '');
      }
      return r == null ? '' : String(r);
    })
    .map((s) => s.trim())
    .filter(Boolean);
}

export const deploymentPredictionService = {
  /**
   * Build a static service dependency graph from the application's component map.
   * node-api components are services (with ports); react-ui/static front ends are
   * treated as downstream consumers of every node-api in the same application.
   */
  buildDependencyGraph(application: IApplication) {
    const nodes = application.components.map((c) => ({
      key: c.key,
      type: c.type,
      port: c.port,
    }));

    const apis = application.components.filter((c) => c.type === 'node-api');
    const consumers = application.components.filter((c) => c.type === 'react-ui' || c.type === 'static');

    const edges: Array<{ from: string; to: string; relation: string }> = [];
    for (const consumer of consumers) {
      for (const api of apis) {
        edges.push({ from: consumer.key, to: api.key, relation: 'consumes-api' });
      }
    }
    return { nodes, edges };
  },

  /** Map changed file paths to the components whose source they belong to. */
  _componentsForFiles(application: IApplication, changedFiles: IChangedFile[]): IComponent[] {
    if (!changedFiles.length) return [];
    const touched = new Set<string>();
    for (const file of changedFiles) {
      for (const comp of application.components) {
        const prefix = comp.sourcePath?.replace(/^\.\//, '').replace(/\/$/, '');
        // monorepo: match by sourcePath prefix; multi-repo single component: everything maps to it.
        if (!prefix || application.components.length === 1) {
          touched.add(comp.key);
        } else if (file.path.startsWith(`${prefix}/`) || file.path === prefix) {
          touched.add(comp.key);
        }
      }
    }
    return application.components.filter((c) => touched.has(c.key));
  },

  /**
   * Best-effort: read the changed files between the deployed HEAD and the target branch tip
   * over SSH. Returns [] on any failure (e.g. first-ever deploy, repo not present); the AI
   * response must reflect the lower confidence caused by sparse source context.
   */
  async gatherChangedFiles(application: IApplication, target: IDeploymentTarget, branch: string): Promise<IChangedFile[]> {
    try {
      const sshConfig = await deploymentTargetService.getSshConfig(target);
      const isSingle = application.layout === 'multi-repo' && application.components.length === 1;
      const comp = application.components[0];
      if (!comp) return [];
      const currentDir = deploymentPathUtil.componentCurrentSymlink(target.baseWebRoot, application.name, comp.key, isSingle);
      const sourcePath = comp.sourcePath?.replace(/^\.\//, '');
      const workDir = sourcePath ? `${currentDir}/${sourcePath}` : currentDir;
      const safeBranch = branch.replace(/[^a-zA-Z0-9._\/-]/g, '');

      const cmd = [
        `cd "${workDir}" 2>/dev/null || exit 3`,
        `git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 3`,
        `git fetch origin "${safeBranch}" --quiet 2>/dev/null || exit 4`,
        `git diff --name-status HEAD "origin/${safeBranch}" 2>/dev/null | head -120`,
      ].join(' && ');

      const result = await sshUtil.executeOnce(sshConfig, cmd, 30000);
      if (result.code !== 0 || !result.stdout.trim()) return [];

      const files = result.stdout
        .trim()
        .split('\n')
        .map((line) => {
          const parts = line.trim().split('\t');
          if (parts.length < 2) return null;
          const changeType = parts[0].trim().charAt(0) || 'unknown';
          const path = parts[parts.length - 1].trim(); // handles rename "R100 old new"
          return { path, changeType };
        })
        .filter((f): f is IChangedFile => Boolean(f && f.path));

      const enriched: IChangedFile[] = [];
      for (const file of files.slice(0, 40)) {
        const safePath = file.path.replace(/"/g, '\\"');
        const diffCmd = [
          `cd "${workDir}" 2>/dev/null || exit 3`,
          `git diff --numstat HEAD "origin/${safeBranch}" -- "${safePath}" 2>/dev/null | head -1`,
          `printf '\\n---DIFF---\\n'`,
          `git diff --unified=3 --no-ext-diff HEAD "origin/${safeBranch}" -- "${safePath}" 2>/dev/null | head -220`,
        ].join(' && ');
        const diffResult = await sshUtil.executeOnce(sshConfig, diffCmd, 15000);
        if (diffResult.code !== 0 || !diffResult.stdout.trim()) {
          enriched.push(file);
          continue;
        }
        const [numstatRaw, diffRaw = ''] = diffResult.stdout.split('\n---DIFF---\n');
        const [additionsRaw, deletionsRaw] = (numstatRaw || '').trim().split(/\s+/);
        const additions = Number(additionsRaw);
        const deletions = Number(deletionsRaw);
        enriched.push({
          ...file,
          additions: Number.isFinite(additions) ? additions : undefined,
          deletions: Number.isFinite(deletions) ? deletions : undefined,
          diff: diffRaw.trim().slice(0, 12000) || undefined,
        });
      }

      return [...enriched, ...files.slice(enriched.length)];
    } catch {
      return [];
    }
  },

  /**
   * Best-effort: resolve the current deployed HEAD commit (sha, message, author, date).
   * Called only when no incoming commits were detected, so the fetch has already run
   * in gatherCommits; we simply read the local HEAD.
   */
  async gatherCurrentHead(application: IApplication, target: IDeploymentTarget, branch: string): Promise<ICommitEntry | null> {
    try {
      const sshConfig = await deploymentTargetService.getSshConfig(target);
      const isSingle = application.layout === 'multi-repo' && application.components.length === 1;
      const comp = application.components[0];
      if (!comp) return null;
      const currentDir = deploymentPathUtil.componentCurrentSymlink(target.baseWebRoot, application.name, comp.key, isSingle);
      const sourcePath = comp.sourcePath?.replace(/^\.\//, '');
      const workDir = sourcePath ? `${currentDir}/${sourcePath}` : currentDir;
      const safeBranch = branch.replace(/[^a-zA-Z0-9._\/-]/g, '');

      const cmd = [
        `cd "${workDir}" 2>/dev/null || exit 3`,
        `git fetch origin "${safeBranch}" --quiet 2>/dev/null || true`,
        `git log -1 --pretty=format:"%H\t%s\t%an\t%ai" 2>/dev/null`,
      ].join(' && ');

      const result = await sshUtil.executeOnce(sshConfig, cmd, 20000);
      if (result.code !== 0 || !result.stdout.trim()) return null;

      const [sha, message, author, date] = result.stdout.trim().split('\t');
      if (!sha?.trim()) return null;
      return {
        sha: sha.trim(),
        message: message?.trim() || undefined,
        author: author?.trim() || undefined,
        date: date?.trim() || undefined,
      };
    } catch {
      return null;
    }
  },

  /**
   * Best-effort: list commits between the deployed HEAD and the incoming branch tip over SSH.
   * Returns [] on any failure (e.g. first deploy, repo absent). Each line from git log is
   * formatted as "sha\tmessage\tauthor\tdate" — the SHA is split off first so tab characters
   * inside a commit message don't break the parse.
   */
  async gatherCommits(application: IApplication, target: IDeploymentTarget, branch: string): Promise<ICommitEntry[]> {
    try {
      const sshConfig = await deploymentTargetService.getSshConfig(target);
      const isSingle = application.layout === 'multi-repo' && application.components.length === 1;
      const comp = application.components[0];
      if (!comp) return [];
      const currentDir = deploymentPathUtil.componentCurrentSymlink(target.baseWebRoot, application.name, comp.key, isSingle);
      const sourcePath = comp.sourcePath?.replace(/^\.\//, '');
      const workDir = sourcePath ? `${currentDir}/${sourcePath}` : currentDir;
      const safeBranch = branch.replace(/[^a-zA-Z0-9._\/-]/g, '');

      const cmd = [
        `cd "${workDir}" 2>/dev/null || exit 3`,
        `git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 3`,
        `git fetch origin "${safeBranch}" --quiet 2>/dev/null || exit 4`,
        `git log HEAD.."origin/${safeBranch}" --pretty=format:"%H\t%s\t%an\t%ai" 2>/dev/null | head -50`,
      ].join(' && ');

      const result = await sshUtil.executeOnce(sshConfig, cmd, 20000);
      if (result.code !== 0 || !result.stdout.trim()) return [];

      const entries: ICommitEntry[] = [];
      for (const line of result.stdout.trim().split('\n')) {
        const [sha, message, author, date] = line.split('\t');
        if (!sha?.trim()) continue;
        entries.push({
          sha: sha.trim(),
          message: message?.trim() || undefined,
          author: author?.trim() || undefined,
          date: date?.trim() || undefined,
        });
      }
      return entries;
    } catch {
      return [];
    }
  },

  /**
   * Combined gather: one SSH connection, one git fetch, then both the commit log and
   * the file diff in the same session.
   *
   * WHY THIS EXISTS — two bugs in the original approach of calling gatherChangedFiles
   * and gatherCommits concurrently via Promise.all:
   *
   *   1. Concurrent fetch lock collision: both calls opened separate SSH connections
   *      and ran `git fetch` on the same .git directory simultaneously. Git serialises
   *      ref updates through a lock file (.git/refs/remotes/origin/<branch>.lock).
   *      When two fetches race, the loser exits non-zero, `|| exit 4` fires, and
   *      result.code !== 0 causes that gather to silently return []. Both returning []
   *      made the predict service incorrectly conclude "no changes".
   *
   *   2. Push-to-remote propagation delay: when the user commits and immediately
   *      triggers predict, the git hosting service (GitHub/GitLab) may not have
   *      propagated the new ref to the replica the deployment server fetches from.
   *      The single fetch with a one-shot retry (sleep 3) gives the remote time to
   *      converge without adding latency to the normal (already-propagated) case.
   *
   * Output is one SSH round-trip that emits three sections separated by sentinels:
   *   <head sha>\t<subject>\t<author>\t<date>
   *   \n---COMMITS---\n
   *   <sha>\t<subject>\t<author>\t<date>   (0-N lines)
   *   \n---FILES---\n
   *   <status>\t<path>                     (0-N lines)
   */
  async gatherChanges(application: IApplication, target: IDeploymentTarget, branch: string): Promise<{
    changedFiles: IChangedFile[];
    commits: ICommitEntry[];
    currentHead: ICommitEntry | null;
  }> {
    const empty = { changedFiles: [], commits: [], currentHead: null };
    try {
      const sshConfig = await deploymentTargetService.getSshConfig(target);
      const isSingle = application.layout === 'multi-repo' && application.components.length === 1;
      const comp = application.components[0];
      if (!comp) return empty;
      const currentDir = deploymentPathUtil.componentCurrentSymlink(target.baseWebRoot, application.name, comp.key, isSingle);
      const sourcePath = comp.sourcePath?.replace(/^\.\//, '');
      const workDir = sourcePath ? `${currentDir}/${sourcePath}` : currentDir;
      const safeBranch = branch.replace(/[^a-zA-Z0-9._\/-]/g, '');

      // One fetch with a built-in retry: if the first attempt fails (lock held by a
      // concurrent deployment pipeline fetch, or a transient network blip), wait 3 s
      // and try once more before giving up. The retry also covers the push-propagation
      // window — by the time 3 s have elapsed, the remote replica is almost always
      // consistent with the newly pushed commit.
      const cmd = [
        `cd "${workDir}" 2>/dev/null || exit 3`,
        `git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 3`,
        `git fetch origin "${safeBranch}" --quiet 2>/dev/null || (sleep 3 && git fetch origin "${safeBranch}" --quiet 2>/dev/null) || exit 4`,
        `git log -1 --pretty=format:"%H%x09%s%x09%an%x09%ai" HEAD 2>/dev/null`,
        `printf '\\n---COMMITS---\\n'`,
        `git log HEAD.."origin/${safeBranch}" --pretty=format:"%H%x09%s%x09%an%x09%ai" 2>/dev/null | head -50`,
        `printf '\\n---FILES---\\n'`,
        `git diff --name-status HEAD "origin/${safeBranch}" 2>/dev/null | head -120`,
      ].join(' && ');

      const result = await sshUtil.executeOnce(sshConfig, cmd, 55000);
      if (result.code !== 0) return empty;

      // Parse the three sections. Split order matters: FILES first, then COMMITS,
      // so the head line is whatever remains before the COMMITS sentinel.
      const [headAndCommits = '', filesRaw = ''] = result.stdout.split('\n---FILES---\n');
      const [headLine = '', commitsRaw = ''] = headAndCommits.split('\n---COMMITS---\n');

      // HEAD commit
      let currentHead: ICommitEntry | null = null;
      const headTrimmed = headLine.trim();
      if (headTrimmed) {
        const [sha, message, author, date] = headTrimmed.split('\t');
        if (sha?.trim()) {
          currentHead = {
            sha: sha.trim(),
            message: message?.trim() || undefined,
            author: author?.trim() || undefined,
            date: date?.trim() || undefined,
          };
        }
      }

      // Incoming commits (HEAD..origin/branch)
      const commits: ICommitEntry[] = [];
      for (const line of commitsRaw.trim().split('\n')) {
        const [sha, message, author, date] = line.split('\t');
        if (!sha?.trim()) continue;
        commits.push({
          sha: sha.trim(),
          message: message?.trim() || undefined,
          author: author?.trim() || undefined,
          date: date?.trim() || undefined,
        });
      }

      // Changed files (name-status)
      const rawFiles: IChangedFile[] = [];
      for (const line of filesRaw.trim().split('\n')) {
        const parts = line.trim().split('\t');
        if (parts.length < 2) continue;
        const changeType = parts[0].trim().charAt(0) || 'unknown';
        const path = parts[parts.length - 1].trim(); // handles R100\told\tnew renames
        if (path) rawFiles.push({ path, changeType });
      }

      // Enrich up to 40 files with per-file diff stats (no extra fetch needed — the
      // remote tracking ref is already up to date from the fetch above).
      const enriched: IChangedFile[] = [];
      for (const file of rawFiles.slice(0, 40)) {
        const safePath = file.path.replace(/"/g, '\\"');
        const diffCmd = [
          `cd "${workDir}" 2>/dev/null || exit 3`,
          `git diff --numstat HEAD "origin/${safeBranch}" -- "${safePath}" 2>/dev/null | head -1`,
          `printf '\\n---DIFF---\\n'`,
          `git diff --unified=3 --no-ext-diff HEAD "origin/${safeBranch}" -- "${safePath}" 2>/dev/null | head -220`,
        ].join(' && ');
        const diffResult = await sshUtil.executeOnce(sshConfig, diffCmd, 15000);
        if (diffResult.code !== 0 || !diffResult.stdout.trim()) {
          enriched.push(file);
          continue;
        }
        const [numstatRaw, diffRaw = ''] = diffResult.stdout.split('\n---DIFF---\n');
        const [additionsRaw, deletionsRaw] = (numstatRaw || '').trim().split(/\s+/);
        const additions = Number(additionsRaw);
        const deletions = Number(deletionsRaw);
        enriched.push({
          ...file,
          additions: Number.isFinite(additions) ? additions : undefined,
          deletions: Number.isFinite(deletions) ? deletions : undefined,
          diff: diffRaw.trim().slice(0, 12000) || undefined,
        });
      }

      return {
        changedFiles: [...enriched, ...rawFiles.slice(enriched.length)],
        commits,
        currentHead,
      };
    } catch {
      return empty;
    }
  },

  /** Serialise the application for the LLM without leaking secrets (no env var values). */
  _sanitizeApplication(application: IApplication) {
    return {
      name: application.name,
      layout: application.layout,
      repository: {
        url: application.repository.url,
        provider: application.repository.provider,
        branch: application.repository.branch,
      },
      components: application.components.map((c) => ({
        key: c.key,
        type: c.type,
        sourcePath: c.sourcePath,
        port: c.port,
        nodeVersion: c.nodeVersion,
        installCommand: c.installCommand,
        buildCommand: c.buildCommand,
        startCommand: c.startCommand,
        healthCheckPath: c.healthCheckPath,
        healthCheckUrl: c.healthCheckUrl,
      })),
    };
  },

  async gatherOperationalContext(applicationId: string, targetId: string) {
    const [recentDeployments, recentHealthChecks] = await Promise.all([
      Deployment.find({
        applicationId: new Types.ObjectId(applicationId),
        targetId: new Types.ObjectId(targetId),
        active: true,
      })
        .sort({ created: -1 })
        .limit(10)
        .select('status branch commitSha commit trigger steps durationMs error startedAt completedAt created')
        .lean(),
      DeploymentHealthCheckLog.find({
        applicationId: new Types.ObjectId(applicationId),
        targetId: new Types.ObjectId(targetId),
      })
        .sort({ timestamp: -1 })
        .limit(30)
        .select('componentKey url status httpCode responseTimeMs error timestamp')
        .lean(),
    ]);

    return { recentDeployments, recentHealthChecks };
  },

  /**
   * Predict-then-deploy: produce deployment intelligence BEFORE a deployment is triggered,
   * persist it, and return the record for review in the UI.
   */
  async predict(input: PredictDeploymentInput) {
    const [application, target] = await Promise.all([
      applicationService.getById(input.applicationId),
      deploymentTargetService.getById(input.targetId),
    ]);

    const branch = input.branch || application.repository.branch || 'main';
    const commit: ICommitInfo | undefined = input.commit || (input.commitSha ? { sha: input.commitSha, ref: `refs/heads/${branch}` } : undefined);

    // Use the combined gather so that a single git fetch is shared by both the commit
    // log and the file diff. Running two concurrent fetches on the same .git directory
    // caused lock collisions where one or both returned [] (see gatherChanges for full
    // explanation). When changedFiles are provided externally (webhook path) we only
    // need commits, so gatherCommits alone is fine — no concurrent fetch in that case.
    let changedFiles: IChangedFile[];
    let commits: ICommitEntry[];
    let currentHead: ICommitEntry | null = null;

    if (input.changedFiles?.length) {
      changedFiles = input.changedFiles;
      commits = await this.gatherCommits(application, target, branch);
    } else {
      const changes = await this.gatherChanges(application, target, branch);
      changedFiles = changes.changedFiles;
      commits = changes.commits;
      currentHead = changes.currentHead;
    }

    const dependencyGraph = this.buildDependencyGraph(application);

    // No new commits and no changed files → the deployed version is already current.
    // Skip the LLM entirely and persist a lightweight no_changes prediction so the
    // user still gets traceability and can proceed with a forced re-deploy if needed.
    // currentHead comes from the same SSH session as the gather — no extra fetch needed.
    if (!changedFiles.length && !commits.length) {
      const resolvedCommit: ICommitInfo | undefined = input.commit
        ?? (currentHead ? { sha: currentHead.sha, ref: `refs/heads/${branch}`, message: currentHead.message, author: currentHead.author } : undefined);

      return DeploymentPrediction.create({
        applicationId: new Types.ObjectId(input.applicationId),
        targetId: new Types.ObjectId(input.targetId),
        branch,
        commit: resolvedCommit,
        commits: [],
        changedFiles: [],
        riskScore: 0,
        failureProbability: 0,
        confidenceScore: 0,
        recommendation: 'proceed',
        summary: 'No new commits were found since the last successful deployment. The production environment is already up to date.',
        risks: [],
        impactedComponents: [],
        recommendations: [],
        dependencyGraph,
        source: 'no_changes',
        noChangesDetected: true,
        triggeredBy: input.triggeredBy,
        active: true,
        created: new Date(),
        updated: new Date(),
      });
    }

    const operationalContext = await this.gatherOperationalContext(input.applicationId, input.targetId);

    let res: Response;
    try {
      res = await fetch(`${envConfig.crewaiApiUrl}/deployment/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application: this._sanitizeApplication(application),
          target: { host: target.host, os: target.os, reverseProxy: target.reverseProxy },
          commit: commit || {},
          commits,
          changedFiles,
          components: this._sanitizeApplication(application).components,
          dependencyGraph,
          operationalContext,
        }),
        signal: AbortSignal.timeout(180000), // 3 minutes
      });
    } catch (err) {
      const cause = err instanceof Error ? (err as NodeJS.ErrnoException & { cause?: Error }).cause : undefined;
      const detail = cause instanceof Error ? cause.message : (cause != null ? String(cause) : undefined);
      console.error('[DeploymentPrediction] fetch to AgenticServer failed:', err, 'cause:', cause);
      throw new AppError(
        `AI deployment prediction could not be generated because the LLM service is unavailable: ${err instanceof Error ? err.message : 'request failed'}${detail ? ` — ${detail}` : ''}.`,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
      );
    }

    if (!res.ok) {
      throw new AppError(`AI deployment prediction failed with status ${res.status}.`, HTTP_STATUS.BAD_GATEWAY);
    }

    const json = (await res.json()) as { success?: boolean; data?: Partial<AiPredictionResult>; raw?: string };
    if (!json.success || !json.data) {
      const reason = typeof json.data === 'object' && json.data && 'error' in json.data
        ? String((json.data as Record<string, unknown>).error)
        : 'LLM did not return a valid prediction.';
      throw new AppError(`AI deployment prediction could not be generated: ${reason}`, HTTP_STATUS.BAD_GATEWAY);
    }

    const d = json.data;
    const recommendation = String(d.recommendation || '').trim() as PredictionRecommendation;
    if (!['proceed', 'proceed_with_caution', 'block'].includes(recommendation)) {
      throw new AppError('AI prediction response is missing a valid recommendation.', HTTP_STATUS.BAD_GATEWAY);
    }
    const summary = typeof d.summary === 'string' ? d.summary.trim() : '';
    if (!summary) {
      throw new AppError('AI prediction response is missing reasoning summary.', HTTP_STATUS.BAD_GATEWAY);
    }

    const riskScore = requireScore(d.riskScore, 'riskScore');
    const failureProbability = requireScore(d.failureProbability, 'failureProbability');
    const confidenceScore = requireScore(d.confidenceScore, 'confidenceScore');

    const result: AiPredictionResult = {
      riskScore,
      failureProbability,
      confidenceScore,
      recommendation: normalizeRecommendation(riskScore, failureProbability, recommendation),
      summary,
      risks: sanitizeAiRisks(d.risks),
      impactedComponents: sanitizeAiImpacted(d.impactedComponents),
      recommendations: sanitizeAiRecommendations(d.recommendations),
    };

    const buildDoc = (r: AiPredictionResult) => ({
      applicationId: new Types.ObjectId(input.applicationId),
      targetId: new Types.ObjectId(input.targetId),
      branch,
      commit,
      commits,
      changedFiles,
      riskScore: r.riskScore,
      failureProbability: r.failureProbability,
      confidenceScore: r.confidenceScore,
      recommendation: r.recommendation,
      summary: r.summary,
      risks: r.risks,
      impactedComponents: r.impactedComponents,
      recommendations: r.recommendations,
      dependencyGraph,
      source: 'ai',
      triggeredBy: input.triggeredBy,
      active: true,
      created: new Date(),
      updated: new Date(),
    });

    return DeploymentPrediction.create(buildDoc(result));
  },

  /**
   * Record an honest "prediction unavailable" entry when an LLM-based prediction
   * could not be generated for an auto-deploy (the AI service was unreachable, timed
   * out, or returned an invalid response). Predictions are LLM-only by policy — this
   * carries NO heuristic/synthetic risk scores, only the failure reason — so the
   * auto-deploy stays traceable in Prediction History while still proceeding.
   *
   * Deliberately self-contained: no SSH, LLM call, or extra DB lookups, so persisting
   * this record cannot itself fail the deployment it is meant to accompany.
   */
  async recordUnavailable(input: {
    applicationId: string;
    targetId: string;
    branch?: string;
    commit?: ICommitInfo;
    commitSha?: string;
    triggeredBy?: Types.ObjectId;
    reason: string;
  }) {
    const branch = input.branch || 'main';
    const commit: ICommitInfo | undefined =
      input.commit || (input.commitSha ? { sha: input.commitSha, ref: `refs/heads/${branch}` } : undefined);

    return DeploymentPrediction.create({
      applicationId: new Types.ObjectId(input.applicationId),
      targetId: new Types.ObjectId(input.targetId),
      branch,
      commit,
      commits: [],
      changedFiles: [],
      // No synthetic scores — these are placeholders the UI suppresses for this source.
      riskScore: 0,
      failureProbability: 0,
      confidenceScore: 0,
      recommendation: 'proceed',
      summary: input.reason,
      risks: [],
      impactedComponents: [],
      recommendations: [],
      source: 'unavailable',
      predictionUnavailable: true,
      predictionError: input.reason,
      triggeredBy: input.triggeredBy,
      active: true,
      created: new Date(),
      updated: new Date(),
    });
  },

  async list(query: { applicationId?: string; targetId?: string; recommendation?: string; source?: string; page?: string; limit?: string }) {
    const filter: Record<string, unknown> = { active: true };
    if (query.applicationId) filter.applicationId = new Types.ObjectId(query.applicationId);
    if (query.targetId) filter.targetId = new Types.ObjectId(query.targetId);
    if (query.recommendation) filter.recommendation = query.recommendation;
    if (query.source) filter.source = query.source;

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      DeploymentPrediction.find(filter)
        .sort({ created: -1 })
        .skip(skip)
        .limit(limit)
        .populate('applicationId', 'name displayName')
        .populate('targetId', 'name host')
        .populate('deploymentId', 'status startedAt trigger'),
      DeploymentPrediction.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  },

  async getById(id: string) {
    const prediction = await DeploymentPrediction.findOne({ _id: id, active: true })
      .populate('applicationId', 'name displayName')
      .populate('targetId', 'name host')
      .populate('deploymentId', 'status startedAt completedAt durationMs commit trigger');
    if (!prediction) {
      throw new AppError('Prediction not found.', HTTP_STATUS.NOT_FOUND);
    }
    return prediction;
  },

  async getByDeployment(deploymentId: string) {
    return DeploymentPrediction.findOne({ deploymentId: new Types.ObjectId(deploymentId), active: true }).sort({ created: -1 });
  },

  /** Map a prediction to the deployment it produced (called from the trigger flow). */
  async linkToDeployment(predictionId: string, deploymentId: Types.ObjectId) {
    await DeploymentPrediction.updateOne(
      { _id: predictionId },
      { deploymentId, proceeded: true, updated: new Date() },
    );
  },
};
