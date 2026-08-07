import { logger } from '../../../../utils/logger.util';
import { IMetricsHistory, IFilesystemUsageSnapshot, IProcessHealthSnapshot } from '../../models/metricsHistory.model';
import { IServerConnection } from '../../models/serverConnection.model';
import { sshService } from '../ssh.service';

export interface RawOsMetricSnapshot {
  os: IMetricsHistory['os'];
  cpuCoreCount: number;
  loadAverage: number;
  memoryUsagePercent: number;
  memoryUsedBytes: number;
  memoryFreeBytes: number;
  memoryCachedBytes: number;
  swapUsagePercent: number;
  diskUsagePercent: number;
  filesystems: IFilesystemUsageSnapshot[];
  serviceSummary: IMetricsHistory['serviceSummary'];
  processSummary: IMetricsHistory['processSummary'];
  sshSessionActivity: IMetricsHistory['sshSessionActivity'];
  networkErrors: number;
  networkDroppedPackets: number;
  rawCounters: IMetricsHistory['rawCounters'];
}

type CollectorName = 'core' | 'disk' | 'services' | 'processes' | 'auth' | 'networkConnections';
type PreviousMetricSnapshot = Pick<
  IMetricsHistory,
  | 'os'
  | 'filesystems'
  | 'serviceSummary'
  | 'processSummary'
  | 'sshSessionActivity'
  | 'rawCounters'
  | 'cpuUsagePercent'
  | 'memoryUsagePercent'
> | null;

export interface OsMetricCollectorOptions {
  previousMetric?: PreviousMetricSnapshot;
  diskIntervalMs: number;
  processIntervalMs: number;
  serviceIntervalMs: number;
  sshIntervalMs: number;
  networkScanIntervalMs: number;
  commandTimeoutMs: number;
  coreOnly: boolean;
  enableProcessScan: boolean;
  enableServiceScan: boolean;
  enableAuthScan: boolean;
  enableNetworkScan: boolean;
}

interface CollectorImpact {
  collector: CollectorName;
  commandName: string;
  durationMs: number;
  enabled: boolean;
  skippedReason?: string;
  impact: 'very-low' | 'low' | 'medium' | 'medium-high';
  collectedAt: Date;
}

const collectorImpactLog: CollectorImpact[] = [];
const commandExecutedAtByServer = new Map<string, number[]>();

const coreCommand = String.raw`
set +e
echo "__SECTION__ os"
printf "hostname=%s\n" "$(cat /proc/sys/kernel/hostname 2>/dev/null)"
printf "kernel=%s\n" "$(cat /proc/sys/kernel/osrelease 2>/dev/null)"
if [ -r /etc/os-release ]; then
  . /etc/os-release
  printf "id=%s\n" "\${ID:-linux}"
  printf "name=%s\n" "\${PRETTY_NAME:-Linux}"
  printf "version=%s\n" "\${VERSION_ID:-}"
else
  printf "id=linux\nname=Linux\nversion=\n"
fi
echo "systemdAvailable=false"
echo "journaldAvailable=false"

echo "__SECTION__ cpu"
awk '/^cpu / { idle=$5+$6; total=0; for (i=2;i<=NF;i++) total+=$i; printf "total=%s\nidle=%s\n", total, idle }' /proc/stat 2>/dev/null
awk '{print "loadAverage="$1}' /proc/loadavg 2>/dev/null
if command -v nproc >/dev/null 2>&1; then nproc | awk '{print "coreCount="$1}'; else grep -c '^processor' /proc/cpuinfo 2>/dev/null | awk '{print "coreCount="$1}'; fi

echo "__SECTION__ memory"
awk '
  /^MemTotal:/ { mt=$2 }
  /^MemAvailable:/ { ma=$2 }
  /^SwapTotal:/ { st=$2 }
  /^SwapFree:/ { sf=$2 }
  /^Cached:/ { mc=$2 }
  /^Buffers:/ { mb=$2 }
  END {
    mem=(mt>0)?((mt-ma)/mt)*100:0;
    swap=(st>0)?((st-sf)/st)*100:0;
    printf "memoryUsagePercent=%.2f\nswapUsagePercent=%.2f\n", mem, swap;
    printf "memoryUsedBytes=%.0f\nmemoryFreeBytes=%.0f\n", (mt-ma)*1024, ma*1024;
    printf "memoryCachedBytes=%.0f\n", (mc+mb)*1024;
  }
' /proc/meminfo 2>/dev/null

echo "__SECTION__ diskstats"
awk '
  $3 !~ /^(loop|ram|fd|sr)/ {
    read+=$6;
    write+=$10;
  }
  END { printf "readSectors=%s\nwriteSectors=%s\n", read+0, write+0 }
' /proc/diskstats 2>/dev/null

echo "__SECTION__ netdev"
awk 'NR>2 {
  sub(/:/, " ");
  if ($1 != "lo") { rx+=$2; tx+=$10; errors+=$4+$12; dropped+=$5+$13 }
} END { printf "rxBytes=%s\ntxBytes=%s\nerrors=%s\ndropped=%s\n", rx+0, tx+0, errors+0, dropped+0 }' /proc/net/dev 2>/dev/null

`;

const diskCommand = String.raw`
set +e
echo "__SECTION__ filesystems"
df -P -B1 -x tmpfs -x devtmpfs -x squashfs -x overlay 2>/dev/null | awk 'NR>1 && $2 > 0 { gsub("%","",$5); printf "%s|%s|%s|%s|%s\n", $1, $6, $3, $2, $5 }'
`;

const serviceCommand = String.raw`
set +e
echo "__SECTION__ services"
if command -v systemctl >/dev/null 2>&1; then
  failed=$(systemctl list-units --type=service --state=failed --no-legend --no-pager 2>/dev/null | wc -l | tr -d " ")
  running=$(systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | wc -l | tr -d " ")
  inactive=$(systemctl list-units --type=service --state=inactive --no-legend --no-pager 2>/dev/null | wc -l | tr -d " ")
  printf "running=%s\nfailed=%s\ninactive=%s\n" "$running" "$failed" "$inactive"
  systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null | awk '{name = ($1 == "●" ? $2 : $1); if (name != "") print "runningService="name}' | head -n 200
  systemctl list-units --type=service --state=inactive --all --no-legend --no-pager 2>/dev/null | awk '{name = ($1 == "●" ? $2 : $1); if (name != "") print "inactiveService="name}' | head -n 200
  systemctl list-units --type=service --state=activating --no-legend --no-pager 2>/dev/null | awk '{name = ($1 == "●" ? $2 : $1); if (name != "") print "inactiveService="name}' | head -n 100
  systemctl list-units --type=service --state=failed --no-legend --no-pager 2>/dev/null | awk '{name = ($1 == "●" ? $2 : $1); if (name != "") print "serviceIssue="name"|systemd|failed|service crashed"}' | head -n 25
else
  printf "running=0\nfailed=0\ninactive=0\n"
fi
if command -v docker >/dev/null 2>&1; then
  docker ps -a --filter "status=exited" --format "serviceIssue=docker:{{.Names}}|docker|exited|container stopped or exited" 2>/dev/null | head -n 25
  docker ps --filter "health=unhealthy" --format "serviceIssue=docker:{{.Names}}|docker|unhealthy|container health check is unhealthy" 2>/dev/null | head -n 25
fi
if command -v pm2 >/dev/null 2>&1; then
  pm2 jlist 2>/dev/null | tr '{' '\n' | awk -F'"' '/"name":/ && /"status":"(stopped|errored|stopping)"/ { name=""; status="unknown"; for(i=1;i<=NF;i++){ if($i=="name") name=$(i+2); if($i=="status") status=$(i+2); } if(name!="") print "serviceIssue=pm2:"name"|pm2|"status"|pm2 process is "status }' | head -n 25
fi
`;

const processCommand = String.raw`
set +e
echo "__SECTION__ processes"
ps -eo pid,ppid,stat,pcpu,pmem,comm --no-headers 2>/dev/null | awk '
  {
    total++;
    if ($3 ~ /Z/) zombies++;
    if ($3 ~ /D/) blocked++;
  }
  END { printf "total=%s\nzombies=%s\nblocked=%s\n", total+0, zombies+0, blocked+0 }
'
ps -eo pid,ppid,stat,pcpu,pmem,comm --sort=-pcpu --no-headers 2>/dev/null | head -n 8 | awk '{ printf "top=%s|%s|%s|%s|%s|%s\n", $1, $2, $3, $4, $5, $6 }'
`;

const sshCommand = String.raw`
set +e
echo "__SECTION__ ssh"
who 2>/dev/null | wc -l | awk '{print "loggedInUsers="$1}'
if command -v journalctl >/dev/null 2>&1; then
  timeout 1s journalctl -u ssh -u sshd --since "-2 min" -p warning --no-pager 2>/dev/null | wc -l | awk '{print "recentAuthWarnings="$1}'
else
  printf "recentAuthWarnings=0\n"
fi
`;

const networkConnectionCommand = String.raw`
set +e
echo "__SECTION__ ssh"
if command -v ss >/dev/null 2>&1; then
  ss -Htn state established '( sport = :22 or dport = :22 )' 2>/dev/null | wc -l | awk '{print "establishedSessions="$1}'
else
  printf "establishedSessions=0\n"
fi
`;

const collectorMeta: Record<CollectorName, { command: string; impact: 'very-low' | 'low' | 'medium' | 'medium-high' }> = {
  core: { command: coreCommand, impact: 'very-low' },
  disk: { command: diskCommand, impact: 'low' },
  services: { command: serviceCommand, impact: 'medium' },
  processes: { command: processCommand, impact: 'medium' },
  auth: { command: sshCommand, impact: 'medium-high' },
  networkConnections: { command: networkConnectionCommand, impact: 'medium-high' },
};

const lastRunByServer = new Map<string, Partial<Record<CollectorName, number>>>();

const toNumber = (value: string | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number(value.toFixed(2))));

const parseKeyValues = (lines: string[]) =>
  lines.reduce<Record<string, string[]>>((acc, line) => {
    const separator = line.indexOf('=');
    if (separator <= 0) {
      return acc;
    }

    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    acc[key] = [...(acc[key] || []), value];
    return acc;
  }, {});

const splitSections = (stdout: string) =>
  stdout.split('\n').reduce<Record<string, string[]>>((acc, rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return acc;
    }

    if (line.startsWith('__SECTION__ ')) {
      acc.__current = [line.replace('__SECTION__ ', '')];
      acc[acc.__current[0]] = [];
      return acc;
    }

    const current = acc.__current?.[0];
    if (current) {
      acc[current].push(line);
    }
    return acc;
  }, {});

const parseFilesystems = (lines: string[]): IFilesystemUsageSnapshot[] =>
  lines
    .map((line) => {
      const [filesystem, mount, usedBytes, totalBytes, usagePercent] = line.split('|');
      if (!filesystem || !mount) {
        return undefined;
      }

      return {
        filesystem,
        mount,
        usedBytes: toNumber(usedBytes),
        totalBytes: toNumber(totalBytes),
        usagePercent: clampPercent(toNumber(usagePercent)),
      };
    })
    .filter((item): item is IFilesystemUsageSnapshot => Boolean(item));

const parseTopProcesses = (values: Record<string, string[]>): IProcessHealthSnapshot[] =>
  (values.top || [])
    .map((line): IProcessHealthSnapshot | undefined => {
      const [pid, ppid, state, cpuPercent, memoryPercent, name] = line.split('|');
      if (!pid || !name) {
        return undefined;
      }

      return {
        pid,
        ppid: ppid || undefined,
        state: state || '',
        cpuPercent: toNumber(cpuPercent),
        memoryPercent: toNumber(memoryPercent),
        name,
      };
    })
    .filter((item): item is IProcessHealthSnapshot => Boolean(item));

const parseServiceIssues = (
  values: Record<string, string[]>,
  previousMetric?: PreviousMetricSnapshot,
): NonNullable<IMetricsHistory['serviceSummary']['serviceIssues']> => {
  const explicitIssues = (values.serviceIssue || [])
    .map((line) => {
      const [service, manager, status, reason] = line.split('|');
      if (!service) {
        return undefined;
      }

      return {
        service,
        manager: (manager || (service.startsWith('docker:') ? 'docker' : service.startsWith('pm2:') ? 'pm2' : 'systemd')) as 'systemd' | 'pm2' | 'docker',
        status: (status || 'unknown') as 'failed' | 'inactive' | 'stopped' | 'exited' | 'unhealthy' | 'unknown',
        reason: reason || 'unknown reason',
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const runningBefore = new Set(previousMetric?.serviceSummary.runningServices || []);
  const inactiveNow = new Set(values.inactiveService || []);
  const manuallyStopped = [...runningBefore]
    .filter((service) => inactiveNow.has(service))
    .map((service) => ({
      service,
      manager: 'systemd' as const,
      status: 'inactive' as const,
      reason: 'user manually stopped the service',
    }));

  const byService = new Map<string, NonNullable<IMetricsHistory['serviceSummary']['serviceIssues']>[number]>();
  [...explicitIssues, ...manuallyStopped].forEach((issue) => byService.set(issue.service, issue));
  return [...byService.values()].slice(0, 50);
};

export const parseOsMetricSnapshot = (stdout: string, previousMetric?: PreviousMetricSnapshot): RawOsMetricSnapshot => {
  const sections = splitSections(stdout);
  const os = parseKeyValues(sections.os || []);
  const cpu = parseKeyValues(sections.cpu || []);
  const memory = parseKeyValues(sections.memory || []);
  const diskstats = parseKeyValues(sections.diskstats || []);
  const netdev = parseKeyValues(sections.netdev || []);
  const service = parseKeyValues(sections.services || []);
  const process = parseKeyValues(sections.processes || []);
  const ssh = parseKeyValues(sections.ssh || []);
  const parsedFilesystems = parseFilesystems(sections.filesystems || []);
  const filesystems = parsedFilesystems.length ? parsedFilesystems : previousMetric?.filesystems || [];
  const rootFs = filesystems.find((fs) => fs.mount === '/') || filesystems[0];
  const serviceIssues = parseServiceIssues(service, previousMetric);

  return {
    os: {
      id: os.id?.[0] || previousMetric?.os.id || 'linux',
      name: os.name?.[0] || previousMetric?.os.name || 'Linux',
      version: os.version?.[0] || previousMetric?.os.version,
      kernel: os.kernel?.[0] || previousMetric?.os.kernel,
      hostname: os.hostname?.[0] || previousMetric?.os.hostname,
      systemdAvailable: os.systemdAvailable?.[0]
        ? os.systemdAvailable[0] === 'true'
        : previousMetric?.os.systemdAvailable || false,
      journaldAvailable: os.journaldAvailable?.[0]
        ? os.journaldAvailable[0] === 'true'
        : previousMetric?.os.journaldAvailable || false,
    },
    cpuCoreCount: toNumber(cpu.coreCount?.[0], 0),
    loadAverage: toNumber(cpu.loadAverage?.[0]),
    memoryUsagePercent: clampPercent(toNumber(memory.memoryUsagePercent?.[0])),
    memoryUsedBytes: toNumber(memory.memoryUsedBytes?.[0]),
    memoryFreeBytes: toNumber(memory.memoryFreeBytes?.[0]),
    memoryCachedBytes: toNumber(memory.memoryCachedBytes?.[0]),
    swapUsagePercent: clampPercent(toNumber(memory.swapUsagePercent?.[0])),
    diskUsagePercent: rootFs?.usagePercent || 0,
    filesystems,
    serviceSummary: sections.services
      ? {
          running: toNumber(service.running?.[0]),
          failed: Math.max(toNumber(service.failed?.[0]), serviceIssues.length),
          inactive: toNumber(service.inactive?.[0]),
          failedServices: serviceIssues.map((issue) => issue.service).slice(0, 50),
          runningServices: (service.runningService || []).slice(0, 200),
          inactiveServices: (service.inactiveService || []).slice(0, 200),
          serviceIssues,
        }
      : previousMetric?.serviceSummary || { running: 0, failed: 0, inactive: 0, failedServices: [], runningServices: [], inactiveServices: [], serviceIssues: [] },
    processSummary: sections.processes
      ? {
          total: toNumber(process.total?.[0]),
          zombies: toNumber(process.zombies?.[0]),
          blocked: toNumber(process.blocked?.[0]),
          topCpu: parseTopProcesses(process),
        }
      : previousMetric?.processSummary || { total: 0, zombies: 0, blocked: 0, topCpu: [] },
    sshSessionActivity: sections.ssh
      ? {
          loggedInUsers: toNumber(ssh.loggedInUsers?.[0], previousMetric?.sshSessionActivity.loggedInUsers),
          establishedSessions: toNumber(
            ssh.establishedSessions?.[0],
            previousMetric?.sshSessionActivity.establishedSessions,
          ),
          recentAuthWarnings: toNumber(
            ssh.recentAuthWarnings?.[0],
            previousMetric?.sshSessionActivity.recentAuthWarnings,
          ),
        }
      : previousMetric?.sshSessionActivity || { loggedInUsers: 0, establishedSessions: 0, recentAuthWarnings: 0 },
    rawCounters: {
      cpuTotal: toNumber(cpu.total?.[0]),
      cpuIdle: toNumber(cpu.idle?.[0]),
      diskReadSectors: toNumber(diskstats.readSectors?.[0], previousMetric?.rawCounters.diskReadSectors),
      diskWriteSectors: toNumber(diskstats.writeSectors?.[0], previousMetric?.rawCounters.diskWriteSectors),
      networkRxBytes: toNumber(netdev.rxBytes?.[0], previousMetric?.rawCounters.networkRxBytes),
      networkTxBytes: toNumber(netdev.txBytes?.[0], previousMetric?.rawCounters.networkTxBytes),
    },
    networkErrors: toNumber(netdev.errors?.[0]),
    networkDroppedPackets: toNumber(netdev.dropped?.[0]),
  };
};

const isDue = (
  serverId: string,
  collector: CollectorName,
  intervalMs: number,
  now: number,
  previousMetric?: PreviousMetricSnapshot,
) => {
  if (!previousMetric) {
    return true;
  }

  const lastRun = lastRunByServer.get(serverId)?.[collector] || 0;
  return now - lastRun >= intervalMs;
};

const markRun = (serverId: string, collector: CollectorName, timestamp: number) => {
  lastRunByServer.set(serverId, {
    ...(lastRunByServer.get(serverId) || {}),
    [collector]: timestamp,
  });
};

const recordImpact = (impact: CollectorImpact) => {
  collectorImpactLog.unshift(impact);
  collectorImpactLog.splice(50);
};

const recordCommandExecution = (serverId: string, timestamp: number) => {
  const cutoff = timestamp - 60000;
  const recent = (commandExecutedAtByServer.get(serverId) || []).filter((executedAt) => executedAt >= cutoff);
  recent.push(timestamp);
  commandExecutedAtByServer.set(serverId, recent);
};

const getCommandsExecutedLastMinute = (serverId?: string) => {
  const now = Date.now();
  const cutoff = now - 60000;

  if (serverId) {
    return (commandExecutedAtByServer.get(serverId) || []).filter((executedAt) => executedAt >= cutoff).length;
  }

  return [...commandExecutedAtByServer.values()].reduce(
    (sum, executedAtList) => sum + executedAtList.filter((executedAt) => executedAt >= cutoff).length,
    0,
  );
};

const logSkip = (collector: CollectorName, reason: string) => {
  const meta = collectorMeta[collector];
  recordImpact({
    collector,
    commandName: `ssh:${collector}`,
    durationMs: 0,
    enabled: false,
    skippedReason: reason,
    impact: meta.impact,
    collectedAt: new Date(),
  });
  // logger.debug(
  //   `[LightweightMonitoring] collector=${collector} durationMs=0 command=ssh:${collector} impact=${meta.impact} enabled=false skipped=${reason}`,
  // );
};

const addCollectorIfDue = ({
  collectors,
  serverId,
  collector,
  enabled,
  intervalMs,
  now,
  previousMetric,
}: {
  collectors: CollectorName[];
  serverId: string;
  collector: CollectorName;
  enabled: boolean;
  intervalMs: number;
  now: number;
  previousMetric?: PreviousMetricSnapshot;
}) => {
  if (!enabled) {
    logSkip(collector, 'disabled');
    return;
  }

  if (!isDue(serverId, collector, intervalMs, now, previousMetric)) {
    logSkip(collector, 'interval_not_due');
    return;
  }

  collectors.push(collector);
};

export const osMetricCollectorService = {
  async collect(server: IServerConnection, options: OsMetricCollectorOptions) {
    const serverId = String(server._id);
    const now = Date.now();
    const collectors: CollectorName[] = ['core'];

    addCollectorIfDue({
      collectors,
      serverId,
      collector: 'disk',
      enabled: true,
      intervalMs: options.diskIntervalMs,
      now,
      previousMetric: options.previousMetric,
    });
    addCollectorIfDue({
      collectors,
      serverId,
      collector: 'processes',
      enabled: !options.coreOnly && options.enableProcessScan,
      intervalMs: options.processIntervalMs,
      now,
      previousMetric: options.previousMetric,
    });
    addCollectorIfDue({
      collectors,
      serverId,
      collector: 'services',
      enabled: !options.coreOnly && options.enableServiceScan,
      intervalMs: options.serviceIntervalMs,
      now,
      previousMetric: options.previousMetric,
    });
    addCollectorIfDue({
      collectors,
      serverId,
      collector: 'auth',
      enabled: !options.coreOnly && options.enableAuthScan,
      intervalMs: options.sshIntervalMs,
      now,
      previousMetric: options.previousMetric,
    });
    addCollectorIfDue({
      collectors,
      serverId,
      collector: 'networkConnections',
      enabled: !options.coreOnly && options.enableNetworkScan,
      intervalMs: options.networkScanIntervalMs,
      now,
      previousMetric: options.previousMetric,
    });

    const command = collectors.map((collector) => collectorMeta[collector].command).join('\n');
    const commandName = `ssh:${collectors.join('+')}`;
    const startedAt = Date.now();
    const result = await sshService.execute(server, command, options.commandTimeoutMs);
    const durationMs = Date.now() - startedAt;
    recordCommandExecution(serverId, Date.now());

    if (result.code !== 0 && !result.stdout.trim()) {
      throw new Error(result.stderr || `OS metric collection failed with code ${result.code}`);
    }

    collectors.forEach((collector) => {
      const meta = collectorMeta[collector];
      markRun(serverId, collector, Date.now());
      recordImpact({
        collector,
        commandName,
        durationMs,
        enabled: true,
        impact: meta.impact,
        collectedAt: new Date(),
      });
      // logger.debug(
      //   `[LightweightMonitoring] collector=${collector} durationMs=${durationMs} command=${commandName} impact=${meta.impact} enabled=true`,
      // );
    });

    return parseOsMetricSnapshot(result.stdout, options.previousMetric);
  },

  getImpactStats(serverId?: string) {
    return {
      lastCollectorDurationMs: collectorImpactLog.find((impact) => impact.enabled)?.durationMs ?? 0,
      commandsExecutedLastMinute: getCommandsExecutedLastMinute(serverId),
      recentCollectors: collectorImpactLog.slice(0, 10),
    };
  },
};
