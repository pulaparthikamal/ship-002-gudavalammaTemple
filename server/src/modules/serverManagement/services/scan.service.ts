import path from 'path';
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { AppError } from '../../../utils/error.util';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { CleanupExecution, CleanupSeverity } from '../models/cleanupExecution.model';
import { FileCategory, IScanResult, ScanResult } from '../models/scanResult.model';
import { ServerConnection } from '../models/serverConnection.model';
import { LogProcessed } from '../models/logAnalysis.model';
import { configService } from './config.service';
import { sshService } from './ssh.service';
import { alertService } from './alert.service';
import { agentService } from './agent.service';
import { executionService } from './execution.service';
import { socketService } from './socket.service';
import { logger } from '../../../utils/logger.util';
import {
  parseNumber,
  shellQuote,
  toDateFromUnixSeconds,
  wildcardToRegExp,
} from '../utils/shell.util';

const categoryOrder: FileCategory[] = [
  'duplicate',
  'crash',
  'large',
  'logs',
  'temp',
  'unused',
  'service',
  'config',
  'application',
  'system',
  'other',
];
const fullServerRoot = '/';
const fieldSeparator = '\x1f';
const maxScanResults = Math.max(
  1000,
  Math.min(Number(process.env.SERVER_SCAN_MAX_RESULTS) || 10000, 100000),
);
const maxDuplicateHashCandidates = Math.max(
  100,
  Math.min(Number(process.env.SERVER_SCAN_HASH_MAX_FILES) || 750, 5000),
);
const duplicateHashChunkSize = Math.max(
  10,
  Math.min(Number(process.env.SERVER_SCAN_HASH_CHUNK_SIZE) || 25, 100),
);
const scanCommandTimeoutMs = Math.max(
  60000,
  Number(process.env.SERVER_SCAN_COMMAND_TIMEOUT_MS) || 180000,
);

interface StartScanOptions {
  includeFullServer?: boolean;
  commandTimeoutMs?: number;
  suppressAutomaticCleanup?: boolean;
}

export type CleanupRecommendationAction = 'archive' | 'delete' | 'keep' | 'protected';

export interface CleanupRecommendation {
  fileId: string;
  scanId: string;
  path: string;
  fileName: string;
  directory: string;
  size: number;
  sizeMb: number;
  lastAccessed: Date;
  modifiedAt?: Date;
  category: FileCategory;
  tags: FileCategory[];
  action: CleanupRecommendationAction;
  reason: string;
  confidence: number;
  decisionTrace: string[];
  severity: CleanupSeverity;
}

export interface CleanupRecommendationSummary {
  scanId: string;
  scannedFiles: number;
  archive: number;
  delete: number;
  keep: number;
  protected: number;
  severityCounts: Record<CleanupSeverity, number>;
  totalScannedSizeBytes: number;
  expectedReclaimableSizeBytes: number;
  scanDurationMs: number;
  auditLogId?: string;
}

const cleanupBackupDirectory = '/tmp/ai-cleanup-backups';
const elevatedBackupSeverities: CleanupSeverity[] = ['ERROR', 'CRITICAL', 'SECURITY'];

const isRemoteHomeDirectoryAlias = (directory: string) => {
  const normalized = directory.trim().replace(/\/+$/, '');
  return normalized === '$HOME' || normalized === '${HOME}' || normalized === '~';
};

const normalizeDirectory = (directory: string) => {
  const trimmed = directory.trim();
  if (!trimmed || isRemoteHomeDirectoryAlias(trimmed)) {
    return '';
  }

  if (trimmed === fullServerRoot) {
    return fullServerRoot;
  }

  return trimmed.replace(/\/+$/, '');
};

const uniqueDirectories = (directories: string[]) => {
  const seen = new Set<string>();
  return directories.reduce<string[]>((acc, directory) => {
    const normalized = normalizeDirectory(directory);
    if (!normalized || seen.has(normalized)) {
      return acc;
    }

    seen.add(normalized);
    acc.push(normalized);
    return acc;
  }, []);
};

const resolveScanDirectories = (
  directories: string[] | undefined,
  configDirectories: string[] = [],
  includeFullServer = true,
) => {
  const requestedDirectories = directories?.length ? directories : configDirectories;
  const prioritizedDirectories = uniqueDirectories(requestedDirectories);
  const commandDirectories = !includeFullServer || prioritizedDirectories.includes(fullServerRoot)
    ? prioritizedDirectories
    : [...prioritizedDirectories, fullServerRoot];

  return {
    commandDirectories: commandDirectories.length ? commandDirectories : [fullServerRoot],
    loggedDirectories: commandDirectories.length ? commandDirectories : [fullServerRoot],
  };
};

const buildFindCommand = (directories: string[], config: any) => {
  const dirList = directories.length ? directories.map(shellQuote).join(' ') : shellQuote(fullServerRoot);
  const ignoredFolders = Array.from(
    new Set(['/proc', '/sys', '/dev', '/run', ...(config.ignoreFolders || [])]),
  )
    .map(normalizeDirectory)
    .filter(Boolean)
    .filter((directory) => directory !== fullServerRoot);
  const prunePredicates = ignoredFolders
    .flatMap((folder) => [`-path ${shellQuote(folder)}`, `-path ${shellQuote(`${folder}/*`)}`])
    .join(' -o ');
  const pruneExpression = prunePredicates ? `\\( ${prunePredicates} \\) -prune -o` : '';

  return `
for scan_root in ${dirList}; do
  [ -d "$scan_root" ] || continue
  # Use sudo -n (non-interactive) to try and access directories if possible, 
  # or fallback to direct find if sudo is not available/configured.
  find "$scan_root" ${pruneExpression} -type f -printf "$scan_root\\037%p\\037%s\\037%A@\\037%T@\\037%m\\037%u\\037%g\\n" 2>/dev/null | head -n ${maxScanResults}
done | awk -F '\\037' '!seen[$2]++' | head -n ${maxScanResults}
`;
};

const isIgnored = (filePath: string, ignoreFolders: string[]) =>
  ignoreFolders.some((folder) => {
    const normalized = normalizeDirectory(folder);
    return normalized && (filePath === normalized || filePath.startsWith(`${normalized}/`));
  });

const pathIncludesSegment = (filePath: string, segment: string) =>
  filePath === `/${segment}` || filePath.includes(`/${segment}/`);

const hasExtension = (fileName: string, extensions: string[]) =>
  extensions.some((extension) => fileName.toLowerCase().endsWith(extension));

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Recognized source-code file extensions across the common stacks this agent
// deploys and maintains. Files matching these are first-class project source
// files — models, controllers, services, utilities, middleware, routes, etc. —
// and must never be treated as unused/miscellaneous clutter or become cleanup
// candidates, regardless of access time or where the project is deployed.
const sourceCodeExtensions = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.php', '.go', '.rs', '.java', '.kt', '.kts', '.scala',
  '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.swift', '.m', '.mm',
  '.vue', '.svelte', '.dart', '.ex', '.exs', '.pl', '.pm',
];

const isSourceCodeFile = (fileName: string) => hasExtension(fileName, sourceCodeExtensions);

export const classifyFile = (
  filePath: string,
  sizeMb: number,
  lastAccessed: Date,
  config: any,
): { category: FileCategory; tags: FileCategory[] } => {
  const fileName = path.posix.basename(filePath);
  const normalizedPath = filePath.toLowerCase();
  const normalizedFileName = fileName.toLowerCase();
  const accessAgeDays = Math.floor((Date.now() - lastAccessed.getTime()) / 86400000);
  const tags = new Set<FileCategory>();
  const isSourceCode = isSourceCodeFile(normalizedFileName);

  // Access time is not a signal of disuse for source code: modules are typically
  // read once at process start, and production mounts are commonly noatime/
  // relatime, so a stable source file keeps an old access time forever. Never
  // mark recognized source files as "unused" — doing so makes them auto-delete
  // candidates for the cleanup agent.
  if (!isSourceCode && accessAgeDays >= config.unusedFileDays) {
    tags.add('unused');
  }

  if (sizeMb >= config.largeFileMb) {
    tags.add('large');
  }

  if (
    pathIncludesSegment(normalizedPath, 'log') ||
    pathIncludesSegment(normalizedPath, 'logs') ||
    config.logPatterns.some((pattern: string) => wildcardToRegExp(pattern).test(fileName))
  ) {
    tags.add('logs');
  }

  if (
    pathIncludesSegment(normalizedPath, 'tmp') ||
    pathIncludesSegment(normalizedPath, 'temp') ||
    pathIncludesSegment(normalizedPath, 'cache') ||
    config.tempPatterns.some((pattern: string) => wildcardToRegExp(pattern).test(fileName))
  ) {
    tags.add('temp');
  }

  if (
    normalizedPath.startsWith('/var/crash/') ||
    normalizedPath.includes('/coredump/') ||
    normalizedFileName.startsWith('core.') ||
    normalizedFileName.startsWith('hs_err_pid') ||
    hasExtension(normalizedFileName, ['.dmp', '.dump', '.crash'])
  ) {
    tags.add('crash');
  }

  if (
    normalizedPath.includes('/systemd/') ||
    normalizedPath.startsWith('/etc/init.d/') ||
    hasExtension(normalizedFileName, ['.service', '.timer', '.socket'])
  ) {
    tags.add('service');
  }

  if (
    normalizedPath.startsWith('/etc/') ||
    normalizedFileName === '.env' ||
    hasExtension(normalizedFileName, [
      '.conf',
      '.cfg',
      '.ini',
      '.yaml',
      '.yml',
      '.toml',
      '.properties',
      '.json',
    ])
  ) {
    tags.add('config');
  }

  if (
    normalizedPath.startsWith('/opt/') ||
    normalizedPath.startsWith('/srv/') ||
    normalizedPath.startsWith('/var/www/') ||
    normalizedPath.startsWith('/app/') ||
    normalizedPath.startsWith('/usr/local/') ||
    normalizedPath.includes('/releases/') ||
    normalizedPath.includes('/deploy/')
  ) {
    tags.add('application');
  }

  if (
    normalizedPath.startsWith('/boot/') ||
    normalizedPath.startsWith('/bin/') ||
    normalizedPath.startsWith('/sbin/') ||
    normalizedPath.startsWith('/usr/bin/') ||
    normalizedPath.startsWith('/usr/sbin/') ||
    normalizedPath.startsWith('/lib/') ||
    normalizedPath.startsWith('/lib64/') ||
    normalizedPath.startsWith('/usr/lib/')
  ) {
    tags.add('system');
  }

  // Recognized source code is protected application code. `application` is a
  // protected cleanup category (see cleanupProtectedCategories /
  // protectedDeleteCategories / protectedOperationalCategories), so tagging
  // source files here makes them "protected" in the cleanup recommendation,
  // "review" in the agent decision, and blocked in assertSafeToDelete — i.e.
  // they can never be classified as miscellaneous or deleted, without relying
  // on any hardcoded filename. This is intentionally path-independent so it
  // protects projects deployed anywhere, not only under /opt, /srv, /app, etc.
  if (isSourceCode) {
    tags.add('application');
  }

  const orderedTags = categoryOrder.filter((category) => tags.has(category));
  return {
    category: orderedTags[0] || 'other',
    tags: orderedTags.length ? orderedTags : ['other'],
  };
};

const parseFindOutput = (stdout: string, config: any) =>
  stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [scanRootRaw, filePath, sizeRaw, accessedRaw, modifiedRaw] = line.split(fieldSeparator);
      const size = parseNumber(sizeRaw);
      const sizeMb = Number((size / 1024 / 1024).toFixed(2));
      const lastAccessed = toDateFromUnixSeconds(accessedRaw);
      const modifiedAt = toDateFromUnixSeconds(modifiedRaw);
      const classification = classifyFile(filePath, sizeMb, lastAccessed, config);

      return {
        fileName: path.posix.basename(filePath),
        path: filePath,
        directory: path.posix.dirname(filePath),
        scanRoot: normalizeDirectory(scanRootRaw || fullServerRoot) || fullServerRoot,
        size,
        sizeMb,
        lastAccessed,
        modifiedAt,
        ...classification,
      };
    })
    .filter((file) => !isIgnored(file.path, config.ignoreFolders));

const uniqueFilesByPath = <T extends { path: string }>(files: T[]) => {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (seen.has(file.path)) {
      return false;
    }

    seen.add(file.path);
    return true;
  });
};

const cleanupProtectedCategories: FileCategory[] = ['system', 'config', 'application', 'service'];

const hasCleanupTag = (file: { category: FileCategory; tags: FileCategory[] }, categories: FileCategory[]) =>
  categories.some((category) => file.category === category || file.tags.includes(category));

const fileAgeInDays = (date: Date) =>
  Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));

type CleanupRecommendationSource = Pick<
  IScanResult,
  | 'scanId'
  | 'path'
  | 'fileName'
  | 'directory'
  | 'size'
  | 'sizeMb'
  | 'lastAccessed'
  | 'modifiedAt'
  | 'category'
  | 'tags'
> & {
  _id: unknown;
};

const buildCleanupRecommendation = (
  result: CleanupRecommendationSource,
  config: Awaited<ReturnType<typeof configService.get>>,
  severity: CleanupSeverity,
): CleanupRecommendation => {
  const ageDays = fileAgeInDays(result.lastAccessed);
  const baseTrace = [
    'Filesystem scan result evaluated without executing cleanup.',
    `Category=${result.category}; tags=${result.tags.join(', ') || 'none'}; age=${ageDays} days; size=${result.sizeMb} MB.`,
    `Config thresholds: archive older than ${config.archiveOlderThanDays} days, delete older than ${config.deleteOlderThanDays} days, archive large files at ${config.archiveLargeFileMb} MB.`,
  ];
  let action: CleanupRecommendationAction = 'keep';
  let reason = 'No retention or cleanup threshold matched this file.';
  let confidence = 0.65;
  let decisionTrace = [...baseTrace, 'Recommendation is keep.'];

  if (hasCleanupTag(result, cleanupProtectedCategories)) {
    action = 'protected';
    reason = 'Protected operational file requires manual review and is excluded from cleanup recommendations.';
    confidence = 0.95;
    decisionTrace = [...baseTrace, 'Protected category matched before cleanup thresholds.'];
  } else if (hasCleanupTag(result, ['temp']) && ageDays >= config.unusedFileDays) {
    action = 'delete';
    reason = 'Temporary file is older than the configured unused-file retention threshold.';
    confidence = 0.86;
    decisionTrace = [...baseTrace, `Temp file age ${ageDays} days is >= unusedFileDays ${config.unusedFileDays}.`];
  } else if (hasCleanupTag(result, ['logs', 'unused']) && ageDays >= config.deleteOlderThanDays) {
    action = 'delete';
    reason = 'Log or unused file is older than the configured delete threshold.';
    confidence = 0.84;
    decisionTrace = [...baseTrace, `File age ${ageDays} days is >= deleteOlderThanDays ${config.deleteOlderThanDays}.`];
  } else if (hasCleanupTag(result, ['logs', 'unused']) && ageDays >= config.archiveOlderThanDays) {
    action = 'archive';
    reason = 'Log or unused file is older than the configured archive threshold.';
    confidence = 0.8;
    decisionTrace = [...baseTrace, `File age ${ageDays} days is >= archiveOlderThanDays ${config.archiveOlderThanDays}.`];
  } else if (hasCleanupTag(result, ['large']) && result.sizeMb >= config.archiveLargeFileMb) {
    action = 'archive';
    reason = 'Large file exceeds the configured archive size threshold.';
    confidence = 0.78;
    decisionTrace = [...baseTrace, `File size ${result.sizeMb} MB is >= archiveLargeFileMb ${config.archiveLargeFileMb}.`];
  }

  return {
    fileId: String(result._id),
    scanId: result.scanId,
    path: result.path,
    fileName: result.fileName,
    directory: result.directory,
    size: result.size,
    sizeMb: result.sizeMb,
    lastAccessed: result.lastAccessed,
    modifiedAt: result.modifiedAt,
    category: result.category,
    tags: result.tags,
    action,
    reason,
    confidence,
    decisionTrace,
    severity,
  };
};

const defaultSeverityCounts = (): Record<CleanupSeverity, number> => ({
  INFO: 0,
  WARN: 0,
  ERROR: 0,
  CRITICAL: 0,
  SECURITY: 0,
});

const determineFileSeverities = async (files: CleanupRecommendationSource[]) => {
  const paths = Array.from(new Set(files.map((item) => item.path)));
  const records = await LogProcessed.aggregate<{ _id: { filePath: string; severity: CleanupSeverity }; count: number }>([
    { $match: { filePath: { $in: paths }, severity: { $in: ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'SECURITY'] } } },
    { $group: { _id: { filePath: '$filePath', severity: '$severity' }, count: { $sum: 1 } } },
  ]);
  const score: Record<CleanupSeverity, number> = { INFO: 1, WARN: 2, ERROR: 3, CRITICAL: 4, SECURITY: 5 };
  const severityByPath = new Map<string, CleanupSeverity>();
  for (const record of records) {
    const filePath = record._id.filePath;
    const current = severityByPath.get(filePath) || 'INFO';
    if (score[record._id.severity] >= score[current]) {
      severityByPath.set(filePath, record._id.severity);
    }
  }
  return severityByPath;
};

export const scanService = {
  async startScan(
    serverId: string,
    directories?: string[],
    triggeredBy: 'manual' | 'threshold' | 'scheduled' = 'manual',
    options: StartScanOptions = {},
  ) {
    const server = await ServerConnection.findById(serverId);
    if (!server || !server.active) {
      throw new AppError('Server not found.', HTTP_STATUS.NOT_FOUND);
    }

    const config = await configService.get(serverId);
    const { commandDirectories, loggedDirectories } = resolveScanDirectories(
      directories,
      config.scanDirectories,
      options.includeFullServer ?? true,
    );
    const scanId = randomUUID();
    const result = await sshService.execute(
      server,
      buildFindCommand(commandDirectories, config),
      options.commandTimeoutMs || scanCommandTimeoutMs,
    );

    if (result.code !== 0 && !result.stdout.trim()) {
      throw new AppError(result.stderr || 'Remote scan failed.', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }

    const files = parseFindOutput(result.stdout, config);

    // Process files in small chunks to avoid blocking the event loop
    const processedFiles = [];
    const chunkSize = 1000;
    for (let i = 0; i < files.length; i += chunkSize) {
      processedFiles.push(...uniqueFilesByPath(files.slice(i, i + chunkSize)));
      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));
    }

    // Content-based duplicate detection
    const sizeGroups = new Map<number, typeof files>();
    for (const file of processedFiles) {
      const group = sizeGroups.get(file.size) || [];
      group.push(file);
      sizeGroups.set(file.size, group);
    }

    const potentialDuplicateFiles = Array.from(sizeGroups.values())
      .filter((group) => group.length > 1)
      .flat()
      .slice(0, maxDuplicateHashCandidates);
    const hashes = new Map<string, string>();

    if (potentialDuplicateFiles.length > 0) {
      const hashChunks = [];
      for (let i = 0; i < potentialDuplicateFiles.length; i += duplicateHashChunkSize) {
        hashChunks.push(potentialDuplicateFiles.slice(i, i + duplicateHashChunkSize));
      }

      for (const chunk of hashChunks) {
        const hashCommand = chunk
          .map((f) => `md5sum ${shellQuote(f.path)} 2>/dev/null`)
          .join('; ');
        try {
          const hashResult = await sshService.execute(server, hashCommand, 60000);

          hashResult.stdout
            .split('\n')
            .filter(Boolean)
            .forEach((line) => {
              const [hash, ...pathParts] = line.trim().split(/\s+/);
              const filePath = pathParts.join(' ');
              if (hash && filePath) {
                hashes.set(filePath, hash);
              }
            });
        } catch (error) {
          logger.warn(
            `Duplicate hash enrichment skipped for ${chunk.length} scan candidates on ${server.host}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        await new Promise(resolve => setImmediate(resolve));
      }
    }

    const seenHashes = new Set<string>();
    for (const file of processedFiles) {
      const contentHash = hashes.get(file.path);
      if (contentHash) {
        if (seenHashes.has(contentHash)) {
          file.category = 'duplicate';
          file.tags = Array.from(new Set<FileCategory>(['duplicate', ...file.tags]));
        }
        seenHashes.add(contentHash);
      }
    }

    const recommendationFacts = processedFiles.map((file) => ({
      fileName: file.fileName,
      path: file.path,
      sizeMb: file.sizeMb,
      lastAccessed: file.lastAccessed,
      category: file.category,
      tags: file.tags,
    }));
    const recommendations = await agentService.recommendMany(serverId, recommendationFacts, config);
    let created = [];

    // Insert in batches of 500
    const dbBatchSize = 500;
    for (let i = 0; i < processedFiles.length; i += dbBatchSize) {
      const batch = processedFiles.slice(i, i + dbBatchSize).map((file, index) => {
        const globalIndex = i + index;
        const contentHash = hashes.get(file.path);
        return {
          server: new Types.ObjectId(serverId),
          scanId,
          ...file,
          contentHash,
          aiRecommendation: recommendations[globalIndex],
          reviewStatus: 'pending_review',
          actionStatus: 'none',
          analysisStatus: 'pending',
          discoveredAt: new Date(),
          created: new Date(),
          updated: new Date(),
        };
      });

      const saved = await ScanResult.insertMany(batch);
      created.push(...saved);
      await new Promise(resolve => setImmediate(resolve));
    }
    server.lastScanAt = new Date();
    server.updated = new Date();
    await server.save();

    const analysis = created.length
      ? await agentService.analyzeScanResults(serverId, scanId)
      : undefined;

    await MaintenanceLog.create({
      server: new Types.ObjectId(serverId),
      action: 'scan',
      status: 'success',
      reason: `Scan completed from ${triggeredBy} trigger.`,
      aiDecisionTrace: [
        'Scanner walked configured directories first, then the full server root.',
        'Classification agent grouped files across maintenance, system, config, application, and other categories.',
        'AI analysis generated root cause, severity, impact, and remediation metadata after persistence.',
      ],
      metadata: {
        scanId,
        fileCount: created.length,
        directories: loggedDirectories,
        maxScanResults,
        duplicateHashCandidates: potentialDuplicateFiles.length,
        duplicateHashesCollected: hashes.size,
        analysis,
      },
      created: new Date(),
    });

    await alertService.create({
      serverId,
      type: 'scan_completed',
      severity: created.length ? 'warning' : 'info',
      title: 'File scan completed',
      message: `${created.length} candidate files are ready for dashboard review.`,
      metadata: {
        scanId,
        fileCount: created.length,
        analyzedCount: analysis?.analyzedCount || 0,
        categories: categoryOrder.reduce<Record<string, number>>((acc, category) => {
          acc[category] = created.filter((item) => item.category === category).length;
          return acc;
        }, {}),
      },
      email: triggeredBy !== 'manual',
    });

    socketService.emitToServer(serverId, 'scan:completed', {
      scanId,
      serverId,
      fileCount: created.length,
      triggeredBy,
    });

    return {
      scanId,
      fileCount: created.length,
      results: created,
      reviewRequired: true,
      automationBlockedUntilReview: !config.automationEnabled,
      automaticCleanup: null,
      analysis,
    };
  },

  async getResults(query: {
    serverId?: string;
    scanId?: string;
    category?: string;
    search?: string;
    status?: string;
    minSizeMb?: string;
    maxSizeMb?: string;
    olderThanDays?: string;
    limit?: string;
    latest?: boolean;
    markReviewed?: boolean;
    reviewedBy?: Types.ObjectId;
  }) {
    const filter: Record<string, unknown> = {};
    if (query.serverId) {
      filter.server = new Types.ObjectId(query.serverId);
    }
    if (query.scanId) {
      filter.scanId = query.scanId;
    }
    if (!query.scanId && query.latest) {
      const latestScan = await ScanResult.findOne(filter.server ? { server: filter.server } : {})
        .select('scanId')
        .sort({ discoveredAt: -1 })
        .lean();
      if (!latestScan?.scanId) {
        return [];
      }
      filter.scanId = latestScan.scanId;
    }
    if (query.category) {
      filter.category = query.category;
    }
    if (query.status) {
      filter.reviewStatus = query.status;
    }
    if (query.search) {
      const searchRegex = new RegExp(escapeRegExp(query.search), 'i');
      filter.$or = [
        { fileName: searchRegex },
        { path: searchRegex },
        { directory: searchRegex },
      ];
    }
    if (query.minSizeMb || query.maxSizeMb) {
      filter.sizeMb = {};
      if (query.minSizeMb) {
        (filter.sizeMb as Record<string, number>).$gte = Number(query.minSizeMb);
      }
      if (query.maxSizeMb) {
        (filter.sizeMb as Record<string, number>).$lte = Number(query.maxSizeMb);
      }
    }
    if (query.olderThanDays) {
      filter.lastAccessed = {
        $lte: new Date(Date.now() - Number(query.olderThanDays) * 86400000),
      };
    }

    const limit = Math.min(Number(query.limit) || 1000, 10000);
    const results = await ScanResult.find(filter).sort({ discoveredAt: -1 }).limit(limit);

    if (query.markReviewed && results.length) {
      await ScanResult.updateMany(
        {
          _id: { $in: results.map((item) => item._id) },
          reviewStatus: 'pending_review',
        },
        {
          reviewStatus: 'reviewed',
          reviewedAt: new Date(),
          reviewedBy: query.reviewedBy,
          updated: new Date(),
        },
      );
      results.forEach((item) => {
        item.reviewStatus = 'reviewed';
        item.reviewedAt = new Date();
        item.reviewedBy = query.reviewedBy;
      });
    }

    return results.sort((first, second) => {
      const categoryDiff =
        categoryOrder.indexOf(first.category) - categoryOrder.indexOf(second.category);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      return second.sizeMb - first.sizeMb;
    });
  },

  async recommendCleanup(
    serverId: string,
    directories?: string[],
    trigger: 'manual' | 'scheduled' = 'manual',
  ) {
    const scanStartedAt = Date.now();
    const scan = await this.startScan(serverId, directories, 'manual', {
      suppressAutomaticCleanup: true,
    });
    const config = await configService.get(serverId);
    const severityByPath = await determineFileSeverities(scan.results as CleanupRecommendationSource[]);
    const recommendations = scan.results.map((result) =>
      buildCleanupRecommendation(
        result,
        config,
        severityByPath.get(result.path) || 'INFO',
      ),
    );
    const summary = recommendations.reduce<CleanupRecommendationSummary>(
      (acc, recommendation) => {
        acc[recommendation.action] += 1;
        acc.severityCounts[recommendation.severity] += 1;
        acc.totalScannedSizeBytes += recommendation.size;
        if (recommendation.action === 'archive' || recommendation.action === 'delete') {
          acc.expectedReclaimableSizeBytes += recommendation.size;
        }
        return acc;
      },
      {
        scanId: scan.scanId,
        scannedFiles: recommendations.length,
        archive: 0,
        delete: 0,
        keep: 0,
        protected: 0,
        severityCounts: defaultSeverityCounts(),
        totalScannedSizeBytes: 0,
        expectedReclaimableSizeBytes: 0,
        scanDurationMs: Date.now() - scanStartedAt,
      },
    );

    const auditLog = await MaintenanceLog.create({
      server: new Types.ObjectId(serverId),
      action: 'decision',
      status: 'preview',
      reason: 'Cleanup recommendations prepared from a fresh filesystem scan. No files were modified.',
      aiDecisionTrace: [
        'Recommendation API performed a fresh scan and treated the filesystem as the source of truth.',
        'Recommendations were generated from persisted scan results and maintenance configuration.',
        'No delete, archive, or ignore action was executed.',
      ],
      metadata: {
        scanId: scan.scanId,
        recommendationOnly: true,
        summary,
        sampleRecommendations: recommendations.slice(0, 25).map((recommendation) => ({
          fileId: recommendation.fileId,
          path: recommendation.path,
          action: recommendation.action,
          reason: recommendation.reason,
        })),
      },
      created: new Date(),
    });

    summary.auditLogId = String(auditLog._id);

    await CleanupExecution.findOneAndUpdate(
      { server: new Types.ObjectId(serverId), scanId: scan.scanId },
      {
        server: new Types.ObjectId(serverId),
        scanId: scan.scanId,
        status: 'preview_ready',
        triggeredBy: trigger,
        recommendations: recommendations.map((recommendation) => ({
          scanResultId: new Types.ObjectId(recommendation.fileId),
          filePath: recommendation.path,
          fileName: recommendation.fileName,
          directory: recommendation.directory,
          size: recommendation.size,
          sizeMb: recommendation.sizeMb,
          category: recommendation.category,
          tags: recommendation.tags,
          severity: recommendation.severity,
          recommendedAction: recommendation.action,
          reason: recommendation.reason,
          confidence: recommendation.confidence,
          decisionTrace: recommendation.decisionTrace,
          executionStatus: 'pending',
        })),
        previewSummary: {
          scannedFiles: summary.scannedFiles,
          severityCounts: summary.severityCounts,
          actionCounts: {
            archive: summary.archive,
            delete: summary.delete,
            keep: summary.keep,
            protected: summary.protected,
          },
          totalScannedSizeBytes: summary.totalScannedSizeBytes,
          expectedReclaimableSizeBytes: summary.expectedReclaimableSizeBytes,
          scanDurationMs: summary.scanDurationMs,
        },
        startedAt: new Date(scanStartedAt),
        updated: new Date(),
      },
      { upsert: true, new: true },
    );

    return {
      scanId: scan.scanId,
      recommendations,
      summary,
      audit: {
        prepared: true,
        logId: String(auditLog._id),
        message: 'Recommendation audit prepared. No filesystem changes were executed.',
      },
    };
  },

  async executeCleanupRecommendations(serverId: string, scanId: string, triggeredBy: 'manual' | 'scheduled' = 'manual') {
    const lifecycle = await CleanupExecution.findOne({
      server: new Types.ObjectId(serverId),
      scanId,
    });
    if (!lifecycle) {
      throw new AppError('Cleanup lifecycle not found.', HTTP_STATUS.NOT_FOUND);
    }
    lifecycle.status = 'executing';
    lifecycle.updated = new Date();
    await lifecycle.save();

    const executionStartedAt = Date.now();
    let deletedFiles = 0;
    let archivedFiles = 0;
    let backedUpFiles = 0;
    let skippedFiles = 0;
    let failedFiles = 0;
    let reclaimedBytes = 0;

    for (const recommendation of lifecycle.recommendations) {
      if (recommendation.recommendedAction === 'keep' || recommendation.recommendedAction === 'protected') {
        recommendation.executionStatus = 'skipped';
        recommendation.executionReason = 'Skipped by recommendation policy.';
        skippedFiles += 1;
        continue;
      }

      const scanResult = await ScanResult.findById(recommendation.scanResultId);
      if (!scanResult) {
        recommendation.executionStatus = 'failed';
        recommendation.executionReason = 'Scan result not found.';
        failedFiles += 1;
        continue;
      }
      scanResult.reviewStatus = 'reviewed';
      scanResult.reviewedAt = new Date();
      scanResult.updated = new Date();

      const requiresCriticalBackup = recommendation.recommendedAction === 'delete'
        && elevatedBackupSeverities.includes(recommendation.severity);
      const result = await executionService.executeScanResult(
        scanResult,
        recommendation.recommendedAction === 'archive' ? 'archive' : 'delete',
        `Cleanup lifecycle execution: ${recommendation.reason}`,
        recommendation.decisionTrace,
        {
          triggeredBy: triggeredBy === 'scheduled' ? 'automation' : 'manual',
          backupDirectoryOverride: requiresCriticalBackup ? cleanupBackupDirectory : undefined,
        },
      );

      if (result.status === 'success') {
        recommendation.executionStatus = 'success';
        recommendation.executionReason = result.reason;
        if (recommendation.recommendedAction === 'delete') {
          deletedFiles += 1;
          reclaimedBytes += recommendation.size;
          if (requiresCriticalBackup) {
            backedUpFiles += 1;
            recommendation.backupPath = String((result as { backupPath?: string }).backupPath || '');
          }
        } else {
          archivedFiles += 1;
          reclaimedBytes += recommendation.size;
        }
      } else {
        recommendation.executionStatus = 'failed';
        recommendation.executionReason = result.reason;
        failedFiles += 1;
      }
    }

    lifecycle.executionSummary = {
      deletedFiles,
      archivedFiles,
      backedUpFiles,
      skippedFiles,
      failedFiles,
      reclaimedBytes,
      executionDurationMs: Date.now() - executionStartedAt,
      startedAt: new Date(executionStartedAt),
      completedAt: new Date(),
    };
    lifecycle.status = failedFiles ? 'failed' : 'completed';
    lifecycle.completedAt = new Date();
    lifecycle.updated = new Date();
    await lifecycle.save();

    return lifecycle;
  },

  async getCleanupTimeline(serverId?: string) {
    const filter = serverId ? { server: new Types.ObjectId(serverId) } : {};
    return CleanupExecution.find(filter).sort({ startedAt: -1 }).limit(100).lean();
  },

  async getCleanupSummary(scanId: string, serverId?: string) {
    const filter: Record<string, unknown> = { scanId };
    if (serverId) {
      filter.server = new Types.ObjectId(serverId);
    }
    return CleanupExecution.findOne(filter).lean();
  },
};
