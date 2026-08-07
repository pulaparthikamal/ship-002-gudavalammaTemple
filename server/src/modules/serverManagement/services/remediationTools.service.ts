import path from 'path';
import { IServerConnection } from '../models/serverConnection.model';
import {
  IRemediationStep,
  RemediationRiskLevel,
  RemediationToolName,
} from '../models/remediationJob.model';
import { configService } from './config.service';
import { monitoringService } from './monitoring.service';
import { scanService } from './scan.service';
import { shellQuote } from '../utils/shell.util';
import { sshService, SshCommandResult } from './ssh.service';
import { agentService } from './agent.service';
import { FileAction, IScanResult, ScanResult } from '../models/scanResult.model';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { DeletedFile } from '../models/deletedFile.model';

export interface RemediationToolCall {
  toolName: RemediationToolName;
  args: Record<string, unknown>;
  reasoning?: string;
}

export interface RemediationToolDefinition {
  name: RemediationToolName;
  description: string;
  riskLevel: RemediationRiskLevel;
  requiresApproval: boolean;
  supportsRollback: boolean;
  inputSchema: Record<string, string>;
}

interface RemediationExecutionContext {
  latestScanId?: string;
  latestScanSummary?: Record<string, unknown>;
  latestCleanupSummary?: CleanupSummary;
  beforeMetrics?: Record<string, unknown>;
  afterMetrics?: Record<string, unknown>;
  beforePrediction?: Record<string, unknown>;
  afterPrediction?: Record<string, unknown>;
  verification?: Record<string, unknown>;
  onProgress?: (progress: RemediationProgressUpdate) => Promise<void> | void;
}

interface RemediationProgressUpdate {
  phase: 'discovering' | 'cleaning' | 'finished';
  totalActions: number;
  processedActions: number;
  summary: CleanupSummary;
}

interface CleanupCandidate {
  scanResult: IScanResult;
  action: Exclude<FileAction, 'review'>;
  reason: string;
  decisionTrace: string[];
}

interface CleanupSummary {
  scanId?: string;
  scannedFiles: number;
  candidatesFound: number;
  executableCount: number;
  filesDeleted: number;
  filesArchived: number;
  filesIgnored: number;
  failedActions: number;
  skippedActions: number;
  spaceReclaimedMb: number;
  remainingIssues: number;
  optimizationActions: number;
  optimizationRecoveredMb: number;
  noSafeFixApplied: boolean;
  noSafeFixReason?: string;
  beforeMetrics?: Record<string, unknown>;
  afterMetrics?: Record<string, unknown>;
  beforePrediction?: Record<string, unknown>;
  afterPrediction?: Record<string, unknown>;
  verification?: Record<string, unknown>;
  details: Array<Record<string, unknown>>;
  errors: Array<Record<string, unknown>>;
}

const remediationCleanupCategories = ['duplicate', 'temp', 'logs', 'unused', 'large'] as const;
const protectedCategories = ['system', 'config', 'service', 'application'];
const cleanupConcurrency = Math.max(
  1,
  Math.min(Number(process.env.REMEDIATION_CLEANUP_CONCURRENCY) || 5, 10),
);
const deleteBatchSize = Math.max(
  10,
  Math.min(Number(process.env.REMEDIATION_DELETE_BATCH_SIZE) || 200, 500),
);
const archiveBatchSize = Math.max(
  5,
  Math.min(Number(process.env.REMEDIATION_ARCHIVE_BATCH_SIZE) || 25, 100),
);
const cleanupCommandTimeoutMs = Math.max(
  60000,
  Number(process.env.REMEDIATION_CLEANUP_COMMAND_TIMEOUT_MS) || 300000,
);
const remediationScanTimeoutMs = Math.max(
  60000,
  Number(process.env.REMEDIATION_SCAN_COMMAND_TIMEOUT_MS) ||
    Number(process.env.SERVER_SCAN_COMMAND_TIMEOUT_MS) ||
    180000,
);

const buildArchiveCommand = (filePath: string, archiveDirectory: string) => {
  const dirName = path.posix.dirname(filePath);
  const baseName = path.posix.basename(filePath);
  const archiveName = `${baseName.replace(/[^a-zA-Z0-9._-]/g, '_')}-${Date.now()}.tar.gz`;
  const destination = path.posix.join(archiveDirectory, archiveName);

  return [
    `mkdir -p ${shellQuote(archiveDirectory)}`,
    `tar -czf ${shellQuote(destination)} -C ${shellQuote(dirName)} ${shellQuote(baseName)}`,
    `test -s ${shellQuote(destination)}`,
    `tar -tzf ${shellQuote(destination)} >/dev/null`,
  ].join(' && ');
};

const toolDefinitions: Record<RemediationToolName, RemediationToolDefinition> = {
  collect_metrics: {
    name: 'collect_metrics',
    description: 'Collect the latest CPU, memory, disk, process, and network metrics.',
    riskLevel: 'low',
    requiresApproval: false,
    supportsRollback: false,
    inputSchema: {},
  },
  run_health_check: {
    name: 'run_health_check',
    description: 'Run a lightweight health check using uptime, memory, and root disk usage.',
    riskLevel: 'low',
    requiresApproval: false,
    supportsRollback: false,
    inputSchema: {},
  },
  start_scan: {
    name: 'start_scan',
    description: 'Scan configured directories for maintenance and operational files before cleanup.',
    riskLevel: 'low',
    requiresApproval: false,
    supportsRollback: false,
    inputSchema: {
      directories: 'string[] optional',
      includeFullServer: 'boolean optional',
    },
  },
  analyze_scan_results: {
    name: 'analyze_scan_results',
    description: 'Analyze the latest scan results and generate explainable recommendations.',
    riskLevel: 'low',
    requiresApproval: false,
    supportsRollback: false,
    inputSchema: {
      scanId: 'string optional',
    },
  },
  apply_scan_cleanup: {
    name: 'apply_scan_cleanup',
    description: 'Execute safe archive/delete/ignore actions for the latest scan results.',
    riskLevel: 'medium',
    requiresApproval: true,
    supportsRollback: false,
    inputSchema: {
      scanId: 'string optional',
      allowAutoApproveReviewedResults: 'boolean optional',
    },
  },
  safe_system_optimization: {
    name: 'safe_system_optimization',
    description: 'Run conservative cache, package, journal, and stale temporary-file optimization without touching application/config files.',
    riskLevel: 'medium',
    requiresApproval: true,
    supportsRollback: false,
    inputSchema: {
      reason: 'string optional',
    },
  },
  restart_service: {
    name: 'restart_service',
    description: 'Restart a systemd service on the remote server.',
    riskLevel: 'medium',
    requiresApproval: true,
    supportsRollback: true,
    inputSchema: {
      serviceName: 'string',
    },
  },
  kill_process: {
    name: 'kill_process',
    description: 'Terminate a process by PID on the remote server.',
    riskLevel: 'high',
    requiresApproval: true,
    supportsRollback: false,
    inputSchema: {
      pid: 'string | number',
    },
  },
  clear_cache: {
    name: 'clear_cache',
    description: 'Drop Linux filesystem caches after syncing memory to disk.',
    riskLevel: 'medium',
    requiresApproval: true,
    supportsRollback: false,
    inputSchema: {},
  },
  delete_file: {
    name: 'delete_file',
    description: 'Delete a file from the remote server by absolute path.',
    riskLevel: 'high',
    requiresApproval: true,
    supportsRollback: false,
    inputSchema: {
      path: 'string',
    },
  },
  archive_file: {
    name: 'archive_file',
    description: 'Archive a file into the configured archive directory and retain the original.',
    riskLevel: 'medium',
    requiresApproval: true,
    supportsRollback: false,
    inputSchema: {
      path: 'string',
    },
  },
  custom_command: {
    name: 'custom_command',
    description: 'Run a custom shell command. Reserved for legacy/manual flows only.',
    riskLevel: 'critical',
    requiresApproval: true,
    supportsRollback: false,
    inputSchema: {
      command: 'string',
    },
  },
};

const ensureString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Tool argument "${field}" must be a non-empty string.`);
  }

  return value.trim();
};

const ensureDirectories = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error('Tool argument "directories" must be an array of non-empty strings.');
  }

  return value.map((item) => item.trim());
};

const ensureOptionalBoolean = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Tool argument "${field}" must be a boolean.`);
  }

  return value;
};

const summarizeScanResult = (result: Awaited<ReturnType<typeof scanService.startScan>>) => ({
  scanId: result.scanId,
  fileCount: result.fileCount,
  reviewRequired: result.reviewRequired,
  automationBlockedUntilReview: result.automationBlockedUntilReview,
  analysis: result.analysis,
  automaticCleanup: result.automaticCleanup,
});

const resolveWorkflowScanId = (
  toolCall: RemediationToolCall,
  runtimeContext: RemediationExecutionContext | undefined,
  toolName: RemediationToolName,
) => {
  const scanId =
    (typeof toolCall.args.scanId === 'string' && toolCall.args.scanId.trim()) ||
    runtimeContext?.latestScanId;

  if (!scanId && runtimeContext) {
    throw new Error(`${toolName} requires a successful start_scan step or an explicit scanId.`);
  }

  return scanId;
};

const ageInDays = (date: Date) =>
  Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));

const hasAnyTag = (scanResult: IScanResult, categories: readonly string[]) =>
  categories.some(
    (category) => scanResult.category === category || scanResult.tags.includes(category as any),
  );

const isProtectedOperationalFile = (scanResult: IScanResult) =>
  hasAnyTag(scanResult, protectedCategories);

const isInsidePath = (filePath: string, directory: string) => {
  const normalizedDirectory = directory.replace(/\/+$/, '');
  return normalizedDirectory && (filePath === normalizedDirectory || filePath.startsWith(`${normalizedDirectory}/`));
};

const getLatestScanId = async (serverId: string) => {
  const latest = await ScanResult.findOne({ server: serverId })
    .select('scanId')
    .sort({ discoveredAt: -1 })
    .lean();
  return latest?.scanId;
};

const buildCleanupCandidates = async (
  serverId: string,
  scanId: string | undefined,
): Promise<{ scannedFiles: number; candidates: CleanupCandidate[]; skipped: Array<Record<string, unknown>> }> => {
  const config = await configService.get(serverId);
  const effectiveScanId = scanId || await getLatestScanId(serverId);
  const query: Record<string, unknown> = {
    server: serverId,
    actionStatus: 'none',
    $or: [
      { category: { $in: remediationCleanupCategories } },
      { tags: { $in: remediationCleanupCategories } },
      { contentHash: { $exists: true, $ne: null } },
    ],
  };

  if (effectiveScanId) {
    query.scanId = effectiveScanId;
  }

  const results = await ScanResult.find(query).sort({ sizeMb: -1, discoveredAt: -1 });
  const candidates: CleanupCandidate[] = [];
  const skipped: Array<Record<string, unknown>> = [];
  const duplicateGroups = new Map<string, IScanResult[]>();
  const alreadySelected = new Set<string>();

  for (const result of results) {
    if (result.contentHash) {
      const group = duplicateGroups.get(result.contentHash) || [];
      group.push(result);
      duplicateGroups.set(result.contentHash, group);
    }
  }

  for (const group of duplicateGroups.values()) {
    if (group.length < 2) {
      continue;
    }

    const ordered = [...group].sort((first, second) => {
      const firstModified = first.modifiedAt?.getTime() || first.lastAccessed.getTime();
      const secondModified = second.modifiedAt?.getTime() || second.lastAccessed.getTime();
      return secondModified - firstModified;
    });
    const [kept, ...duplicates] = ordered;

    for (const duplicate of duplicates) {
      if (isProtectedOperationalFile(duplicate)) {
        skipped.push({
          fileId: duplicate._id,
          path: duplicate.path,
          reason: 'Duplicate candidate is in a protected operational path.',
        });
        continue;
      }

      alreadySelected.add(String(duplicate._id));
      candidates.push({
        scanResult: duplicate,
        action: 'delete',
        reason: `Duplicate file removed; retained canonical copy at ${kept.path}.`,
        decisionTrace: [
          'Remediation cleanup detected duplicate content hash.',
          `Retained ${kept.path}.`,
          `Deleting duplicate copy ${duplicate.path}.`,
        ],
      });
    }
  }

  for (const result of results) {
    if (alreadySelected.has(String(result._id))) {
      continue;
    }

    if (config.archiveDirectory && isInsidePath(result.path, config.archiveDirectory)) {
      skipped.push({
        fileId: result._id,
        path: result.path,
        reason: 'Skipped archive directory contents.',
      });
      continue;
    }

    if (isProtectedOperationalFile(result)) {
      skipped.push({
        fileId: result._id,
        path: result.path,
        reason: 'Protected operational files require manual review.',
      });
      continue;
    }

    const tags = result.tags || [];
    const fileAgeDays = ageInDays(result.lastAccessed);
    const trace = [
      'Approved AI remediation cleanup evaluated this scan result.',
      `Category=${result.category}; tags=${tags.join(', ') || 'none'}; age=${fileAgeDays} days; size=${result.sizeMb} MB.`,
    ];

    if (hasAnyTag(result, ['temp']) && fileAgeDays >= Math.min(config.unusedFileDays, 7)) {
      candidates.push({
        scanResult: result,
        action: 'delete',
        reason: 'Temporary file exceeded the remediation cleanup age threshold.',
        decisionTrace: [...trace, 'Temporary cleanup approved.'],
      });
      continue;
    }

    if (hasAnyTag(result, ['logs']) && fileAgeDays >= Math.min(config.deleteOlderThanDays, 30)) {
      candidates.push({
        scanResult: result,
        action: 'delete',
        reason: 'Old log file exceeded the remediation cleanup age threshold.',
        decisionTrace: [...trace, 'Old log cleanup approved.'],
      });
      continue;
    }

    if (hasAnyTag(result, ['unused']) && fileAgeDays >= Math.min(config.deleteOlderThanDays, config.unusedFileDays)) {
      candidates.push({
        scanResult: result,
        action: 'delete',
        reason: 'Unused file exceeded the remediation cleanup age threshold.',
        decisionTrace: [...trace, 'Unused file cleanup approved.'],
      });
      continue;
    }

    if (hasAnyTag(result, ['large']) && result.sizeMb >= config.archiveLargeFileMb) {
      candidates.push({
        scanResult: result,
        action: 'archive',
        reason: 'Large file exceeded the configured archive threshold.',
        decisionTrace: [...trace, 'Large file archival approved.'],
      });
      continue;
    }

    if (result.aiRecommendation?.action === 'delete' || result.aiRecommendation?.action === 'archive') {
      candidates.push({
        scanResult: result,
        action: result.aiRecommendation.action,
        reason: result.aiRecommendation.reason,
        decisionTrace: [
          ...trace,
          ...(result.aiRecommendation.decisionTrace || []),
          'AI recommendation was approved by the remediation workflow.',
        ],
      });
      continue;
    }

    skipped.push({
      fileId: result._id,
      path: result.path,
      reason: 'No safe automated cleanup action matched.',
    });
  }

  return { scannedFiles: results.length, candidates, skipped };
};

interface BatchCleanupOutcome {
  id: string;
  status: 'success' | 'failed';
  message?: string;
  destination?: string;
  alreadyAbsent?: boolean;
}

const splitIntoBatches = <T>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const buildArchiveDestination = (candidate: CleanupCandidate, archiveDirectory: string) => {
  const baseName = path.posix.basename(candidate.scanResult.path);
  const safeBase = baseName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
  return path.posix.join(
    archiveDirectory,
    `${safeBase}-${String(candidate.scanResult._id)}-${Date.now()}.tar.gz`,
  );
};

const buildDeleteBatchCommand = (candidates: CleanupCandidate[]) => {
  const lines = ['set +e'];

  for (const candidate of candidates) {
    const filePath = shellQuote(candidate.scanResult.path);
    const id = shellQuote(String(candidate.scanResult._id));
    lines.push(
      [
        `if [ -e ${filePath} ]; then`,
        'err=$(mktemp);',
        `if rm -f -- ${filePath} 2>"$err"; then`,
        `printf 'OK\\t%s\\tdeleted\\n' ${id};`,
        'else',
        `message=$(tr '\\n\\t' '  ' < "$err"); printf 'FAIL\\t%s\\t%s\\n' ${id} "$message";`,
        'fi;',
        'rm -f "$err";',
        'else',
        `printf 'OK\\t%s\\talready_absent\\n' ${id};`,
        'fi',
      ].join(' '),
    );
  }

  return lines.join('\n');
};

const buildArchiveBatchCommand = (
  candidates: CleanupCandidate[],
  archiveDirectory: string,
) => {
  const lines = [`mkdir -p ${shellQuote(archiveDirectory)}`, 'set +e'];

  for (const candidate of candidates) {
    const filePath = candidate.scanResult.path;
    const id = shellQuote(String(candidate.scanResult._id));
    const quotedPath = shellQuote(filePath);
    const dirName = shellQuote(path.posix.dirname(filePath));
    const baseName = shellQuote(path.posix.basename(filePath));
    const destination = buildArchiveDestination(candidate, archiveDirectory);
    const quotedDestination = shellQuote(destination);

    lines.push(
      [
        `if [ -e ${quotedPath} ]; then`,
        'err=$(mktemp);',
        `if tar -czf ${quotedDestination} -C ${dirName} ${baseName} 2>"$err" && test -s ${quotedDestination} 2>>"$err" && tar -tzf ${quotedDestination} >/dev/null 2>>"$err"; then`,
        `printf 'OK\\t%s\\t%s\\n' ${id} ${quotedDestination};`,
        'else',
        `message=$(tr '\\n\\t' '  ' < "$err"); printf 'FAIL\\t%s\\t%s\\n' ${id} "$message";`,
        'fi;',
        'rm -f "$err";',
        'else',
        `printf 'OK\\t%s\\talready_absent\\n' ${id};`,
        'fi',
      ].join(' '),
    );
  }

  return lines.join('\n');
};

const parseBatchCleanupOutput = (stdout: string): BatchCleanupOutcome[] =>
  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, id, message = ''] = line.split('\t');
      return {
        id,
        status: status === 'OK' ? 'success' : 'failed',
        message,
        destination: status === 'OK' && message !== 'deleted' && message !== 'already_absent'
          ? message
          : undefined,
        alreadyAbsent: message === 'already_absent',
      } as BatchCleanupOutcome;
    })
    .filter((outcome) => outcome.id);

const parseKeyValueOutput = (stdout: string) =>
  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex > 0) {
        acc[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1);
      }
      return acc;
    }, {});

const buildSafeDiskOptimizationCommand = () => `
set +e
before=$(df -Pm / | awk 'NR==2 {print $3}')
actions=0
if [ "$(id -u)" -eq 0 ]; then SUDO=""; elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then SUDO="sudo -n"; else SUDO=""; fi
if command -v journalctl >/dev/null 2>&1; then
  $SUDO journalctl --vacuum-time=7d >/dev/null 2>&1 && actions=$((actions + 1))
fi
if command -v apt-get >/dev/null 2>&1; then
  $SUDO apt-get clean >/dev/null 2>&1 && actions=$((actions + 1))
fi
if command -v npm >/dev/null 2>&1; then
  npm cache clean --force >/dev/null 2>&1 && actions=$((actions + 1))
fi
find /tmp -xdev -type f \\( -name '*.tmp' -o -name '*.temp' -o -name '*.log' -o -name '*.out' \\) -mtime +1 -delete >/dev/null 2>&1 && actions=$((actions + 1))
after=$(df -Pm / | awk 'NR==2 {print $3}')
recovered=$((before - after))
if [ "$recovered" -lt 0 ]; then recovered=0; fi
printf 'beforeMb=%s\\nafterMb=%s\\nrecoveredMb=%s\\nactions=%s\\n' "$before" "$after" "$recovered" "$actions"
`;

const executeSafeDiskOptimization = async (
  server: IServerConnection,
  summary: CleanupSummary,
) => {
  const result = await sshService.execute(
    server,
    buildSafeDiskOptimizationCommand(),
    cleanupCommandTimeoutMs,
  );
  const parsed = parseKeyValueOutput(result.stdout);
  const recoveredMb = Math.max(0, Number(parsed.recoveredMb || 0));
  const actions = Math.max(0, Number(parsed.actions || 0));

  summary.optimizationActions += actions;
  summary.optimizationRecoveredMb += recoveredMb;
  summary.spaceReclaimedMb += recoveredMb;
  summary.details.push({
    action: 'safe_disk_optimization',
    status: result.code === 0 ? 'success' : 'failed',
    recoveredMb,
    actions,
    beforeMb: Number(parsed.beforeMb || 0),
    afterMb: Number(parsed.afterMb || 0),
    reason:
      'No scan candidates were safe to delete or archive, so cache, journal, and stale temp optimization was attempted.',
  });

  if (actions === 0 || recoveredMb <= 0) {
    summary.noSafeFixApplied = true;
    summary.noSafeFixReason =
      'No eligible scan cleanup candidates were safe, and conservative cache/journal/temp optimization did not reclaim measurable disk space.';
  } else {
    summary.noSafeFixApplied = false;
  }

  if (result.stderr) {
    summary.errors.push({
      action: 'safe_disk_optimization',
      status: 'warning',
      reason: result.stderr,
    });
  }
};

const buildEmptyCleanupSummary = (scanId?: string): CleanupSummary => ({
  scanId,
  scannedFiles: 0,
  candidatesFound: 0,
  executableCount: 0,
  filesDeleted: 0,
  filesArchived: 0,
  filesIgnored: 0,
  failedActions: 0,
  skippedActions: 0,
  spaceReclaimedMb: 0,
  remainingIssues: 0,
  optimizationActions: 0,
  optimizationRecoveredMb: 0,
  noSafeFixApplied: false,
  details: [],
  errors: [],
});

const toPlainObject = (value: unknown) => {
  if (value && typeof value === 'object' && 'toObject' in value && typeof (value as any).toObject === 'function') {
    return (value as any).toObject();
  }
  return value as Record<string, unknown>;
};

const buildMetricSnapshot = (metric: Record<string, unknown> | undefined) => {
  if (!metric) {
    return undefined;
  }

  return {
    collectedAt: metric.collectedAt,
    cpuUsagePercent: metric.cpuUsagePercent,
    memoryUsagePercent: metric.memoryUsagePercent,
    diskUsagePercent: metric.diskUsagePercent,
    swapUsagePercent: metric.swapUsagePercent,
    loadAverage: metric.loadAverage,
    diskReadIo: metric.diskReadIo,
    diskWriteIo: metric.diskWriteIo,
    networkDownloadSpeed: metric.networkDownloadSpeed,
    networkUploadSpeed: metric.networkUploadSpeed,
  };
};

const buildPredictionSnapshot = (prediction: any) => {
  const issues = Array.isArray(prediction?.predictions) ? prediction.predictions : [];
  const highestConfidence = issues.reduce(
    (max: number, issue: any) => Math.max(max, Number(issue.confidence || 0)),
    0,
  );
  return {
    id: prediction?._id,
    created: prediction?.created,
    issueCount: issues.length,
    highestConfidence,
    criticalCount: issues.filter((issue: any) => issue.severity === 'critical').length,
    highCount: issues.filter((issue: any) => issue.severity === 'high').length,
    issues: issues.slice(0, 5).map((issue: any) => ({
      issue: issue.issue,
      predictedFailure: issue.predictedFailure,
      severity: issue.severity,
      confidence: issue.confidence,
    })),
  };
};

const buildVerification = (
  beforeMetrics: Record<string, unknown> | undefined,
  afterMetrics: Record<string, unknown> | undefined,
  beforePrediction: Record<string, unknown> | undefined,
  afterPrediction: Record<string, unknown> | undefined,
) => {
  const beforeDisk = Number(beforeMetrics?.diskUsagePercent ?? 0);
  const afterDisk = Number(afterMetrics?.diskUsagePercent ?? 0);
  const beforeConfidence = Number(beforePrediction?.highestConfidence ?? 0);
  const afterConfidence = Number(afterPrediction?.highestConfidence ?? 0);

  return {
    verifiedAt: new Date(),
    diskUsageDeltaPercent: Number((afterDisk - beforeDisk).toFixed(2)),
    predictionConfidenceDelta: Number((afterConfidence - beforeConfidence).toFixed(2)),
    improved:
      (beforeDisk > 0 && afterDisk < beforeDisk) ||
      (beforeConfidence > 0 && afterConfidence < beforeConfidence),
    issueStillPresent: Boolean(
      afterPrediction &&
      (Number(afterPrediction.highestConfidence || 0) >= 0.7 ||
        Number(afterPrediction.highCount || 0) > 0 ||
        Number(afterPrediction.criticalCount || 0) > 0),
    ),
  };
};

const persistBatchCleanupResults = async (
  candidates: CleanupCandidate[],
  outcomes: BatchCleanupOutcome[],
  summary: CleanupSummary,
) => {
  const now = new Date();
  const outcomeById = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const scanWrites = [];
  const maintenanceLogs = [];
  const deletedFiles = [];

  for (const candidate of candidates) {
    const scanResult = candidate.scanResult;
    const outcome = outcomeById.get(String(scanResult._id)) || {
      id: String(scanResult._id),
      status: 'failed' as const,
      message: 'No cleanup result was returned by the remote command.',
    };
    const succeeded = outcome.status === 'success';
    const detail = {
      fileId: scanResult._id,
      path: scanResult.path,
      action: candidate.action,
      status: succeeded ? 'success' : 'failed',
      sizeMb: scanResult.sizeMb,
      reason: succeeded ? candidate.reason : outcome.message,
      destination: outcome.destination,
      alreadyAbsent: outcome.alreadyAbsent,
      sourceRetained: candidate.action === 'archive' && succeeded ? true : undefined,
    };

    scanWrites.push({
      updateOne: {
        filter: { _id: scanResult._id },
        update: {
          $set: {
            reviewStatus: 'reviewed' as const,
            reviewedAt: now,
            actionStatus: succeeded ? 'completed' as const : 'failed' as const,
            actionTaken: candidate.action,
            actionReason: candidate.reason,
            actionError: succeeded ? undefined : outcome.message,
            updated: now,
          },
        },
      },
    });

    maintenanceLogs.push({
      server: scanResult.server,
      scanResult: scanResult._id,
      action: candidate.action,
      status: succeeded ? 'success' : 'failed',
      reason: succeeded ? candidate.reason : outcome.message || 'Cleanup action failed.',
      aiDecisionTrace: candidate.decisionTrace,
      metadata: {
        path: scanResult.path,
        sizeMb: scanResult.sizeMb,
        extension: scanResult.fileName.split('.').pop(),
        destination: outcome.destination,
        alreadyAbsent: outcome.alreadyAbsent,
        sourceRetained: candidate.action === 'archive' && succeeded ? true : undefined,
        batched: true,
      },
      created: now,
    });

    if (succeeded) {
      if (candidate.action === 'delete') {
        summary.filesDeleted += 1;
        if (!outcome.alreadyAbsent) {
          deletedFiles.push({
            server: scanResult.server,
            scanResult: scanResult._id,
            scanId: scanResult.scanId,
            fileName: scanResult.fileName,
            path: scanResult.path,
            size: scanResult.size,
            sizeMb: scanResult.sizeMb,
            category: scanResult.category,
            tags: scanResult.tags,
            lastAccessed: scanResult.lastAccessed,
            modifiedAt: scanResult.modifiedAt,
            reason: candidate.reason,
            aiDecisionTrace: candidate.decisionTrace,
            command: 'batched rm -f',
            triggeredBy: 'agent',
            deletedAt: now,
            created: now,
          });
        }
      } else if (candidate.action === 'archive') {
        summary.filesArchived += 1;
      } else if (candidate.action === 'ignore') {
        summary.filesIgnored += 1;
      }

      if (!outcome.alreadyAbsent && candidate.action !== 'archive') {
        summary.spaceReclaimedMb += scanResult.sizeMb;
      }
      summary.details.push(detail);
    } else {
      summary.failedActions += 1;
      summary.errors.push(detail);
    }
  }

  if (scanWrites.length) {
    await ScanResult.bulkWrite(scanWrites, { ordered: false });
  }
  if (maintenanceLogs.length) {
    await MaintenanceLog.insertMany(maintenanceLogs, { ordered: false });
  }
  if (deletedFiles.length) {
    await DeletedFile.insertMany(deletedFiles, { ordered: false });
  }
};

const executeCandidateBatch = async (
  server: IServerConnection,
  candidates: CleanupCandidate[],
  archiveDirectory: string,
) => {
  const action = candidates[0]?.action;
  if (!action) {
    return [];
  }

  if (action === 'delete') {
    const result = await sshService.execute(
      server,
      buildDeleteBatchCommand(candidates),
      cleanupCommandTimeoutMs,
    );
    return parseBatchCleanupOutput(result.stdout);
  }

  if (action === 'archive') {
    const result = await sshService.execute(
      server,
      buildArchiveBatchCommand(candidates, archiveDirectory),
      cleanupCommandTimeoutMs,
    );
    return parseBatchCleanupOutput(result.stdout);
  }

  return candidates.map((candidate) => ({
    id: String(candidate.scanResult._id),
    status: 'success' as const,
    message: 'ignored',
  }));
};

const executeApprovedCleanup = async (
  server: IServerConnection,
  scanId: string | undefined,
  runtimeContext?: RemediationExecutionContext,
): Promise<CleanupSummary> => {
  const effectiveScanId = scanId || await getLatestScanId(String(server._id));
  const { scannedFiles, candidates, skipped } = await buildCleanupCandidates(
    String(server._id),
    effectiveScanId,
  );

  const summary: CleanupSummary = {
    scanId: effectiveScanId,
    scannedFiles,
    candidatesFound: candidates.length + skipped.length,
    executableCount: candidates.length,
    filesDeleted: 0,
    filesArchived: 0,
    filesIgnored: 0,
    failedActions: 0,
    skippedActions: skipped.length,
    spaceReclaimedMb: 0,
    remainingIssues: 0,
    optimizationActions: 0,
    optimizationRecoveredMb: 0,
    noSafeFixApplied: false,
    details: [],
    errors: [],
  };

  await runtimeContext?.onProgress?.({
    phase: 'discovering',
    totalActions: candidates.length,
    processedActions: 0,
    summary,
  });

  const groupedCandidates = [
    ...splitIntoBatches(candidates.filter((candidate) => candidate.action === 'delete'), deleteBatchSize),
    ...splitIntoBatches(candidates.filter((candidate) => candidate.action === 'archive'), archiveBatchSize),
    ...splitIntoBatches(
      candidates.filter((candidate) => candidate.action !== 'delete' && candidate.action !== 'archive'),
      Math.max(cleanupConcurrency, 25),
    ),
  ].filter((batch) => batch.length);

  let processedActions = 0;
  const config = await configService.get(String(server._id));

  if (!groupedCandidates.length) {
    await executeSafeDiskOptimization(server, summary);
  }

  for (const batch of groupedCandidates) {
    try {
      const outcomes = await executeCandidateBatch(server, batch, config.archiveDirectory);
      await persistBatchCleanupResults(batch, outcomes, summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cleanup batch failed unexpectedly.';
      const outcomes = batch.map((candidate) => ({
        id: String(candidate.scanResult._id),
        status: 'failed' as const,
        message,
      }));
      await persistBatchCleanupResults(batch, outcomes, summary);
    }

    processedActions += batch.length;
    summary.spaceReclaimedMb = Number(summary.spaceReclaimedMb.toFixed(2));
    summary.details = summary.details.slice(-500);
    summary.errors = summary.errors.slice(-200);

    await runtimeContext?.onProgress?.({
      phase: 'cleaning',
      totalActions: candidates.length,
      processedActions,
      summary,
    });
  }

  summary.remainingIssues = await ScanResult.countDocuments({
    server: server._id,
    ...(effectiveScanId ? { scanId: effectiveScanId } : {}),
    actionStatus: 'none',
    $or: [
      { category: { $in: remediationCleanupCategories } },
      { tags: { $in: remediationCleanupCategories } },
    ],
  });

  summary.spaceReclaimedMb = Number(summary.spaceReclaimedMb.toFixed(2));
  summary.optimizationRecoveredMb = Number(summary.optimizationRecoveredMb.toFixed(2));
  if (summary.executableCount === 0 && summary.optimizationRecoveredMb <= 0) {
    summary.noSafeFixApplied = true;
    summary.noSafeFixReason = summary.noSafeFixReason || 'No scan result matched a safe automated cleanup action.';
  }
  summary.details = summary.details.slice(0, 500);
  summary.errors = summary.errors.slice(0, 200);
  await runtimeContext?.onProgress?.({
    phase: 'finished',
    totalActions: candidates.length,
    processedActions: candidates.length,
    summary,
  });
  return summary;
};

const buildCommandForTool = async (
  call: RemediationToolCall,
  serverId: string,
): Promise<string | undefined> => {
  switch (call.toolName) {
    case 'restart_service': {
      const serviceName = ensureString(call.args.serviceName, 'serviceName');
      if (serviceName.startsWith('docker:')) {
        return `sudo docker restart ${shellQuote(serviceName.replace('docker:', ''))}`;
      } else if (serviceName.startsWith('pm2:')) {
        return `pm2 restart ${shellQuote(serviceName.replace('pm2:', ''))}`;
      } else if (serviceName.startsWith('systemd:')) {
        return `sudo systemctl restart ${shellQuote(serviceName.replace('systemd:', ''))}`;
      }
      return `sudo systemctl restart ${shellQuote(serviceName)}`;
    }
    case 'kill_process':
      return `kill -9 ${shellQuote(ensureString(String(call.args.pid), 'pid'))}`;
    case 'clear_cache':
      return 'sync; echo 3 | sudo tee /proc/sys/vm/drop_caches';
    case 'delete_file':
      return `rm -f -- ${shellQuote(ensureString(call.args.path, 'path'))}`;
    case 'archive_file': {
      const config = await configService.get(serverId);
      return buildArchiveCommand(ensureString(call.args.path, 'path'), config.archiveDirectory);
    }
    case 'custom_command':
      return ensureString(call.args.command, 'command');
    case 'safe_system_optimization':
      return buildSafeDiskOptimizationCommand();
    default:
      return undefined;
  }
};

const buildStepName = (toolCall: RemediationToolCall) => {
  switch (toolCall.toolName) {
    case 'collect_metrics':
      return 'Collect live system metrics';
    case 'run_health_check':
      return 'Run pre/post remediation health check';
    case 'start_scan':
      return 'Start filesystem remediation scan';
    case 'analyze_scan_results':
      return 'Analyze scan results and generate cleanup recommendations';
    case 'apply_scan_cleanup':
      return 'Apply safe cleanup actions from analyzed scan results';
    case 'safe_system_optimization':
      return 'Run safe system optimization';
    case 'restart_service':
      return `Restart service ${ensureString(toolCall.args.serviceName, 'serviceName')}`;
    case 'kill_process':
      return `Kill process PID ${ensureString(String(toolCall.args.pid), 'pid')}`;
    case 'clear_cache':
      return 'Clear system memory cache';
    case 'delete_file':
      return `Delete file ${ensureString(toolCall.args.path, 'path')}`;
    case 'archive_file':
      return `Archive file ${ensureString(toolCall.args.path, 'path')}`;
    case 'custom_command':
      return 'Execute custom command';
    default:
      return toolCall.toolName;
  }
};

export const remediationToolsService = {
  listTools() {
    return Object.values(toolDefinitions);
  },

  getToolDefinition(toolName: RemediationToolName) {
    const tool = toolDefinitions[toolName];
    if (!tool) {
      throw new Error(`Unsupported remediation tool: ${toolName}`);
    }

    return tool;
  },

  async compileStep(
    toolCall: RemediationToolCall,
    serverId: string,
    fallbackName?: string,
  ): Promise<IRemediationStep> {
    const tool = this.getToolDefinition(toolCall.toolName);
    const command = await buildCommandForTool(toolCall, serverId);

    return {
      name:
        fallbackName ||
        toolCall.reasoning ||
        buildStepName(toolCall),
      command,
      toolName: toolCall.toolName,
      toolArgs: toolCall.args,
      status: 'pending',
    };
  },

  async executeToolCall(
    server: IServerConnection,
    toolCall: RemediationToolCall,
    runtimeContext?: RemediationExecutionContext,
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    switch (toolCall.toolName) {
      case 'collect_metrics': {
        const metric = await monitoringService.collectMetrics(String(server._id), 'manual');
        if (runtimeContext) {
          const snapshot = buildMetricSnapshot(toPlainObject(metric));
          if (!runtimeContext.beforeMetrics) {
            runtimeContext.beforeMetrics = snapshot;
          }
          runtimeContext.afterMetrics = snapshot;
        }
        return {
          stdout: JSON.stringify(metric.toObject ? metric.toObject() : metric),
          stderr: '',
          code: 0,
        };
      }
      case 'run_health_check': {
        const result = await sshService.execute(server, 'uptime && free -m && df -h /');
        return result;
      }
      case 'start_scan': {
        const directories = ensureDirectories(toolCall.args.directories);
        const includeFullServer =
          ensureOptionalBoolean(toolCall.args.includeFullServer, 'includeFullServer') ?? false;
        const result = await scanService.startScan(
          String(server._id),
          directories,
          'manual',
          {
            includeFullServer,
            commandTimeoutMs: remediationScanTimeoutMs,
          },
        );
        const summary = summarizeScanResult(result);
        if (runtimeContext) {
          runtimeContext.latestScanId = result.scanId;
          runtimeContext.latestScanSummary = summary;
        }
        return {
          stdout: JSON.stringify(summary),
          stderr: '',
          code: 0,
        };
      }
      case 'analyze_scan_results': {
        const scanId = resolveWorkflowScanId(toolCall, runtimeContext, toolCall.toolName);

        if (scanId) {
          await agentService.analyzeScanResults(String(server._id), scanId);
        }

        const result = await agentService.run(String(server._id), scanId, false, true);
        return {
          stdout: JSON.stringify(result),
          stderr: '',
          code: 0,
        };
      }
      case 'apply_scan_cleanup': {
        const scanId = resolveWorkflowScanId(toolCall, runtimeContext, toolCall.toolName);

        const summary = await executeApprovedCleanup(server, scanId, runtimeContext);
        summary.beforeMetrics = runtimeContext?.beforeMetrics;
        if (runtimeContext) {
          runtimeContext.latestCleanupSummary = summary;
        }

        let postCleanupMetric: unknown;
        try {
          const metric = await monitoringService.collectMetrics(String(server._id), 'manual');
          postCleanupMetric = toPlainObject(metric);
          const snapshot = buildMetricSnapshot(postCleanupMetric as Record<string, unknown>);
          summary.afterMetrics = snapshot;
          if (runtimeContext) {
            runtimeContext.afterMetrics = snapshot;
          }
        } catch (error) {
          summary.errors.push({
            action: 'collect_metrics',
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Post-cleanup metrics collection failed.',
          });
        }

        try {
          const prediction = await agentService.predictMaintenance(String(server._id));
          summary.afterPrediction = buildPredictionSnapshot(prediction);
          if (runtimeContext) {
            runtimeContext.afterPrediction = summary.afterPrediction;
          }
        } catch (error) {
          summary.errors.push({
            action: 'predict_maintenance',
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Post-remediation prediction failed.',
          });
        }

        summary.beforePrediction = runtimeContext?.beforePrediction;
        summary.verification = buildVerification(
          summary.beforeMetrics,
          summary.afterMetrics,
          summary.beforePrediction,
          summary.afterPrediction,
        );
        if (runtimeContext) {
          runtimeContext.verification = summary.verification;
        }

        return {
          stdout: JSON.stringify({
            ...summary,
            postCleanupMetric,
          }),
          stderr: summary.failedActions ? `${summary.failedActions} cleanup actions failed.` : '',
          code:
            summary.executableCount === 0
              ? 0
              : summary.failedActions > 0 && (summary.filesDeleted + summary.filesArchived + summary.filesIgnored) === 0
                ? 1
                : 0,
        };
      }
      case 'safe_system_optimization': {
        const summary = buildEmptyCleanupSummary(runtimeContext?.latestScanId);
        summary.beforeMetrics = runtimeContext?.beforeMetrics;
        await executeSafeDiskOptimization(server, summary);
        try {
          const metric = await monitoringService.collectMetrics(String(server._id), 'manual');
          const snapshot = buildMetricSnapshot(toPlainObject(metric));
          summary.afterMetrics = snapshot;
          if (runtimeContext) {
            runtimeContext.afterMetrics = snapshot;
          }
        } catch (error) {
          summary.errors.push({
            action: 'collect_metrics',
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Post-optimization metrics collection failed.',
          });
        }
        try {
          const prediction = await agentService.predictMaintenance(String(server._id));
          summary.afterPrediction = buildPredictionSnapshot(prediction);
          if (runtimeContext) {
            runtimeContext.afterPrediction = summary.afterPrediction;
          }
        } catch (error) {
          summary.errors.push({
            action: 'predict_maintenance',
            status: 'failed',
            reason: error instanceof Error ? error.message : 'Post-optimization prediction failed.',
          });
        }
        summary.beforePrediction = runtimeContext?.beforePrediction;
        summary.verification = buildVerification(
          summary.beforeMetrics,
          summary.afterMetrics,
          summary.beforePrediction,
          summary.afterPrediction,
        );
        if (runtimeContext) {
          runtimeContext.latestCleanupSummary = summary;
          runtimeContext.verification = summary.verification;
        }
        return {
          stdout: JSON.stringify(summary),
          stderr: summary.noSafeFixApplied ? summary.noSafeFixReason || '' : '',
          code: 0,
        };
      }
      default: {
        const command = await buildCommandForTool(toolCall, String(server._id));
        if (!command) {
          throw new Error(`Tool ${toolCall.toolName} did not compile into an executable action.`);
        }

        return sshService.execute(server, command, 60000);
      }
    }
  },

  async executeStep(
    server: IServerConnection,
    step: IRemediationStep,
    runtimeContext?: RemediationExecutionContext,
  ): Promise<SshCommandResult> {
    if (step.toolName) {
      return this.executeToolCall(server, {
        toolName: step.toolName,
        args: step.toolArgs || {},
      }, runtimeContext);
    }

    if (!step.command) {
      return { stdout: '', stderr: '', code: 0 };
    }

    return sshService.execute(server, step.command, 60000);
  },
};
