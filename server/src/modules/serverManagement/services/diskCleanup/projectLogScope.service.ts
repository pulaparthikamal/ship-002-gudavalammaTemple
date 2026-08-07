import { HTTP_STATUS } from '../../../../constants/httpStatus.constants';
import { AppError } from '../../../../utils/error.util';
import { IServerConnection } from '../../models/serverConnection.model';
import { shellQuote } from '../../utils/shell.util';
import { serverProjectService } from '../serverProject.service';
import { sshService } from '../ssh.service';
import { normalizeCleanupPath } from './cleanupPolicy.service';

export interface ProjectLogScope {
  domainName: string;
  nginxConfigPath: string;
  projectRoot: string;
  logRoots: string[];
  nginxLogFiles: string[];
  allowlistedPaths: string[];
  serverNames: string[];
  rootCandidates: string[];
}

export interface ProjectLogIssue {
  filePath: string;
  issueType: 'ERROR' | 'CRASH' | 'HIGH_MEMORY' | 'SUSPICIOUS';
  message: string;
}

export interface ProjectLogFile {
  filePath: string;
  fileSizeBytes: number;
  modifiedAt: Date;
  source: 'PROJECT' | 'NGINX';
}

const domainPattern = /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;
const normalizeDomain = (domainName: string) =>
  domainName
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .trim()
    .split(/\s+/)[0]
    .replace(/:\d+$/, '')
    .trim();

const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const validateScopeScript = (projectRoot: string, nginxFile: string) => `
set -e
project_root=${shellQuote(projectRoot)}
nginx_file=${shellQuote(nginxFile)}
python3 - "$project_root" "$nginx_file" <<'PY'
import json
import os
import re
import sys

project_root = sys.argv[1].rstrip("/")
nginx_file = sys.argv[2].rstrip("/")

def clean_path(value):
  return value.strip().strip('"\\'').rstrip("/")

log_roots = []
for candidate in [
  project_root + "/logs",
  project_root + "/log",
  project_root + "/storage/logs",
  project_root + "/var/log",
]:
  if os.path.isdir(candidate):
    log_roots.append(candidate)

if not log_roots and os.path.isdir(project_root):
  log_roots.append(project_root)

nginx_logs = []
if nginx_file and os.path.isfile(nginx_file):
  try:
    with open(nginx_file, "r", encoding="utf-8", errors="ignore") as handle:
      content = handle.read()
    for name in ["access_log", "error_log"]:
      for match in re.finditer(r"(?m)^\\s*" + name + r"\\s+([^;]+);", content):
        value = match.group(1).strip().split()[0]
        if value.lower() != "off" and value.startswith("/") and os.path.isfile(value):
          nginx_logs.append(clean_path(value))
  except Exception:
    pass

print(json.dumps({
  "projectRootExists": os.path.isdir(project_root),
  "logRoots": list(dict.fromkeys(log_roots)),
  "nginxLogFiles": list(dict.fromkeys(nginx_logs)),
}))
PY
`;

const parseIssueRows = (stdout: string): ProjectLogIssue[] =>
  stdout
    .split('\n')
    .filter(Boolean)
    .map((line): ProjectLogIssue | undefined => {
      const [filePath, issueType, ...messageParts] = line.split('\t');
      if (!filePath || !issueType) return undefined;
      return {
        filePath,
        issueType: issueType as ProjectLogIssue['issueType'],
        message: messageParts.join('\t').slice(0, 800),
      };
    })
    .filter((item): item is ProjectLogIssue => Boolean(item));

const parseLogFileRows = (stdout: string): ProjectLogFile[] =>
  stdout
    .split('\n')
    .filter(Boolean)
    .map((line): ProjectLogFile | undefined => {
      const [filePath, sizeRaw, modifiedRaw, sourceRaw] = line.split('\t');
      if (!filePath) return undefined;
      return {
        filePath,
        fileSizeBytes: Number(sizeRaw) || 0,
        modifiedAt: new Date((Number(modifiedRaw) || 0) * 1000),
        source: sourceRaw === 'NGINX' ? 'NGINX' : 'PROJECT',
      };
    })
    .filter((item): item is ProjectLogFile => Boolean(item));

export const projectLogScopeService = {
  normalizeDomain,

  async resolve(server: IServerConnection, domainInput: string): Promise<ProjectLogScope> {
    const domainName = normalizeDomain(domainInput);
    if (!domainPattern.test(domainName)) {
      throw new AppError('A valid domain name is required for project-level log monitoring.', HTTP_STATUS.BAD_REQUEST);
    }

    const discovered = await serverProjectService.discover(server);
    const project = discovered.find((item) => projectLogScopeService.normalizeDomain(item.projectName) === domainName);
    if (!project) {
      throw new AppError('Domain not found in project discovery output from Nginx configuration.', HTTP_STATUS.NOT_FOUND);
    }
    if (!project.projectPath) {
      throw new AppError('Project path is missing from remote project discovery output.', HTTP_STATUS.BAD_REQUEST);
    }
    if (!project.nginxFile) {
      throw new AppError('Nginx file is missing from remote project discovery output.', HTTP_STATUS.BAD_REQUEST);
    }

    const projectRoot = normalizeCleanupPath(project.projectPath);
    const nginxConfigPath = normalizeCleanupPath(project.nginxFile);
    const result = await sshService.execute(server, validateScopeScript(projectRoot, nginxConfigPath), 60000);
    if (result.code !== 0) {
      throw new AppError(result.stderr || 'Unable to validate project log scope on the selected server.', HTTP_STATUS.BAD_REQUEST);
    }

    const payload = JSON.parse(result.stdout.trim() || '{}');
    if (!payload.projectRootExists) {
      throw new AppError('Project path from discovery does not exist or is not accessible.', HTTP_STATUS.NOT_FOUND);
    }

    const logRoots = unique((payload.logRoots || []).map(normalizeCleanupPath));
    const nginxLogFiles = unique((payload.nginxLogFiles || []).map(normalizeCleanupPath));
    if (!logRoots.length && !nginxLogFiles.length) {
      throw new AppError('No project log path was found for this domain.', HTTP_STATUS.NOT_FOUND);
    }

    return {
      domainName,
      nginxConfigPath,
      projectRoot,
      logRoots,
      nginxLogFiles,
      allowlistedPaths: unique([projectRoot, ...logRoots, ...nginxLogFiles]),
      serverNames: [project.projectName],
      rootCandidates: unique([projectRoot, project.configFile].filter(Boolean)),
    };
  },

  async scanIssues(server: IServerConnection, scope: ProjectLogScope): Promise<ProjectLogIssue[]> {
    const roots = scope.logRoots.map(shellQuote).join(' ');
    const files = scope.nginxLogFiles.map(shellQuote).join(' ');
    const command = [
      'set +e',
      'scan_file() {',
      '  f="$1"',
      '  [ -f "$f" ] || return 0',
      '  tail -n 1500 "$f" 2>/dev/null | awk -v file="$f" \'BEGIN{IGNORECASE=1} /fatal|uncaught|exception|crash|segmentation fault|out of memory|heap out of memory|ENOMEM|memory leak|eval\\(|base64_decode|\\.env|wp-login|phpmyadmin|\\.git|shell_exec|passwd|permission denied|error|failed/ { type="ERROR"; if ($0 ~ /crash|fatal|uncaught|segmentation fault/) type="CRASH"; if ($0 ~ /out of memory|heap out of memory|ENOMEM|memory leak/) type="HIGH_MEMORY"; if ($0 ~ /eval\\(|base64_decode|\\.env|wp-login|phpmyadmin|\\.git|shell_exec|passwd/) type="SUSPICIOUS"; gsub(/\\t/, " ", $0); print file "\\t" type "\\t" $0 }\' | tail -n 30',
      '}',
      `for root in ${roots}; do`,
      '  [ -d "$root" ] || continue',
      '  find "$root" -type f \\( -name "*.log" -o -name "*.out" -o -name "*.err" -o -name "*log*" \\) -size -200M -print 2>/dev/null | head -n 40 | while IFS= read -r f; do scan_file "$f"; done',
      'done',
      `for f in ${files}; do scan_file "$f"; done`,
    ].join('\n');
    const result = await sshService.execute(server, command, 60000);
    return parseIssueRows(result.stdout);
  },

  async listLogFiles(server: IServerConnection, scope: ProjectLogScope): Promise<ProjectLogFile[]> {
    const roots = scope.logRoots.map(shellQuote).join(' ');
    const files = scope.nginxLogFiles.map(shellQuote).join(' ');
    const command = [
      'set +e',
      `for root in ${roots}; do`,
      '  [ -d "$root" ] || continue',
      '  find "$root" -type f \\( -name "*.log" -o -name "*.out" -o -name "*.err" -o -name "*log*" \\) -printf "%p\\t%s\\t%T@\\tPROJECT\\n" 2>/dev/null | sort -t "$(printf "\\t")" -k3,3nr | head -n 200',
      'done',
      `for f in ${files}; do`,
      '  [ -f "$f" ] || continue',
      '  find "$f" -maxdepth 0 -type f -printf "%p\\t%s\\t%T@\\tNGINX\\n" 2>/dev/null',
      'done',
    ].join('\n');
    const result = await sshService.execute(server, command, 60000);
    const seen = new Set<string>();
    return parseLogFileRows(result.stdout).filter((file) => {
      if (seen.has(file.filePath)) return false;
      seen.add(file.filePath);
      return true;
    });
  },
};
