import path from 'path';
import { Types } from 'mongoose';
import { envConfig } from '../../../config/env.config';
import { logger } from '../../../utils/logger.util';
import { ServerConnection } from '../models/serverConnection.model';
import { Alert } from '../models/alert.model';
import {
  FileBackupHistory,
  FileCategory,
  FileRecommendedAction,
  FileRiskLevel,
  FileScanEvent,
  FileScanResult,
  IFileScanResult,
  QuarantinedFile,
  SecurityAlert,
} from '../models/fileScanner.model';
import { alertService } from './alert.service';
import { sshService } from './ssh.service';

interface QueryInput {
  serverId?: string;
  riskLevel?: string;
  scanStatus?: string;
  timeRange?: '30m' | '1h' | '4h' | '12h' | '24h' | '48h' | '7d' | '30d' | 'custom';
  startTime?: string;
  endTime?: string;
  page?: number;
  limit?: number;
}

interface TypeClassification {
  fileCategory: FileCategory;
  typeConfidence: number;
  typeSignals: string[];
}

interface RuleScan {
  riskLevel: FileRiskLevel;
  riskScore: number;
  riskReasons: string[];
  detectedPatterns: string[];
  harmfulBehaviors: string[];
  recommendedAction: FileRecommendedAction;
  confirmedMalicious: boolean;
}

const maxPreviewBytes = 64 * 1024;
const aiPreviewChars = 4000;
const aiExplainTimeoutMs = 5000;
const aiExplainRetryMs = 15 * 60 * 1000;
let scheduler: NodeJS.Timeout | null = null;
let inFlightScheduler = false;
let activeScans = 0;
let aiExplainUnavailableUntil = 0;
const pendingQueue: Array<() => Promise<void>> = [];
const lastSweepByServer = new Map<string, number>();
const debounceByFile = new Map<string, number>();
const sshCooldownByServer = new Map<string, number>();

const shellQuote = (value: string) => `'${String(value).replace(/'/g, `'\\''`)}'`;
const normalizePath = (value: string) => value.replace(/\/+$/, '');

const scannerRoots = () => envConfig.fileScannerWatchRoots.map(normalizePath).filter(Boolean);

const scannerExclusions = () => {
  const configured = envConfig.fileScannerExcludePaths.map(normalizePath).filter(Boolean);
  const safeProjectPaths = [
    'node_modules',
    '.git',
    'src',
    'dist',
    'uploads',
    'package.json',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'tsconfig.json',
    'tsconfig.build.json',
    'ecosystem.config.js',
    'vite.config.ts',
    'webpack.config.js',
    'docker-compose.yml',
    'Dockerfile',
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
    '/etc/ssh',
    '/etc/ssl',
    '/etc/nginx',
    '/etc/apache2',
    '/etc/mysql',
    '/etc/postgresql',
    '/var/www'
  ];
  return Array.from(new Set([
    ...configured,
    ...safeProjectPaths.map(normalizePath),
    normalizePath(envConfig.fileScannerBackupPath),
    normalizePath(envConfig.fileScannerQuarantinePath),
  ]));
};

const rangeToMs = (range: QueryInput['timeRange'] = '24h') => {
  const ranges = {
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '12h': 12 * 60 * 1000 * 12,
    '24h': 24 * 60 * 60 * 1000,
    '48h': 48 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return range === 'custom' ? ranges['24h'] : ranges[range || '24h'];
};

const resolveWindow = (query: QueryInput) => {
  const end = query.timeRange === 'custom' && query.endTime ? new Date(query.endTime) : new Date();
  const start = query.timeRange === 'custom' && query.startTime
    ? new Date(query.startTime)
    : new Date(end.getTime() - rangeToMs(query.timeRange));
  return { start, end };
};

const runQueuedScan = (task: () => Promise<void>) => {
  pendingQueue.push(task);
  void drainQueue();
};

const drainQueue = async () => {
  while (activeScans < envConfig.fileScannerMaxConcurrentScans && pendingQueue.length) {
    const task = pendingQueue.shift();
    if (!task) return;
    activeScans += 1;
    task()
      .catch((error) => logger.warn(`[FileScanner] scan task failed: ${error instanceof Error ? error.message : String(error)}`))
      .finally(() => {
        activeScans -= 1;
        void drainQueue();
      });
  }
};

const parseDetectedFiles = (stdout: string) =>
  stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [filePath, size, modifiedAtEpoch] = line.split('\t');
      return {
        filePath,
        fileSize: Number(size) || 0,
        modifiedAt: new Date((Number(modifiedAtEpoch) || 0) * 1000),
      };
    })
    .filter((item) => item.filePath);

const suspiciousPathPriority = (filePath: string) => {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath === '/tmp/test-script.sh') return 100;
  if (/\/(disk-fill|disk_fill|fill-disk|fill_disk|testfile)\b/.test(lowerPath) || /\.(img|iso|bin|dat)$/.test(lowerPath)) return 90;
  if (/\.(sh|php|py|js|service|conf|env)$/.test(lowerPath)) return 80;
  if (lowerPath.includes('/tmp/') || lowerPath.includes('/etc/cron') || lowerPath.includes('/etc/systemd/system')) return 60;
  // if (lowerPath.includes('/var/www/') || lowerPath.includes('/root/') || lowerPath.includes('/home/')) return 40;
  return 0;
};

const isLargeDiskFillCandidate = (filePath: string, size: number) => {
  const lowerPath = filePath.toLowerCase();
  const thresholdBytes = envConfig.fileScannerLargeFileThreatMb * 1024 * 1024;
  if (size < thresholdBytes) return false;
  const riskyLocation = lowerPath.startsWith('/tmp/') || lowerPath.startsWith('/var/tmp/') || lowerPath.startsWith('/root/') || lowerPath.startsWith('/home/');
  const diskFillName = /(^|\/)(disk-fill|disk_fill|fill-disk|fill_disk|testfile)/.test(lowerPath);
  const diskImage = /\.(img|iso|bin|dat)$/.test(lowerPath);
  return riskyLocation && (diskFillName || diskImage);
};

const sortScanCandidates = (files: ReturnType<typeof parseDetectedFiles>) => {
  const maxBytes = envConfig.fileScannerMaxFileSizeMb * 1024 * 1024;
  return [...files].sort((a, b) => {
    const aLargeThreat = isLargeDiskFillCandidate(a.filePath, a.fileSize) ? 1 : 0;
    const bLargeThreat = isLargeDiskFillCandidate(b.filePath, b.fileSize) ? 1 : 0;
    if (aLargeThreat !== bLargeThreat) return bLargeThreat - aLargeThreat;
    const aSmall = a.fileSize <= maxBytes ? 1 : 0;
    const bSmall = b.fileSize <= maxBytes ? 1 : 0;
    if (aSmall !== bSmall) return bSmall - aSmall;
    const priorityDiff = suspiciousPathPriority(b.filePath) - suspiciousPathPriority(a.filePath);
    if (priorityDiff !== 0) return priorityDiff;
    return b.modifiedAt.getTime() - a.modifiedAt.getTime();
  });
};

const shouldExcludePath = (filePath: string) => {
  const normalized = normalizePath(filePath);
  const basename = path.posix.basename(normalized);
  if (basename === '.env' || basename.startsWith('.env.')) return true;
  return scannerExclusions().some((exclude) => {
    if (!exclude) return false;
    if (exclude.startsWith('/')) return normalized === exclude || normalized.startsWith(`${exclude}/`);
    const segments = normalized.split('/').filter(Boolean);
    return segments.includes(exclude) || normalized.endsWith(`/${exclude}`) || normalized.includes(`/${exclude}/`);
  });
};

const scanLog = (serverId: string, filePath: string, reason: string, action: string) => {
  logger.info(`[FileScanner] server=${serverId} file=${filePath} reason="${reason}" action=${action}`);
};

const isScannerServerAllowed = (serverId: string) =>
  envConfig.fileScannerServerIds.length === 0 || envConfig.fileScannerServerIds.includes(serverId);

const isSshCooldownActive = (serverId: string) => {
  const until = sshCooldownByServer.get(serverId) || 0;
  if (until <= Date.now()) {
    sshCooldownByServer.delete(serverId);
    return false;
  }
  return true;
};

const setSshCooldown = (serverId: string, error: unknown) => {
  sshCooldownByServer.set(serverId, Date.now() + envConfig.fileScannerSshCooldownMs);
  // logger.debug(
  //   `[FileScanner] SSH unavailable for server=${serverId}; pausing scanner for ${Math.round(envConfig.fileScannerSshCooldownMs / 1000)}s. ${
  //     error instanceof Error ? error.message : String(error)
  //   }`,
  // );
};

const buildFindCommand = () => {
  const roots = scannerRoots();
  const excludes = scannerExclusions();
  const rootList = roots.map(shellQuote).join(' ');
  const pruneExpr = excludes
    .map((exclude) => {
      const pattern = exclude.startsWith('/') ? `${exclude}*` : `*/${exclude}/*`;
      return `-path ${shellQuote(pattern)}`;
    })
    .join(' -o ');

  return [
    'set +e',
    'tab=$(printf "\\t")',
    `for p in ${rootList}; do`,
    '  if [ ! -e "$p" ]; then echo "WARN missing root $p" >&2; continue; fi',
    '  if [ ! -r "$p" ]; then echo "WARN unreadable root $p" >&2; continue; fi',
    pruneExpr
      ? `  find "$p" \\( ${pruneExpr} \\) -prune -o -type f -printf '%T@\\t%p\\t%s\\n' 2>/dev/null`
      : `  find "$p" -type f -printf '%T@\\t%p\\t%s\\n' 2>/dev/null`,
    `done | sort -t "$tab" -k1,1nr | head -n ${envConfig.fileScannerMaxFilesPerSweep} | awk -F '\\t' '{printf "%s\\t%s\\t%d\\n",$2,$3,$1}'`,
  ].join('\n');
};

const metadataCommand = (filePath: string, maxBytes: number) => `
set +e
f=${shellQuote(filePath)}
[ -f "$f" ] || exit 3
size=$(stat -c %s "$f" 2>/dev/null)
printf "size=%s\\n" "$size"
printf "mtime=%s\\n" "$(stat -c %Y "$f" 2>/dev/null)"
printf "perm=%s\\n" "$(stat -c %a "$f" 2>/dev/null)"
printf "owner=%s\\n" "$(stat -c '%U:%G' "$f" 2>/dev/null)"
printf "mime=%s\\n" "$(file -b --mime-type "$f" 2>/dev/null)"
printf "type=%s\\n" "$(file -b "$f" 2>/dev/null | head -c 220)"
if [ "${'$'}size" -le ${Math.max(1, maxBytes)} ]; then
  printf "hash=%s\\n" "$(sha256sum "$f" 2>/dev/null | awk '{print $1}')"
else
  printf "hash=%s\\n" "$(head -c ${Math.max(1, maxBytes)} "$f" 2>/dev/null | sha256sum | awk '{print $1}')"
fi
echo "__PREVIEW__"
head -c ${Math.min(maxPreviewBytes, Math.max(0, maxBytes))} "$f" 2>/dev/null
`;

const parseMetadata = (stdout: string) => {
  const [kvText, preview = ''] = stdout.split('__PREVIEW__\n');
  const kv = kvText.split('\n').reduce<Record<string, string>>((acc, line) => {
    const separator = line.indexOf('=');
    if (separator > 0) acc[line.slice(0, separator)] = line.slice(separator + 1);
    return acc;
  }, {});
  return { kv, preview };
};

const hasBinarySignal = (mime = '', detectedType = '', preview = '') =>
  mime.startsWith('application/octet-stream') ||
  /executable|shared object|archive|compressed|image|audio|video/i.test(detectedType) ||
  preview.includes('\u0000');

export const classifyFile = (filePath: string, mime: string, detectedType: string, preview: string): TypeClassification => {
  const lowerPath = filePath.toLowerCase();
  const lowerPreview = preview.slice(0, 12000).toLowerCase();
  const extension = path.posix.extname(lowerPath);
  const signals: string[] = [];
  const choose = (fileCategory: FileCategory, typeConfidence: number, signal: string) => {
    signals.push(signal);
    return { fileCategory, typeConfidence, typeSignals: signals };
  };

  const isSourceCodeExt = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rb', '.c', '.cpp', '.cs', '.rs'].includes(extension);
  if (/-----begin [a-z ]*private key-----/.test(lowerPreview)) return choose('private_key_file', 0.99, 'private-key-block');
  // Source-code files legitimately assign to password/token variables — only flag non-source files for this pattern
  if (!isSourceCodeExt && /(aws_access_key_id|aws_secret_access_key|password\s*=|token\s*=|secret\s*=)/i.test(preview)) return choose('credential_file', 0.92, 'credential-keywords');
  if (/\.env(\.|$)|\/\.env$/.test(lowerPath)) return choose('env_file', 0.9, 'env-path');
  if (/\/etc\/systemd\/system\/|\.service$/.test(lowerPath) || /\[service]\s*[\s\S]*execstart=/i.test(preview)) return choose('systemd_service', 0.9, 'systemd-service-content');
  if (/\/var\/spool\/cron\/|\/etc\/cron\.d\//.test(lowerPath) || /^\s*(@reboot|(\*|\d+)\s+(\*|\d+)\s+(\*|\d+)\s+(\*|\d+)\s+(\*|\d+))/m.test(preview)) return choose('cron_file', 0.9, 'cron-schedule');
  if (/nginx/.test(lowerPath) || /\bserver\s*\{[\s\S]*\blocation\s+/i.test(preview)) return choose('nginx_config', 0.86, 'nginx-config-syntax');
  if (/apache2?|httpd/.test(lowerPath) || /\bvirtualhost\b|^\s*<directory\b/im.test(preview)) return choose('apache_config', 0.86, 'apache-config-syntax');
  if (/dockerfile$/.test(lowerPath) || /^\s*from\s+[\w./:-]+/im.test(preview)) return choose('docker_file', 0.88, 'dockerfile-syntax');
  if (extension === '.sh' || /^#!.*\b(bash|sh|zsh|dash)\b/i.test(preview)) return choose('shell_script', 0.9, 'shell-shebang-or-extension');
  if (extension === '.py' || /^#!.*python/i.test(preview) || /\bimport\s+(os|socket|subprocess)\b/.test(lowerPreview)) return choose('python_script', 0.84, 'python-signals');
  if (extension === '.php' || /<\?php/i.test(preview)) return choose('php_script', 0.9, 'php-open-tag');
  if (extension === '.js' || /\b(require\(|import\s+.*from|module\.exports)\b/.test(preview)) return choose('node_script', 0.82, 'node-javascript-signals');
  if (extension === '.json' || mime === 'application/json') return choose('json_file', 0.86, 'json-extension-or-mime');
  if (['.yml', '.yaml'].includes(extension)) return choose('yaml_file', 0.82, 'yaml-extension');
  if (['.html', '.htm'].includes(extension) || /<html|<!doctype html/i.test(preview)) return choose('html_file', 0.84, 'html-content');
  if (['.conf', '.config', '.ini', '.toml', '.properties'].includes(extension) || /(^|\n)\s*[\w.-]+\s*=/.test(preview)) return choose('config_file', 0.72, 'config-key-value');
  if (['.sql', '.dump'].includes(extension) || /\b(create table|insert into|pg_dump|mysql dump)\b/i.test(preview)) return choose('database_dump', 0.82, 'database-dump-signals');
  if (['.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar'].includes(extension) || /archive|compressed/i.test(detectedType)) return choose('archive_file', 0.86, 'archive-signals');
  if (extension === '.log') return choose('log_file', 0.75, 'log-extension');
  if (hasBinarySignal(mime, detectedType, preview)) return choose('binary_file', 0.8, 'binary-mime-or-file-output');
  if (['.ts', '.tsx', '.jsx', '.java', '.go', '.rb', '.c', '.cpp', '.cs', '.rs'].includes(extension)) return choose('source_code', 0.76, 'source-code-extension');
  return choose('unknown', 0.35, 'no-strong-content-signal');
};

const harmfulRules: Array<{ name: string; regex: RegExp; score: number; reason: string; behavior: string }> = [
  { name: 'destructive-root-delete', regex: /rm\s+-rf\s+\/(\s|$)|rm\s+-fr\s+\/(\s|$)/i, score: 85, reason: 'Attempts recursive deletion from filesystem root.', behavior: 'destructive_command' },
  { name: 'mkfs-format', regex: /\bmkfs(\.\w+)?\b/i, score: 70, reason: 'Contains filesystem format command.', behavior: 'destructive_command' },
  { name: 'raw-disk-write', regex: /\bdd\s+if=.*\bof=\/dev\//i, score: 70, reason: 'Contains raw disk write command.', behavior: 'destructive_command' },
  { name: 'recursive-world-writable', regex: /chmod\s+(-R\s+)?777\s+/i, score: 45, reason: 'Makes files world-writable.', behavior: 'permission_weakening' },
  { name: 'curl-bash', regex: /(curl|wget)[^|;]*\|\s*(bash|sh)/i, score: 65, reason: 'Downloads and executes remote code.', behavior: 'remote_code_execution' },
  { name: 'reverse-shell', regex: /nc\s+-e|bash\s+-i|\/dev\/tcp|socat\s+.*exec:/i, score: 75, reason: 'Contains reverse shell indicators.', behavior: 'reverse_shell' },
  { name: 'php-webshell', regex: /(system|shell_exec|passthru|exec)\s*\(\s*\$_(GET|POST|REQUEST)|eval\s*\(\s*(base64_decode|gzinflate)/i, score: 75, reason: 'Contains PHP webshell execution pattern.', behavior: 'webshell' },
  { name: 'node-suspicious-exec', regex: /(child_process\.(exec|spawn|execFile)|\.exec)\s*\(\s*['"`](rm\s+-rf|curl\b|wget\b|nc\b|bash\s+-i|sh\s+-i|\/bin\/sh|\/bin\/bash)/i, score: 65, reason: 'Node script executes a suspicious shell command.', behavior: 'process_execution' },
  { name: 'python-reverse-shell', regex: /(socket\.socket\([\s\S]{0,600}(connect|dup2|pty\.spawn)|subprocess\.(call|popen|run)\s*\(\s*['"][^'"]*(nc|bash\s+-i|sh\s+-i|\/dev\/tcp))/i, score: 65, reason: 'Python code contains reverse shell or suspicious process execution behavior.', behavior: 'reverse_shell' },
  // Detects genuine "decode then execute": the JS eval() function or the Function
  // constructor (capital F) invoked on a decoded/encoded payload. This MUST stay
  // case-sensitive — with the /i flag, `Function` also matches the ubiquitous
  // lowercase `function` keyword, which false-positives on essentially all real
  // JavaScript (Babel compiles arrow fns to `function(x){...Buffer.from(x,'base64')}`
  // and every minified bundle contains `function(e){...String.fromCharCode(e)}`).
  // The decode indicator must itself be a call and sit within a tight window of the
  // executor so ordinary base64/charCode usage near an unrelated function is ignored.
  { name: 'eval-obfuscated-payload', regex: /\b(?:eval|(?:new\s+)?Function)\s*\(\s*(?:[\w$.]{0,24}\.)?(?:atob\s*\(|base64_decode\s*\(|Buffer\.from\s*\([^)]*['"]base64['"]|gzinflate\s*\(|String\.fromCharCode\s*\()/, score: 70, reason: 'Evaluates obfuscated or encoded payload content.', behavior: 'encoded_payload' },
  { name: 'base64-shell-payload', regex: /(base64\s+-d|openssl\s+enc\s+-d)[\s\S]{0,300}(\|\s*(bash|sh)|`|\$\()/i, score: 55, reason: 'Decodes encoded content into a shell execution path.', behavior: 'encoded_payload' },
  // Require actual credential values: quoted string literals OR env-file KEY=value style (anchored to line start)
  // Bare `password = someFunction()` or `password: String` in source code must NOT match
  { name: 'credential-exposure', regex: /BEGIN (RSA|OPENSSH|PRIVATE) KEY|AKIA[0-9A-Z]{16}|(?:password|token|secret|api_key)\s*=\s*["'][^"'\s]{4,}["']|^(?:password|token|secret|api_key)\s*=\s*[^"'\s$({\\][^\s]{3,}/im, score: 15, reason: 'Contains likely credentials, tokens, or private keys; review exposure risk.', behavior: 'credential_exposure' },
  { name: 'crypto-miner', regex: /xmrig|stratum\+tcp|monero|cryptonight|minerd/i, score: 75, reason: 'Contains crypto miner indicators.', behavior: 'crypto_miner' },
  { name: 'cron-persistence-download', regex: /(@reboot|\/etc\/cron|crontab\s+)[\s\S]{0,500}(curl|wget|nc|\/dev\/tcp|base64\s+-d|xmrig)/i, score: 60, reason: 'Cron persistence is paired with download, shell, encoded payload, or miner behavior.', behavior: 'persistence' },
  { name: 'systemd-persistence-download', regex: /(systemctl\s+enable|wantedby=multi-user\.target|\/etc\/systemd\/system)[\s\S]{0,700}(curl|wget|nc|\/dev\/tcp|base64\s+-d|xmrig)/i, score: 60, reason: 'Systemd persistence is paired with download, shell, encoded payload, or miner behavior.', behavior: 'persistence' },
  { name: 'ssh-authorized-keys-injection', regex: /(echo|cat|printf)[\s\S]{0,300}(ssh-rsa\s+|ecdsa-sha2-nistp|ssh-ed25519)[\s\S]{0,300}(authorized_keys|\.ssh)/i, score: 65, reason: 'Injects an SSH public key into authorized_keys.', behavior: 'persistence' },
];

const riskFromScore = (score: number): FileRiskLevel => {
  if (score >= 85) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  if (score > 0) return 'low';
  return 'safe';
};

const configuredHarmfulAction = (): FileRecommendedAction =>
  envConfig.fileScannerActionOnHarmful.trim().toLowerCase() === 'delete' ? 'delete' : 'quarantine';

const maliciousBehaviors = new Set([
  'destructive_command',
  'remote_code_execution',
  'reverse_shell',
  'webshell',
  'process_execution',
  'encoded_payload',
  'crypto_miner',
  'persistence',
]);

// Behaviors that are unambiguous evidence of malware. ONLY these justify
// automated containment (quarantine/delete). The other behaviors are heuristic
// content-pattern signals that legitimately occur in real application code,
// framework runtimes, transpiler (Babel) output and minified bundles, so on
// their own they must never trigger destructive automation against a legitimate
// project file — they are surfaced as HIGH/CRITICAL alerts for human review.
const hardMaliciousBehaviors = new Set([
  'destructive_command',
  'remote_code_execution',
  'reverse_shell',
  'webshell',
  'crypto_miner',
  'persistence',
]);

// File categories that represent first-class project code. These are the kinds
// of files a deployed application legitimately contains (controllers, models,
// services, utilities, middleware, views, configs, build output, ...).
const projectCodeCategories = new Set<FileCategory>([
  'source_code',
  'node_script',
  'python_script',
  'php_script',
  'shell_script',
  'html_file',
  'json_file',
  'yaml_file',
  'config_file',
  'docker_file',
]);

// Recognizes generated/minified build artifacts (frontend bundles, polyfills,
// vendor chunks). These are legitimate deployment outputs that intrinsically
// look "obfuscated" to content heuristics; auto-deleting one breaks the running
// site, so they must never be contained automatically — only reviewed.
const isBuildArtifact = (filePath: string, preview: string) => {
  const lowerPath = filePath.toLowerCase();
  const base = path.posix.basename(lowerPath);
  if (/\.min\.(js|css|mjs)$/.test(base)) return true;
  if (/[-.](?=[a-z0-9_~]*\d)[a-z0-9_~]{8,}\.(?:js|mjs|css)$/.test(base)) return true; // content-hashed bundle e.g. index-cyycpy9o.js
  if (/(^|-)(polyfills|vendor|runtime|chunk|bundle|main|index)([.-]|$)/.test(base) && /\.(js|mjs|css)$/.test(base)) return true;
  if (/\/(assets|dist|build|_next|out|static)\//.test(lowerPath)) return true;
  if (/sourceMappingURL=/.test(preview)) return true;
  const head = preview.slice(0, 4000);
  const firstNewline = head.indexOf('\n');
  const firstLineLength = firstNewline === -1 ? head.length : firstNewline;
  if (preview.length > 2000 && firstLineLength > 1000) return true; // single very long line ⇒ minified
  return false;
};

// The core safety policy: withhold automated containment when the only evidence
// is heuristic/soft signals AND the file is legitimate project code or a build
// artifact. Unambiguous malware (reverse shells, webshells, miners, persistence,
// destructive commands, remote code execution) is still contained anywhere.
const shouldWithholdAutomatedContainment = (
  behaviors: Iterable<string>,
  fileCategory: FileCategory,
  filePath: string,
  preview: string,
) => {
  const behaviorList = Array.from(behaviors);
  const hasHardSignal = behaviorList.some((behavior) => hardMaliciousBehaviors.has(behavior));
  if (hasHardSignal) return false;
  return projectCodeCategories.has(fileCategory) || isBuildArtifact(filePath, preview);
};

const confirmsMaliciousContent = (harmfulBehaviors: Set<string>, detectedPatterns: string[], score: number) => {
  if (!Array.from(harmfulBehaviors).some((behavior) => maliciousBehaviors.has(behavior))) return false;
  if (detectedPatterns.includes('credential-exposure') && harmfulBehaviors.size === 1) return false;
  return score >= 60 || detectedPatterns.some((pattern) => [
    'destructive-root-delete',
    'mkfs-format',
    'raw-disk-write',
    'curl-bash',
    'reverse-shell',
    'php-webshell',
    'eval-obfuscated-payload',
    'crypto-miner',
    'ssh-authorized-keys-injection',
  ].includes(pattern));
};

export const scanRules = (filePath: string, preview: string, classification: TypeClassification, size: number): RuleScan => {
  let score = 0;
  const riskReasons: string[] = [];
  const detectedPatterns: string[] = [];
  const harmfulBehaviors = new Set<string>();

  if (size > envConfig.fileScannerMaxFileSizeMb * 1024 * 1024) {
    score += 5;
    riskReasons.push('File exceeded full scan size limit; only metadata and safe preview were inspected.');
    detectedPatterns.push('large-file-limited-scan');
  }

  if (isLargeDiskFillCandidate(filePath, size)) {
    score += 25;
    riskReasons.push(`Large file in a writable/high-risk path can rapidly exhaust disk space (${Math.round(size / 1024 / 1024)} MB).`);
    detectedPatterns.push('large-disk-fill-file');
    harmfulBehaviors.add('disk_exhaustion');
  }

  const isSourceCodeCategory = ['source_code', 'node_script', 'python_script', 'php_script', 'shell_script'].includes(classification.fileCategory);
  harmfulRules.forEach((rule) => {
    // Source-code files have legitimate credential-variable patterns; skip this low-signal rule for them
    if (rule.name === 'credential-exposure' && isSourceCodeCategory) return;
    if (rule.regex.test(preview)) {
      score += rule.score;
      riskReasons.push(rule.reason);
      detectedPatterns.push(rule.name);
      harmfulBehaviors.add(rule.behavior);
    }
  });

  if (classification.fileCategory === 'private_key_file') {
    score += 25;
    riskReasons.push('File content appears to include a private key; review exposure risk.');
    detectedPatterns.push('private-key-content');
    harmfulBehaviors.add('credential_exposure');
  }

  const normalizedScore = Math.min(score, 100);
  const confirmedMalicious = confirmsMaliciousContent(harmfulBehaviors, detectedPatterns, normalizedScore);
  const riskLevel = riskFromScore(Math.min(score, 100));
  const configuredAction = configuredHarmfulAction();
  let recommendedAction: FileRecommendedAction = confirmedMalicious && (riskLevel === 'critical' || riskLevel === 'high')
    ? configuredAction
    : riskLevel === 'medium'
      ? 'review'
      : 'allow';

  // Never auto-quarantine/delete a legitimate project file or build artifact on
  // heuristic-only evidence. Downgrade to review so a human decides — deleting a
  // real project file is far worse than delaying removal of a suspicious one.
  if (
    (recommendedAction === 'delete' || recommendedAction === 'quarantine') &&
    shouldWithholdAutomatedContainment(harmfulBehaviors, classification.fileCategory, filePath, preview)
  ) {
    recommendedAction = 'review';
    riskReasons.push(
      'Automated containment withheld: detections are heuristic content patterns on a legitimate project source or build file. Flagged for manual review instead of deletion.',
    );
  }

  return {
    riskLevel,
    riskScore: Math.min(score, 100),
    riskReasons: riskReasons.length ? riskReasons : ['No harmful content patterns detected in safe preview.'],
    detectedPatterns,
    harmfulBehaviors: Array.from(harmfulBehaviors),
    recommendedAction,
    confirmedMalicious,
  };
};

const fallbackExplanation = (scan: RuleScan, classification: TypeClassification) =>
  `Rule-based scanner classified this file as ${classification.fileCategory} with ${Math.round(classification.typeConfidence * 100)}% confidence and risk ${scan.riskLevel} (${scan.riskScore}/100). ${scan.riskReasons.join(' ')}`;

const sanitizePreviewForAi = (preview: string) =>
  preview
    .slice(0, aiPreviewChars)
    .replace(/-----BEGIN [^-]+PRIVATE KEY-----[\s\S]*?-----END [^-]+PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_AWS_KEY]')
    .replace(/(password|token|secret)\s*=\s*["']?[^"'\s]+/gi, '$1=[REDACTED]');

const generateAiExplanation = async (scan: RuleScan, classification: TypeClassification, context: Record<string, unknown>) => {
  if (scan.riskLevel === 'safe' || !envConfig.fileScannerAiExplanationEnabled) return fallbackExplanation(scan, classification);
  if (Date.now() < aiExplainUnavailableUntil) return fallbackExplanation(scan, classification);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiExplainTimeoutMs);
  try {
    const response = await fetch(`${envConfig.crewaiApiUrl.replace(/\/$/, '')}/file-scanner/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ ...context, classification, ruleScan: scan, safePreview: sanitizePreviewForAi(String(context.preview || '')) }),
    });
    if (!response.ok) {
      if (response.status === 404) aiExplainUnavailableUntil = Date.now() + aiExplainRetryMs;
      throw new Error(`CrewAI file scanner explanation failed: ${response.status}`);
    }
    const payload = await response.json();
    return String(payload.aiExplanation || payload.explanation || payload.summary || '').trim() || fallbackExplanation(scan, classification);
  } catch (error) {
    logger.warn(`[FileScanner] AI explanation unavailable; using rule-based explanation. ${error instanceof Error ? error.message : String(error)}`);
    return fallbackExplanation(scan, classification);
  } finally {
    clearTimeout(timeout);
  }
};

const parseActionOutput = (stdout: string) => parseMetadata(stdout).kv;

const backupAndApplyAction = async (server: any, result: IFileScanResult) => {
  if (!['quarantine', 'delete'].includes(result.recommendedAction)) return result;

  // Defense in depth: even if a containment action reaches this point, never
  // destroy a legitimate project file / build artifact on heuristic-only signals.
  if (shouldWithholdAutomatedContainment(result.harmfulBehaviors, result.fileCategory, result.filePath, '')) {
    result.recommendedAction = 'review';
    result.actionStatus = 'none';
    result.quarantineStatus = 'none';
    result.actionError = 'Automated containment withheld: heuristic detection on a legitimate project source or build file. Manual review required.';
    await result.save();
    logger.warn(`[FileScanner] containment withheld server=${String(result.server)} file=${result.filePath}: heuristic-only detection on project/build file`);
    return result;
  }

  const confirmedMalicious = result.harmfulBehaviors.some((behavior) => maliciousBehaviors.has(behavior)) &&
    !(
      result.harmfulBehaviors.every((behavior) => behavior === 'credential_exposure') ||
      result.detectedPatterns.every((pattern) => ['credential-exposure', 'private-key-content'].includes(pattern))
    );
  if (!confirmedMalicious || !['high', 'critical'].includes(result.riskLevel)) {
    result.recommendedAction = result.riskLevel === 'medium' ? 'review' : 'allow';
    result.actionStatus = 'none';
    result.quarantineStatus = 'none';
    result.actionError = 'Containment skipped because malicious content was not confirmed.';
    await result.save();
    logger.warn(`[FileScanner] containment blocked server=${String(result.server)} file=${result.filePath}: malicious content not confirmed`);
    return result;
  }

  // Block auto-containment if a user previously marked this file path safe or restored it.
  // A changed file that was once cleared still requires human review, not silent re-deletion.
  const prevMarkedSafe = await FileScanResult.findOne({
    server: result.server,
    filePath: result.filePath,
    scanStatus: 'marked_safe',
    _id: { $ne: result._id },
  }).select('_id').lean();
  if (prevMarkedSafe) {
    result.recommendedAction = 'review';
    result.actionStatus = 'none';
    result.quarantineStatus = 'none';
    result.actionError = 'Auto-containment blocked: this file was previously marked safe by a user. Manual review required before any action.';
    await result.save();
    logger.warn(`[FileScanner] containment blocked server=${String(result.server)} file=${result.filePath}: previously marked safe by user`);
    return result;
  }

  const stamp = Date.now();
  const safeName = `${String(result._id)}-${path.posix.basename(result.filePath)}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const backupPath = `${normalizePath(envConfig.fileScannerBackupPath)}/${stamp}-${safeName}.tar.gz`;
  const quarantinePath = `${normalizePath(envConfig.fileScannerQuarantinePath)}/${stamp}-${safeName}`;
  const shouldDelete = result.recommendedAction === 'delete' && envConfig.fileScannerDeleteAfterBackup;
  const actionTimeoutMs = isLargeDiskFillCandidate(result.filePath, result.fileSize)
    ? Math.max(envConfig.fileScannerCommandTimeoutMs, 5 * 60 * 1000)
    : envConfig.fileScannerCommandTimeoutMs;
  const fallbackBackupPath = `/tmp/server-agent/file-scanner/backups/${stamp}-${safeName}.tar.gz`;
  const fallbackQuarantinePath = `/tmp/server-agent/file-scanner/quarantine/${stamp}-${safeName}`;
  const actionCommand = shouldDelete
    ? `rm -f -- "$src"\naction="delete_completed"`
    : `mv "$src" "$quarantine"\naction="quarantined"`;
  const quarantineSetup = shouldDelete
    ? `quarantine=""`
    : `
quarantine=${shellQuote(quarantinePath)}
fallback_quarantine=${shellQuote(fallbackQuarantinePath)}
mkdir -p "$(dirname "$quarantine")" 2>/dev/null || quarantine="$fallback_quarantine"
mkdir -p "$(dirname "$quarantine")"
`;
  const command = `
set -e
src=${shellQuote(result.filePath)}
backup=${shellQuote(backupPath)}
fallback_backup=${shellQuote(fallbackBackupPath)}
mkdir -p "$(dirname "$backup")" 2>/dev/null || backup="$fallback_backup"
mkdir -p "$(dirname "$backup")"
${quarantineSetup}
if [ "${envConfig.fileScannerCompressBackup ? 'true' : 'false'}" = "true" ]; then
  tar --sparse -czf "$backup" -C "$(dirname "$src")" "$(basename "$src")"
else
  cp -p "$src" "$backup"
fi
test -s "$backup"
backup_hash=$(sha256sum "$backup" | awk '{print $1}')
${actionCommand}
printf "backupHash=%s\\ncompressedBackupPath=%s\\nbackupPath=%s\\nquarantinePath=%s\\naction=%s\\n" "$backup_hash" "$backup" "$backup" "$quarantine" "$action"
`;

  try {
    const output = await sshService.executeNoRetry(server, command, actionTimeoutMs);
    if (output.code !== 0) {
      throw new Error(output.stderr.trim() || `Backup/action command failed with code ${output.code}.`);
    }
    const values = parseActionOutput(output.stdout);
    result.backupStatus = 'backup_completed';
    result.backupPath = values.backupPath || backupPath;
    result.compressedBackupPath = values.compressedBackupPath || backupPath;
    result.backupHash = values.backupHash;
    result.actionStatus = values.action === 'delete_completed' ? 'delete_completed' : 'quarantined';
    result.quarantineStatus = values.action === 'delete_completed' ? 'delete_completed' : 'quarantined';
    result.quarantinePath = values.action === 'delete_completed' ? undefined : (values.quarantinePath || quarantinePath);
    result.actionError = undefined;
    await result.save();

    await FileBackupHistory.create({
      server: result.server,
      scanResult: result._id,
      originalPath: result.filePath,
      backupPath: result.compressedBackupPath || result.backupPath || backupPath,
      originalHash: result.fileHash,
      backupHash: result.backupHash,
      status: 'completed',
      reason: 'Compressed backup created and verified before action.',
    });

    if (result.actionStatus === 'quarantined' && result.quarantinePath) {
      await QuarantinedFile.create({
        server: result.server,
        scanResult: result._id,
        originalPath: result.filePath,
        quarantinePath: result.quarantinePath,
        backupPath: result.compressedBackupPath || result.backupPath || backupPath,
        riskLevel: result.riskLevel,
        status: 'quarantined',
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Compressed backup/action failed.';
    logger.warn(`[FileScanner] containment failed server=${String(result.server)} file=${result.filePath}: ${message}`);
    result.backupStatus = 'failed';
    result.quarantineStatus = 'failed';
    result.actionStatus = 'failed';
    result.actionError = message;
    await result.save();
    await FileBackupHistory.create({
      server: result.server,
      scanResult: result._id,
      originalPath: result.filePath,
      backupPath,
      originalHash: result.fileHash,
      status: 'failed',
      reason: message,
    });
  }
  return result;
};

const createSecurityAlert = async (result: IFileScanResult) => {
  if (!['high', 'critical'].includes(result.riskLevel)) return;
  const recent = await SecurityAlert.findOne({
    server: result.server,
    filePath: result.filePath,
    riskLevel: result.riskLevel,
    createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
  }).select('_id').lean();
  if (recent) return;

  const message = `${result.riskLevel.toUpperCase()} file threat: ${result.filePath}. ${result.riskReasons[0] || 'Suspicious content detected.'}`;
  await SecurityAlert.create({
    server: result.server,
    scanResult: result._id,
    filePath: result.filePath,
    riskLevel: result.riskLevel,
    riskScore: result.riskScore,
    message,
    actionTaken: result.actionStatus,
    metadata: { actionError: result.actionError },
  });

  const existingAlert = await Alert.findOne({
    server: result.server,
    type: 'file_threat_detected',
    'metadata.scanResultId': String(result._id),
  }).select('_id').lean();
  if (!existingAlert) {
    await alertService.create({
      serverId: result.server,
      type: 'file_threat_detected',
      severity: result.riskLevel === 'critical' ? 'critical' : 'warning',
      title: 'File threat detected',
      message,
      metadata: {
        filePath: result.filePath,
        fileCategory: result.fileCategory,
        riskLevel: result.riskLevel,
        riskScore: result.riskScore,
        harmfulBehaviors: result.harmfulBehaviors,
        actionTaken: result.actionStatus,
        actionError: result.actionError,
        scanResultId: String(result._id),
      },
      email: false,
    });
  }
};

export const fileScannerService = {
  start() {
    logger.info(`[FileScanner] enabled=${envConfig.fileScannerEnabled} mode=${envConfig.fileScannerMode}`);
    if (!envConfig.fileScannerEnabled || scheduler) return;
    scheduler = setInterval(() => { void this.tick(); }, envConfig.fileScannerPollIntervalMs);
    void this.tick();
  },

  stop() {
    if (scheduler) clearInterval(scheduler);
    scheduler = null;
  },

  async tick() {
    if (!envConfig.fileScannerEnabled || inFlightScheduler) return;
    inFlightScheduler = true;
    try {
      const filter: Record<string, unknown> = { active: true, status: 'connected' };
      if (envConfig.fileScannerServerIds.length) filter._id = { $in: envConfig.fileScannerServerIds };
      const servers = await ServerConnection.find(filter).select('_id host status').lean();
      servers.forEach((server) => {
        const serverId = String(server._id);
        if (!isScannerServerAllowed(serverId) || isSshCooldownActive(serverId)) return;
        runQueuedScan(() => this.detectChanges(serverId, true));
      });
    } catch (error) {
      logger.error('Error running file scanner tick:', error);
    } finally {
      inFlightScheduler = false;
    }
  },

  async detectChanges(serverId: string, waitForScans = false) {
    const server = await ServerConnection.findById(serverId);
    if (!server || !server.active || server.status !== 'connected' || !isScannerServerAllowed(serverId) || isSshCooldownActive(serverId)) return;
    const now = Date.now();
    try {
      const result = await sshService.executeNoRetry(server, buildFindCommand(), envConfig.fileScannerCommandTimeoutMs);
      // if (result.stderr.trim()) logger.debug(`[FileScanner] root scan warnings server=${serverId}: ${result.stderr.trim().slice(0, 500)}`);
      lastSweepByServer.set(serverId, now);
      sshCooldownByServer.delete(serverId);
      const files = sortScanCandidates(parseDetectedFiles(result.stdout));
      const immediateScans: Array<Promise<unknown>> = [];
      for (const file of files) {
        if (shouldExcludePath(file.filePath)) {
          scanLog(serverId, file.filePath, 'Matched scanner allowlist/ignore rule.', 'ignored');
          continue;
        }
        if (file.fileSize > envConfig.fileScannerMaxFileSizeMb * 1024 * 1024 && !isLargeDiskFillCandidate(file.filePath, file.fileSize)) {
          scanLog(serverId, file.filePath, 'File exceeds scanner size limit and has no large-file threat signal.', 'ignored');
          continue;
        }
        const previous = await FileScanResult.findOne({ server: server._id, filePath: file.filePath })
          .sort({ createdAt: -1 })
          .select('fileSize modifiedAt actionStatus backupStatus quarantineStatus riskLevel')
          .lean();
        const previousModifiedAt = previous?.modifiedAt ? new Date(previous.modifiedAt).getTime() : 0;
        const shouldRetryFailedContainment =
          previous &&
          ['high', 'critical'].includes(String(previous.riskLevel)) &&
          (previous.actionStatus === 'failed' || previous.backupStatus === 'failed' || previous.quarantineStatus === 'failed');
        if (
          previous &&
          !shouldRetryFailedContainment &&
          previous.fileSize === file.fileSize &&
          Math.floor(previousModifiedAt / 1000) === Math.floor(file.modifiedAt.getTime() / 1000)
        ) {
          continue;
        }
        const key = `${serverId}:${file.filePath}`;
        const last = debounceByFile.get(key) || 0;
        if (now - last < envConfig.fileScannerDebounceMs) continue;
        debounceByFile.set(key, now);
        if (waitForScans) {
          immediateScans.push(this.scanFile(serverId, file.filePath, file.modifiedAt));
          if (immediateScans.length >= envConfig.fileScannerMaxConcurrentScans) break;
        } else {
          runQueuedScan(async () => {
            await this.scanFile(serverId, file.filePath, file.modifiedAt);
          });
        }
      }
      if (immediateScans.length) await Promise.allSettled(immediateScans);
    } catch (error) {
      setSshCooldown(serverId, error);
    }
  },

  async scanNow(serverId: string) {
    sshCooldownByServer.delete(serverId);
    await this.detectChanges(serverId, true);
    return this.status(serverId);
  },

  async scanFile(serverId: string, filePath: string, detectedModifiedAt?: Date) {
    const server = await ServerConnection.findById(serverId);
    if (!server || server.status !== 'connected' || isSshCooldownActive(serverId)) return null;
    if (shouldExcludePath(filePath)) {
      scanLog(serverId, filePath, 'Matched scanner allowlist/ignore rule.', 'ignored');
      return null;
    }
    const previous = await FileScanResult.findOne({ server: server._id, filePath }).sort({ createdAt: -1 }).lean();
    const eventType = previous ? 'modified' : 'created';
    const event = await FileScanEvent.create({
      server: server._id,
      filePath,
      fileName: path.posix.basename(filePath),
      eventType,
      modifiedAt: detectedModifiedAt,
      scanStatus: 'scanning',
      metadata: { watcher: 'server-wide-ssh-find', mode: envConfig.fileScannerMode },
    });

    try {
      const metadata = parseMetadata((await sshService.executeNoRetry(
        server,
        metadataCommand(filePath, envConfig.fileScannerMaxFileSizeMb * 1024 * 1024),
        envConfig.fileScannerCommandTimeoutMs,
      )).stdout);
      const size = Number(metadata.kv.size) || 0;
      const classification = classifyFile(filePath, metadata.kv.mime || '', metadata.kv.type || '', metadata.preview || '');
      const ruleScan = scanRules(filePath, metadata.preview || '', classification, size);
      const { confirmedMalicious, ...persistedRuleScan } = ruleScan;
      const aiExplanation = await generateAiExplanation(ruleScan, classification, {
        filePath,
        fileName: path.posix.basename(filePath),
        mimeType: metadata.kv.mime,
        detectedFileType: metadata.kv.type,
        fileSize: size,
        preview: metadata.preview || '',
      });

      const result = await FileScanResult.create({
        event: event._id,
        server: server._id,
        filePath,
        fileName: path.posix.basename(filePath),
        extension: path.posix.extname(filePath).toLowerCase(),
        detectedFileType: metadata.kv.type,
        fileCategory: classification.fileCategory,
        typeConfidence: classification.typeConfidence,
        typeSignals: classification.typeSignals,
        mimeType: metadata.kv.mime,
        fileSize: size,
        fileHash: metadata.kv.hash,
        modifiedAt: metadata.kv.mtime ? new Date(Number(metadata.kv.mtime) * 1000) : detectedModifiedAt,
        permissions: metadata.kv.perm,
        owner: metadata.kv.owner,
        eventType,
        scanStatus: 'completed',
        ...persistedRuleScan,
        aiExplanation,
        backupStatus: 'none',
        quarantineStatus: 'none',
        actionStatus: 'none',
      });

      const reason = ruleScan.riskReasons.join(' ');
      scanLog(
        serverId,
        filePath,
        confirmedMalicious ? reason : `${reason} Malicious content confirmation=${confirmedMalicious}.`,
        ruleScan.recommendedAction,
      );

      event.fileHash = result.fileHash;
      event.scanStatus = 'completed';
      await event.save();
      await backupAndApplyAction(server, result);
      scanLog(serverId, filePath, result.riskReasons.join(' '), result.actionStatus === 'none' ? result.recommendedAction : result.actionStatus);
      await createSecurityAlert(result);
      return result;
    } catch (error) {
      event.scanStatus = 'failed';
      event.metadata = { error: error instanceof Error ? error.message : String(error), mode: envConfig.fileScannerMode };
      await event.save();
      logger.warn(`[FileScanner] scan failed server=${serverId} file=${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  },

  status(serverId?: string) {
    return {
      enabled: envConfig.fileScannerEnabled,
      mode: envConfig.fileScannerMode,
      serverId,
      watchedRoots: scannerRoots(),
      excludedPaths: scannerExclusions(),
      maxFileSizeMb: envConfig.fileScannerMaxFileSizeMb,
      largeFileThreatMb: envConfig.fileScannerLargeFileThreatMb,
      compressedBackup: envConfig.fileScannerCompressBackup,
      backupPath: envConfig.fileScannerBackupPath,
      quarantinePath: envConfig.fileScannerQuarantinePath,
      actionOnHarmful: envConfig.fileScannerActionOnHarmful,
      deleteAfterBackup: envConfig.fileScannerDeleteAfterBackup,
      debounceMs: envConfig.fileScannerDebounceMs,
      maxConcurrentScans: envConfig.fileScannerMaxConcurrentScans,
      maxFilesPerSweep: envConfig.fileScannerMaxFilesPerSweep,
      sshCooldownActive: serverId ? isSshCooldownActive(serverId) : false,
      note: 'Server-wide monitoring excludes system/noisy paths for safety and performance.',
    };
  },

  buildListFilter(query: QueryInput) {
    const { start, end } = resolveWindow(query);
    const filter: Record<string, unknown> = { createdAt: { $gte: start, $lte: end } };
    if (query.serverId) filter.server = new Types.ObjectId(query.serverId);
    if (query.riskLevel) filter.riskLevel = query.riskLevel;
    if (query.scanStatus) filter.scanStatus = query.scanStatus;
    return filter;
  },

  async listResults(query: QueryInput) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 200);
    const filter = this.buildListFilter(query);
    const [items, total] = await Promise.all([
      FileScanResult.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      FileScanResult.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async listEvents(query: QueryInput) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 200);
    const { start, end } = resolveWindow(query);
    const filter: Record<string, unknown> = { createdAt: { $gte: start, $lte: end } };
    if (query.serverId) filter.server = new Types.ObjectId(query.serverId);
    if (query.scanStatus) filter.scanStatus = query.scanStatus;
    const [items, total] = await Promise.all([
      FileScanEvent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      FileScanEvent.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async listAlerts(query: QueryInput) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 200);
    const { start, end } = resolveWindow(query);
    const filter: Record<string, unknown> = { createdAt: { $gte: start, $lte: end } };
    if (query.serverId) filter.server = new Types.ObjectId(query.serverId);
    if (query.riskLevel) filter.riskLevel = query.riskLevel;
    const [items, total] = await Promise.all([
      SecurityAlert.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      SecurityAlert.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  },

  async listQuarantine(query: QueryInput) {
    const filter: Record<string, unknown> = {};
    if (query.serverId) filter.server = new Types.ObjectId(query.serverId);
    if (query.riskLevel) filter.riskLevel = query.riskLevel;
    return QuarantinedFile.find(filter).sort({ createdAt: -1 }).limit(Math.min(Number(query.limit) || 50, 200));
  },

  getResult(id: string) {
    return FileScanResult.findById(id);
  },

  async restore(id: string) {
    // --- Validation: prevent invalid restore requests with clear, actionable errors ---
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid scan result id for restore: "${id}".`);
    }
    const result = await FileScanResult.findById(id);
    if (!result) {
      throw new Error(`Scan result not found for restore (id=${id}).`);
    }
    const backupPath = result.compressedBackupPath || result.backupPath;
    if (!backupPath) {
      throw new Error(`No backup is available to restore this file (id=${id}, path=${result.filePath}).`);
    }
    const server = await ServerConnection.findById(result.server);
    if (!server) {
      throw new Error(`Server connection not found for restore (id=${id}, server=${String(result.server)}).`);
    }

    const targetPath = result.filePath;
    const originalHash = result.fileHash;
    // Best-effort restoration of the original permissions/ownership captured at scan time.
    const originalPerm = result.permissions ? String(result.permissions).trim() : '';
    const originalOwner = result.owner ? String(result.owner).trim() : '';

    logger.info(
      `[FileScanner] restore requested server=${String(result.server)} id=${id} source=${backupPath} target=${targetPath}`,
    );

    const command = `
set -e
backup=${shellQuote(backupPath)}
target=${shellQuote(targetPath)}
perm=${shellQuote(originalPerm)}
owner=${shellQuote(originalOwner)}
tmp_dir=$(mktemp -d /tmp/file-scanner-restore.XXXXXX)
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT
if [ ! -s "$backup" ]; then echo "backup file is missing or empty on server: $backup" >&2; exit 11; fi
mkdir -p "$(dirname "$target")" 2>/dev/null || { echo "unable to create destination directory: $(dirname "$target")" >&2; exit 12; }
if tar -tzf "$backup" >/dev/null 2>&1; then
  tar -xzf "$backup" -C "$tmp_dir"
  restored_file="$tmp_dir/$(basename "$target")"
  if [ ! -f "$restored_file" ]; then
    restored_file=$(find "$tmp_dir" -type f | head -n 1)
  fi
  if [ -z "$restored_file" ] || [ ! -f "$restored_file" ]; then echo "no file found inside backup archive: $backup" >&2; exit 13; fi
  cp -p "$restored_file" "$target" 2>/dev/null || { echo "failed to write restored file to destination: $target" >&2; exit 14; }
else
  cp -p "$backup" "$target" 2>/dev/null || { echo "failed to write backup to destination: $target" >&2; exit 14; }
fi
if [ ! -s "$target" ]; then echo "restored file is missing or empty at destination: $target" >&2; exit 15; fi
if [ -n "$perm" ]; then chmod "$perm" "$target" 2>/dev/null || true; fi
if [ -n "$owner" ]; then chown "$owner" "$target" 2>/dev/null || true; fi
restored_hash=$(sha256sum "$target" | awk '{print $1}')
restored_size=$(stat -c %s "$target" 2>/dev/null)
restored_mtime=$(stat -c %Y "$target" 2>/dev/null)
printf "restoredHash=%s\\nrestoredSize=%s\\nrestoredMtime=%s\\n" "$restored_hash" "$restored_size" "$restored_mtime"
`;

    let output;
    try {
      output = await sshService.executeNoRetry(server, command, envConfig.fileScannerCommandTimeoutMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `[FileScanner] restore SSH failure server=${String(result.server)} id=${id} source=${backupPath} target=${targetPath}: ${message}`,
      );
      await FileBackupHistory.create({
        server: result.server,
        scanResult: result._id,
        originalPath: targetPath,
        backupPath,
        originalHash,
        status: 'failed',
        reason: `Restore failed before completion: ${message}`,
      });
      throw new Error(`Restore failed to reach the server: ${message}`);
    }

    if (output.code !== 0) {
      const detail = output.stderr.trim() || `Restore command failed with code ${output.code}.`;
      logger.error(
        `[FileScanner] restore command failed server=${String(result.server)} id=${id} source=${backupPath} target=${targetPath} code=${output.code} stderr="${detail}"`,
      );
      await FileBackupHistory.create({
        server: result.server,
        scanResult: result._id,
        originalPath: targetPath,
        backupPath,
        originalHash,
        status: 'failed',
        reason: detail,
      });
      throw new Error(`Restore failed: ${detail}`);
    }

    const restored = parseActionOutput(output.stdout);
    const fullHashWasCaptured = result.fileSize <= envConfig.fileScannerMaxFileSizeMb * 1024 * 1024;
    if (fullHashWasCaptured && originalHash && restored.restoredHash && restored.restoredHash !== originalHash) {
      const message = `Restore verification failed: restored hash ${restored.restoredHash} does not match original scan hash ${originalHash}.`;
      logger.error(`[FileScanner] ${message} server=${String(result.server)} id=${id} target=${targetPath}`);
      await FileBackupHistory.create({
        server: result.server,
        scanResult: result._id,
        originalPath: targetPath,
        backupPath,
        originalHash,
        backupHash: restored.restoredHash,
        status: 'failed',
        reason: message,
      });
      throw new Error(message);
    }

    result.fileHash = restored.restoredHash || result.fileHash;
    result.fileSize = Number(restored.restoredSize) || result.fileSize;
    result.modifiedAt = restored.restoredMtime ? new Date(Number(restored.restoredMtime) * 1000) : result.modifiedAt;
    result.riskLevel = 'safe';
    result.riskScore = 0;
    result.riskReasons = ['File restored from verified backup and marked safe by user action.'];
    result.detectedPatterns = [];
    result.harmfulBehaviors = [];
    result.recommendedAction = 'allow';
    result.scanStatus = 'marked_safe';
    result.markedSafeAt = new Date();
    result.actionStatus = 'restore_completed';
    result.quarantineStatus = 'restore_completed';
    result.actionError = undefined;
    result.updatedAt = new Date();
    await result.save();
    await QuarantinedFile.updateMany({ scanResult: result._id }, { $set: { status: 'restored', restoredAt: new Date() } });
    // Persist an audit trail entry for the successful restore action.
    await FileBackupHistory.create({
      server: result.server,
      scanResult: result._id,
      originalPath: targetPath,
      backupPath,
      originalHash,
      backupHash: restored.restoredHash,
      status: 'completed',
      reason: 'File restored to original path from verified backup and marked safe by user action.',
    });
    logger.info(
      `[FileScanner] restore completed server=${String(result.server)} id=${id} target=${targetPath} size=${result.fileSize} hash=${result.fileHash}`,
    );
    scanLog(String(result.server), result.filePath, 'Verified backup restored to original path and marked safe by user action.', 'restore_completed');
    return result;
  },

  async markSafe(id: string) {
    const result = await FileScanResult.findById(id);
    if (!result) throw new Error('Scan result not found.');
    result.riskLevel = 'safe';
    result.riskScore = 0;
    result.recommendedAction = 'allow';
    result.scanStatus = 'marked_safe';
    result.markedSafeAt = new Date();
    result.updatedAt = new Date();
    await result.save();
    return result;
  },

  async permanentDelete(id: string) {
    const result = await FileScanResult.findById(id);
    if (!result?.quarantinePath) throw new Error('Only quarantined files can be permanently deleted.');
    const server = await ServerConnection.findById(result.server);
    if (!server) throw new Error('Server not found.');
    const backupPath = result.compressedBackupPath || result.backupPath;
    if (!backupPath) throw new Error('Permanent delete blocked because backup is missing.');
    await sshService.executeNoRetry(server, `set -e\ntest -s ${shellQuote(backupPath)}\nrm -f -- ${shellQuote(result.quarantinePath)}`, envConfig.fileScannerCommandTimeoutMs);
    result.actionStatus = 'delete_completed';
    result.updatedAt = new Date();
    await result.save();
    await QuarantinedFile.updateMany({ scanResult: result._id }, { $set: { status: 'deleted', deletedAt: new Date() } });
    return result;
  },
};
