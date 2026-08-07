import { Types } from 'mongoose';
import { envConfig } from '../../../config/env.config';
import { logger } from '../../../utils/logger.util';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { Metric } from '../models/metric.model';
import { ServerConnection } from '../models/serverConnection.model';
import { parseNumber } from '../utils/shell.util';
import { alertService } from './alert.service';
import { configService } from './config.service';
import { scanService } from './scan.service';
import { socketService } from './socket.service';
import { sshService } from './ssh.service';
import { monitoringEventService } from './monitoring/monitoringEvent.service';

const metricsCommand = `
CPU=$(vmstat 1 2 2>/dev/null | tail -1 | awk '{ if ($15 ~ /^[0-9]+$/) print 100-$15; else print 0 }')
MEM=$(free 2>/dev/null | awk '/Mem:/ { if ($2 > 0) printf "%.2f", ($3/$2)*100; else print 0 }')
DISK=$(df -P / 2>/dev/null | awk 'NR==2 { gsub("%","",$5); print $5 }')
LOAD=$(cut -d " " -f1 /proc/loadavg 2>/dev/null)
CORES=$(nproc 2>/dev/null || grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 0)
MODEL=$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo "Unknown")
GPU=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -n 1 || echo "None")
SERVICES_COUNT=$(systemctl list-units --type=service --state=running 2>/dev/null | grep -c "\\.service" || echo 0)
SERVICES_LIST=$(systemctl list-units --type=service --state=running --no-legend 2>/dev/null | awk '{print $1}' | head -n 10 | tr '\\n' ',' | sed 's/,$//' || echo "")

SWAP=$(free 2>/dev/null | awk '/Swap:/ { if ($2 > 0) printf "%.2f", ($3/$2)*100; else print 0 }')
SWAP_TOTAL=$(free -b 2>/dev/null | awk '/Swap:/ { print $2+0 }')
SWAP_USED=$(free -b 2>/dev/null | awk '/Swap:/ { print $3+0 }')

IO_1=$(cat /proc/diskstats 2>/dev/null | awk '{r+=$6; w+=$10} END {print r":"w}')
RX_1=$(awk 'NR>2 { gsub(":","",$1); rx+=$2 } END { print rx+0 }' /proc/net/dev 2>/dev/null)
TX_1=$(awk 'NR>2 { gsub(":","",$1); tx+=$10 } END { print tx+0 }' /proc/net/dev 2>/dev/null)
sleep 1
IO_2=$(cat /proc/diskstats 2>/dev/null | awk '{r+=$6; w+=$10} END {print r":"w}')
RX_2=$(awk 'NR>2 { gsub(":","",$1); rx+=$2 } END { print rx+0 }' /proc/net/dev 2>/dev/null)
TX_2=$(awk 'NR>2 { gsub(":","",$1); tx+=$10 } END { print tx+0 }' /proc/net/dev 2>/dev/null)

DOWNLOAD=$(( (RX_2 - RX_1) / 1024 ))
UPLOAD=$(( (TX_2 - TX_1) / 1024 ))

READ_1=$(echo $IO_1 | cut -d: -f1)
WRITE_1=$(echo $IO_1 | cut -d: -f2)
READ_2=$(echo $IO_2 | cut -d: -f1)
WRITE_2=$(echo $IO_2 | cut -d: -f2)
READ_IO=$(( (READ_2 - READ_1) * 512 / 1024 ))
WRITE_IO=$(( (WRITE_2 - WRITE_1) * 512 / 1024 ))

MEM_TOTAL=$(free -b 2>/dev/null | awk '/Mem:/ { print $2 }')
MEM_USED=$(free -b 2>/dev/null | awk '/Mem:/ { print $3 }')
DISK_TOTAL=$(df -B1 / 2>/dev/null | awk 'NR==2 { print $2 }')
DISK_USED=$(df -B1 / 2>/dev/null | awk 'NR==2 { print $3 }')

PROCESSES=$(ps -eo pid,pcpu,pmem,user,comm --sort=-pcpu | head -n 11 | sed '1d' | awk '{printf "%s:%s:%s:%s:%s,", $1, $2, $3, $4, $5}')

echo "cpuUsagePercent=$CPU"
echo "memoryUsagePercent=$MEM"
echo "diskUsagePercent=$DISK"
echo "swapUsagePercent=$SWAP"
echo "loadAverage=$LOAD"
echo "cpuCores=$CORES"
echo "cpuModel=$MODEL"
echo "gpuInfo=$GPU"
echo "runningServicesCount=$SERVICES_COUNT"
echo "runningServices=$SERVICES_LIST"
echo "networkDownloadSpeed=$DOWNLOAD"
echo "networkUploadSpeed=$UPLOAD"
echo "networkTotalReceived=$RX_2"
echo "networkTotalSent=$TX_2"
echo "totalMemoryBytes=$MEM_TOTAL"
echo "usedMemoryBytes=$MEM_USED"
echo "totalDiskBytes=$DISK_TOTAL"
echo "usedDiskBytes=$DISK_USED"
echo "swapTotalBytes=$SWAP_TOTAL"
echo "swapUsedBytes=$SWAP_USED"
echo "diskReadIo=$READ_IO"
echo "diskWriteIo=$WRITE_IO"
echo "topProcesses=$PROCESSES"
`;

const parseMetrics = (stdout: string) => {
  const values = stdout.split('\n').reduce<Record<string, string>>((acc, line) => {
    const [key, value] = line.trim().split('=');
    if (key && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const processes = (values.topProcesses || '')
    .split(',')
    .filter(Boolean)
    .map((p) => {
      const [pid, cpu, mem, user, name] = p.split(':');
      return {
        pid,
        cpu: parseNumber(cpu),
        mem: parseNumber(mem),
        user,
        name,
      };
    });

  return {
    cpuUsagePercent: parseNumber(values.cpuUsagePercent),
    memoryUsagePercent: parseNumber(values.memoryUsagePercent),
    diskUsagePercent: parseNumber(values.diskUsagePercent),
    swapUsagePercent: parseNumber(values.swapUsagePercent),
    loadAverage: parseNumber(values.loadAverage),
    cpuCores: parseNumber(values.cpuCores),
    cpuModel: values.cpuModel || 'Unknown',
    gpuInfo: values.gpuInfo || 'None',
    runningServicesCount: parseNumber(values.runningServicesCount),
    runningServices: values.runningServices ? values.runningServices.split(',') : [],
    networkDownloadSpeed: parseNumber(values.networkDownloadSpeed),
    networkUploadSpeed: parseNumber(values.networkUploadSpeed),
    networkTotalReceived: parseNumber(values.networkTotalReceived),
    networkTotalSent: parseNumber(values.networkTotalSent),
    totalMemoryBytes: parseNumber(values.totalMemoryBytes),
    usedMemoryBytes: parseNumber(values.usedMemoryBytes),
    totalDiskBytes: parseNumber(values.totalDiskBytes),
    usedDiskBytes: parseNumber(values.usedDiskBytes),
    swapTotalBytes: parseNumber(values.swapTotalBytes),
    swapUsedBytes: parseNumber(values.swapUsedBytes),
    diskReadIo: parseNumber(values.diskReadIo),
    diskWriteIo: parseNumber(values.diskWriteIo),
    topProcesses: processes,
  };
};

let monitorInterval: NodeJS.Timeout | null = null;
let monitoringInFlight = false;

export const monitoringService = {
  start() {
    if (envConfig.lightweightMonitoringEnabled) {
      logger.info('Legacy server monitoring scheduler skipped because lightweight monitoring is enabled');
      return;
    }

    if (monitorInterval) {
      return;
    }

    monitorInterval = setInterval(() => {
      void this.runDueMonitoring();
    }, 60000);

    setTimeout(() => {
      void this.runDueMonitoring();
    }, 5000);

    logger.info('Server monitoring scheduler started');
  },

  stop() {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
  },

  async runDueMonitoring() {
    if (monitoringInFlight) {
      return;
    }

    monitoringInFlight = true;
    try {
      const servers = await ServerConnection.find({ active: true, status: { $ne: 'disabled' } });
      for (const server of servers) {
        const config = await configService.get(String(server._id));
        const dueAfterMs = config.scanFrequencyMinutes * 60000;
        const lastMetricsAt = server.lastMetricsAt?.getTime() || 0;
        if (Date.now() - lastMetricsAt < dueAfterMs) {
          continue;
        }

        try {
          await this.collectMetrics(String(server._id), 'scheduled');
        } catch (error) {
          logger.warn(`Monitoring failed for server ${server.host}`, error);
        }
      }
    } finally {
      monitoringInFlight = false;
    }
  },

  async collectMetrics(serverId: string, trigger: 'scheduled' | 'manual' | 'threshold' = 'manual') {
    const server = await ServerConnection.findById(serverId);
    if (!server || !server.active) {
      throw new Error('Server not found.');
    }

    try {
      const result = await sshService.execute(server, metricsCommand, 30000);
      const values = parseMetrics(result.stdout);
      const metric = await Metric.create({
        server: new Types.ObjectId(serverId),
        ...values,
        collectedAt: new Date(),
        trigger,
        created: new Date(),
      });

      await monitoringEventService.markServerConnected(serverId, new Date());

      socketService.emitToServer(serverId, 'metrics:update', metric);

      const config = await configService.get(serverId);
      await monitoringEventService.evaluateThresholdAlerts(serverId, metric);

      if (values.diskUsagePercent >= config.diskThresholdPercent) {
        const lastScanAt = server.lastScanAt?.getTime() || 0;
        if (Date.now() - lastScanAt >= config.scanFrequencyMinutes * 60000) {
          // Trigger scan in background to avoid blocking the metrics response
          void scanService.startScan(serverId, undefined, 'threshold').catch((err) => {
            logger.error(`Threshold-triggered scan failed for ${serverId}:`, err);
          });
        }
      }

      await MaintenanceLog.create({
        server: new Types.ObjectId(serverId),
        action: 'monitor',
        status: 'success',
        reason: 'Monitoring agent collected system metrics.',
        aiDecisionTrace: [
          'Monitor Agent collected CPU, memory, disk, and network stats.',
          'Thresholds were evaluated from user configuration.',
        ],
        metadata: values,
        created: new Date(),
      });

      return metric;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Monitoring failed.';
      await monitoringEventService.markServerUnreachable(serverId, message, { force: true });

      await alertService.create({
        serverId,
        type: 'critical_issue',
        severity: 'critical',
        title: 'Server monitoring failed',
        message,
        metadata: {
          host: server.host,
        },
      });

      throw error;
    }
  },

  async getMetrics(serverId?: string, limit = 60) {
    const query = serverId ? { server: new Types.ObjectId(serverId) } : {};
    return Metric.find(query).sort({ collectedAt: -1 }).limit(limit);
  },
};
