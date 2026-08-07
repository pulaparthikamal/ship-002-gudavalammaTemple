import { Client, ConnectConfig } from 'ssh2';
import { Types } from 'mongoose';
import { ServerConnection } from '../../models/serverConnection.model';
import { MetricsHistory } from '../../models/metricsHistory.model';
import { socketService } from '../socket.service';
import { secretCrypto } from '../../utils/crypto.util';
import { logger } from '../../../../utils/logger.util';
import { osMetricCollectorService, RawOsMetricSnapshot } from './osMetricCollector.service';
import { metricSeriesService } from './metricSeries.service';
import { monitoringEventService } from './monitoringEvent.service';
import type { IServerConnection } from '../../models/serverConnection.model';
import type { IMetricsHistory } from '../../models/metricsHistory.model';

export const CPU_MEM_LIVE = 'CPU_MEM_LIVE';
const POLL_INTERVAL_MS = 1000;
const EXEC_TIMEOUT_MS = 2000;
const CONNECT_TIMEOUT_MS = 12000;
const RECONNECT_DELAY_MS = 3000;
const CPU_HISTORY_SAMPLE_INTERVAL_MS = 60_000;
const CPU_SPIKE_DELTA_PERCENT = 20;
const CPU_STABLE_DELTA_PERCENT = 3;
const sectorSizeBytes = 512;

export interface CpuMemLivePayload {
  serverId?: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  swapUsagePercent: number;
  loadAverage: number;
  memoryCachedBytes?: number;
  networkRxBytesPerSecond?: number;
  networkTxBytesPerSecond?: number;
  processesTotal?: number;
  timestamp: number;
}

// Reads only kernel virtual files — near-zero CPU impact on the remote host
const LIVE_CMD =
  'set +e;' +
  "awk '/^cpu /{t=0;for(i=2;i<=NF;i++)t+=$i;printf \"cpuTotal=%s\\ncpuIdle=%s\\n\",t,$5+$6}' /proc/stat 2>/dev/null;" +
  "awk 'NR==1{print \"load=\"$1}' /proc/loadavg 2>/dev/null;" +
  "awk '/^MemTotal:/{mt=$2}/^MemAvailable:/{ma=$2}/^SwapTotal:/{st=$2}/^SwapFree:/{sf=$2}/^Cached:/{mc=$2}/^Buffers:/{mb=$2}END{printf \"mem=%.2f\\nswap=%.2f\\ncached=%.0f\\n\",(mt>0)?(mt-ma)/mt*100:0,(st>0)?(st-sf)/st*100:0,(mc+mb)*1024}' /proc/meminfo 2>/dev/null;" +
  "awk 'NR>2{sub(/:/,\" \");if($1!=\"lo\"){rx+=$2;tx+=$10}}END{printf \"netRx=%s\\nnetTx=%s\\n\",rx+0,tx+0}' /proc/net/dev 2>/dev/null;" +
  "printf \"processesTotal=%s\\n\" \"$(ls -d /proc/[0-9]* 2>/dev/null | wc -l)\"";

interface CpuCounters {
  total: number;
  idle: number;
}

interface NetworkCounters {
  rx: number;
  tx: number;
  timestamp: number;
}

interface PollerEntry {
  client: Client | null;
  timer: NodeJS.Timeout | null;
  clientCount: number;
  prevCpu: CpuCounters | null;
  prevNetwork: NetworkCounters | null;
  reconnectTimer: NodeJS.Timeout | null;
}

const pollerByServer = new Map<string, PollerEntry>();
const lastCpuHistorySampleAtByServer = new Map<string, number>();
const cpuHistorySampleInFlightByServer = new Set<string>();

const buildConfig = (server: IServerConnection): ConnectConfig => {
  const cfg: ConnectConfig = {
    host: server.host,
    port: server.port,
    username: server.username,
    readyTimeout: CONNECT_TIMEOUT_MS,
    keepaliveInterval: 10000,
  };
  if (server.authType === 'password') {
    cfg.password = secretCrypto.decrypt(server.encryptedPassword);
  } else {
    cfg.privateKey = secretCrypto.decrypt(server.encryptedPrivateKey);
    cfg.passphrase = secretCrypto.decrypt(server.encryptedPassphrase);
  }
  return cfg;
};

const parseKv = (stdout: string): Record<string, number> => {
  const kv: Record<string, number> = {};
  for (const line of stdout.split('\n')) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const v = Number(line.slice(eq + 1).trim());
    if (Number.isFinite(v)) kv[line.slice(0, eq).trim()] = v;
  }
  return kv;
};

const execOn = (client: Client, cmd: string): Promise<string> =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(''), EXEC_TIMEOUT_MS);
    client.exec(cmd, (err, stream) => {
      if (err) { clearTimeout(t); resolve(''); return; }
      let out = '';
      stream.on('data', (d: Buffer) => { out += d.toString(); });
      stream.stderr.on('data', () => { /* drain */ });
      stream.on('close', () => { clearTimeout(t); resolve(out); });
    });
  });

const safeRate = (current: number, previous: number, elapsedSeconds: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || elapsedSeconds <= 0) {
    return 0;
  }

  return Math.max(0, (current - previous) / elapsedSeconds);
};

const calculateCpuUsage = (
  current: RawOsMetricSnapshot['rawCounters'],
  previous?: Pick<IMetricsHistory, 'rawCounters'> | null,
) => {
  if (!previous) {
    return 0;
  }

  const totalDelta = current.cpuTotal - previous.rawCounters.cpuTotal;
  const idleDelta = current.cpuIdle - previous.rawCounters.cpuIdle;
  if (totalDelta <= 0) {
    return 0;
  }

  return Number(Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100)).toFixed(2));
};

const buildCpuExplanation = (
  current: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    loadAverage: number;
    topProcesses: IMetricsHistory['processSummary']['topCpu'];
  },
  previous?: Pick<IMetricsHistory, 'cpuUsagePercent'> | null,
) => {
  const previousCpu = previous?.cpuUsagePercent;
  const cpuDeltaPercent = Number(
    (previousCpu === undefined ? 0 : current.cpuUsagePercent - previousCpu).toFixed(2),
  );
  const trend = Math.abs(cpuDeltaPercent) < CPU_STABLE_DELTA_PERCENT
    ? 'stable'
    : cpuDeltaPercent > 0
      ? 'up'
      : 'down';
  const isSpike = cpuDeltaPercent >= CPU_SPIKE_DELTA_PERCENT || current.cpuUsagePercent >= 80;
  const spikeSeverity = current.cpuUsagePercent >= 80 || cpuDeltaPercent >= 35
    ? 'high'
    : cpuDeltaPercent >= CPU_SPIKE_DELTA_PERCENT
      ? 'medium'
      : 'low';
  const topProcess = current.topProcesses[0];
  const reasons: string[] = [];

  if (trend === 'up') {
    reasons.push(`CPU increased by ${cpuDeltaPercent.toFixed(1)}% compared to previous sample.`);
  } else if (trend === 'down') {
    reasons.push(`CPU dropped by ${Math.abs(cpuDeltaPercent).toFixed(1)}% compared to previous sample.`);
  } else {
    reasons.push('CPU stayed close to the previous sample.');
  }

  if (topProcess?.cpuPercent >= 20) {
    reasons.push(`High CPU usage mainly from ${topProcess.name} process (${topProcess.cpuPercent.toFixed(1)}%).`);
  }

  if (current.loadAverage >= 4) {
    reasons.push(`System load average is elevated at ${current.loadAverage.toFixed(2)}.`);
  }

  if (current.memoryUsagePercent >= 85) {
    reasons.push(`Memory pressure is high at ${current.memoryUsagePercent.toFixed(1)}%.`);
  }

  if (trend === 'down' && previousCpu !== undefined && previousCpu >= 80) {
    reasons.push('CPU dropped after previous high usage period.');
  }

  if (reasons.length === 1 && !topProcess) {
    reasons.push('No clear process-level cause found.');
  }

  return {
    cpuDeltaPercent,
    trend,
    isSpike,
    spikeSeverity,
    probableReason: reasons.join(' '),
  };
};

const persistCpuHistorySampleIfDue = async (
  serverId: string,
  payload: CpuMemLivePayload,
  fallbackCounters: CpuCounters,
) => {
  const lastSampleAt = lastCpuHistorySampleAtByServer.get(serverId) || 0;
  if (
    payload.timestamp - lastSampleAt < CPU_HISTORY_SAMPLE_INTERVAL_MS ||
    cpuHistorySampleInFlightByServer.has(serverId)
  ) {
    return;
  }

  lastCpuHistorySampleAtByServer.set(serverId, payload.timestamp);
  cpuHistorySampleInFlightByServer.add(serverId);

  try {
    const serverObjectId = new Types.ObjectId(serverId);
    const server = await ServerConnection.findOne({ _id: serverObjectId, active: true });
    if (!server) {
      return;
    }

    const latestPersisted = await MetricsHistory.findOne({ server: serverObjectId })
      .sort({ collectedAt: -1 })
      .lean<IMetricsHistory | null>();

    if (
      latestPersisted?.collectedAt &&
      payload.timestamp - latestPersisted.collectedAt.getTime() < CPU_HISTORY_SAMPLE_INTERVAL_MS
    ) {
      return;
    }

    const rawSnapshot = await osMetricCollectorService.collect(server, {
      previousMetric: latestPersisted,
      diskIntervalMs: Number.MAX_SAFE_INTEGER,
      processIntervalMs: 0,
      serviceIntervalMs: Number.MAX_SAFE_INTEGER,
      sshIntervalMs: Number.MAX_SAFE_INTEGER,
      networkScanIntervalMs: Number.MAX_SAFE_INTEGER,
      commandTimeoutMs: 10000,
      coreOnly: false,
      enableProcessScan: true,
      enableServiceScan: false,
      enableAuthScan: false,
      enableNetworkScan: false,
    });

    const collectedAt = new Date(payload.timestamp);
    const elapsedSeconds = latestPersisted?.collectedAt
      ? Math.max(1, (collectedAt.getTime() - latestPersisted.collectedAt.getTime()) / 1000)
      : CPU_HISTORY_SAMPLE_INTERVAL_MS / 1000;
    const cpuUsagePercent = latestPersisted
      ? calculateCpuUsage(rawSnapshot.rawCounters, latestPersisted)
      : payload.cpuUsagePercent;
    const explanation = buildCpuExplanation(
      {
        cpuUsagePercent,
        memoryUsagePercent: rawSnapshot.memoryUsagePercent,
        loadAverage: rawSnapshot.loadAverage,
        topProcesses: rawSnapshot.processSummary.topCpu,
      },
      latestPersisted,
    );

    const metric = await MetricsHistory.create({
      server: serverObjectId,
      os: rawSnapshot.os,
      cpuUsagePercent,
      ...explanation,
      cpuCoreCount: rawSnapshot.cpuCoreCount,
      loadAverage: rawSnapshot.loadAverage,
      memoryUsagePercent: rawSnapshot.memoryUsagePercent,
      memoryUsedBytes: rawSnapshot.memoryUsedBytes,
      memoryFreeBytes: rawSnapshot.memoryFreeBytes,
      memoryCachedBytes: rawSnapshot.memoryCachedBytes,
      swapUsagePercent: rawSnapshot.swapUsagePercent,
      diskUsagePercent: rawSnapshot.diskUsagePercent,
      diskReadBytesPerSecond: safeRate(
        rawSnapshot.rawCounters.diskReadSectors * sectorSizeBytes,
        (latestPersisted?.rawCounters.diskReadSectors || 0) * sectorSizeBytes,
        latestPersisted ? elapsedSeconds : 0,
      ),
      diskWriteBytesPerSecond: safeRate(
        rawSnapshot.rawCounters.diskWriteSectors * sectorSizeBytes,
        (latestPersisted?.rawCounters.diskWriteSectors || 0) * sectorSizeBytes,
        latestPersisted ? elapsedSeconds : 0,
      ),
      networkRxBytesPerSecond: safeRate(
        rawSnapshot.rawCounters.networkRxBytes,
        latestPersisted?.rawCounters.networkRxBytes || 0,
        latestPersisted ? elapsedSeconds : 0,
      ),
      networkTxBytesPerSecond: safeRate(
        rawSnapshot.rawCounters.networkTxBytes,
        latestPersisted?.rawCounters.networkTxBytes || 0,
        latestPersisted ? elapsedSeconds : 0,
      ),
      networkErrors: rawSnapshot.networkErrors,
      networkDroppedPackets: rawSnapshot.networkDroppedPackets,
      serviceSummary: rawSnapshot.serviceSummary,
      processSummary: rawSnapshot.processSummary,
      sshSessionActivity: rawSnapshot.sshSessionActivity,
      filesystems: rawSnapshot.filesystems,
      rawCounters: {
        ...rawSnapshot.rawCounters,
        cpuTotal: rawSnapshot.rawCounters.cpuTotal || fallbackCounters.total,
        cpuIdle: rawSnapshot.rawCounters.cpuIdle || fallbackCounters.idle,
      },
      collectedAt,
      pollIntervalMs: CPU_HISTORY_SAMPLE_INTERVAL_MS,
      created: collectedAt,
      createdAt: collectedAt,
    });

    void metricSeriesService.persistFromHistory(metric).catch((error) => {
      logger.warn(
        `[MetricSeries] sampled live metric skipped server=${serverId} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
    await monitoringEventService.markServerConnected(serverId, collectedAt);
    await monitoringEventService.evaluateThresholdAlerts(serverId, metric);
  } catch (error) {
    logger.warn(
      `[LivePoller] CPU history sample skipped server=${serverId} error=${error instanceof Error ? error.message : 'unknown'}`,
    );
  } finally {
    cpuHistorySampleInFlightByServer.delete(serverId);
  }
};

const tick = async (serverId: string) => {
  const entry = pollerByServer.get(serverId);
  if (!entry?.client) return;

  try {
    const stdout = await execOn(entry.client, LIVE_CMD);
    if (!stdout.trim()) return;

    const kv = parseKv(stdout);
    const cpuTotal = kv.cpuTotal ?? 0;
    const cpuIdle = kv.cpuIdle ?? 0;

    const previousCpu = entry.prevCpu;
    let cpuUsagePercent = 0;
    if (previousCpu && cpuTotal > previousCpu.total) {
      const totalDelta = cpuTotal - previousCpu.total;
      const idleDelta = cpuIdle - previousCpu.idle;
      cpuUsagePercent = Number(
        Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100)).toFixed(2),
      );
    }
    entry.prevCpu = { total: cpuTotal, idle: cpuIdle };

    const netRx = kv.netRx ?? 0;
    const netTx = kv.netTx ?? 0;
    const now = Date.now();

    const previousNetwork = entry.prevNetwork;
    let networkRxBytesPerSecond = 0;
    let networkTxBytesPerSecond = 0;
    if (previousNetwork && now > previousNetwork.timestamp) {
      const elapsedSeconds = (now - previousNetwork.timestamp) / 1000;
      networkRxBytesPerSecond = safeRate(netRx, previousNetwork.rx, elapsedSeconds);
      networkTxBytesPerSecond = safeRate(netTx, previousNetwork.tx, elapsedSeconds);
    }
    entry.prevNetwork = { rx: netRx, tx: netTx, timestamp: now };

    const payload: CpuMemLivePayload = {
      serverId,
      cpuUsagePercent,
      memoryUsagePercent: Number((kv.mem ?? 0).toFixed(2)),
      swapUsagePercent: Number((kv.swap ?? 0).toFixed(2)),
      loadAverage: kv.load ?? 0,
      memoryCachedBytes: kv.cached ?? 0,
      networkRxBytesPerSecond,
      networkTxBytesPerSecond,
      processesTotal: kv.processesTotal ?? 0,
      timestamp: now,
    };

    socketService.emitToServer(serverId, CPU_MEM_LIVE, payload);
    if (previousCpu) {
      void persistCpuHistorySampleIfDue(serverId, payload, entry.prevCpu);
    }
  } catch {
    // silently skip — a missed 1s tick is acceptable
  }
};

const scheduleReconnect = (serverId: string) => {
  const entry = pollerByServer.get(serverId);
  if (!entry || entry.clientCount <= 0 || entry.reconnectTimer) return;
  entry.reconnectTimer = setTimeout(() => {
    const e = pollerByServer.get(serverId);
    if (e) { e.reconnectTimer = null; }
    void connectAndStart(serverId);
  }, RECONNECT_DELAY_MS);
};

const connectAndStart = async (serverId: string) => {
  const entry = pollerByServer.get(serverId);
  if (!entry || entry.clientCount <= 0 || entry.client) return;

  let server: IServerConnection | null = null;
  try {
    server = await ServerConnection.findOne({ _id: serverId, active: true });
  } catch {
    scheduleReconnect(serverId);
    return;
  }
  if (!server) return;

  const client = new Client();

  const connected = await new Promise<boolean>((resolve) => {
    const t = setTimeout(() => { client.end(); resolve(false); }, CONNECT_TIMEOUT_MS + 1000);
    client
      .once('ready', () => { clearTimeout(t); resolve(true); })
      .once('error', () => { clearTimeout(t); resolve(false); })
      .connect(buildConfig(server as IServerConnection));
  });

  const current = pollerByServer.get(serverId);
  if (!connected || !current || current.clientCount <= 0) {
    try { client.end(); } catch { /* ignore */ }
    if (current && current.clientCount > 0) scheduleReconnect(serverId);
    return;
  }

  current.client = client;

  const onDisconnect = () => {
    const e = pollerByServer.get(serverId);
    if (!e) return;
    e.client = null;
    logger.info(`[LivePoller] connection lost server=${serverId}`);
    if (e.clientCount > 0) scheduleReconnect(serverId);
  };

  client.on('end', onDisconnect);
  client.on('close', onDisconnect);
  client.on('error', onDisconnect);

  current.timer = setInterval(() => { void tick(serverId); }, POLL_INTERVAL_MS);
  logger.info(`[LivePoller] started 1s live polling server=${serverId}`);
};

const destroyEntry = (serverId: string, entry: PollerEntry) => {
  if (entry.timer) { clearInterval(entry.timer); }
  if (entry.reconnectTimer) { clearTimeout(entry.reconnectTimer); }
  if (entry.client) { try { entry.client.end(); } catch { /* ignore */ } }
  pollerByServer.delete(serverId);
  lastCpuHistorySampleAtByServer.delete(serverId);
  cpuHistorySampleInFlightByServer.delete(serverId);
  logger.info(`[LivePoller] stopped server=${serverId}`);
};

export const cpuMemLivePollerService = {
  startClient(serverId: string) {
    const entry = pollerByServer.get(serverId);
    if (entry) {
      entry.clientCount++;
      logger.info(`[LivePoller] client joined server=${serverId} clients=${entry.clientCount}`);
      return;
    }
    const newEntry: PollerEntry = { client: null, timer: null, clientCount: 1, prevCpu: null, prevNetwork: null, reconnectTimer: null };
    pollerByServer.set(serverId, newEntry);
    logger.info(`[LivePoller] first client server=${serverId}`);
    void connectAndStart(serverId);
  },

  stopClient(serverId: string) {
    const entry = pollerByServer.get(serverId);
    if (!entry) return;
    entry.clientCount = Math.max(0, entry.clientCount - 1);
    logger.info(`[LivePoller] client left server=${serverId} clients=${entry.clientCount}`);
    if (entry.clientCount === 0) destroyEntry(serverId, entry);
  },

  stopAll() {
    for (const [serverId, entry] of pollerByServer) {
      destroyEntry(serverId, entry);
    }
  },
};
