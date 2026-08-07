import { Types } from 'mongoose';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { Metric } from '../models/metric.model';
import { ScanResult, fileCategories } from '../models/scanResult.model';
import { ServerConnection } from '../models/serverConnection.model';

const average = (values: number[]) => {
  if (!values.length) return 0;
  return Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2));
};

export const reportService = {
  async build(serverId?: string, params: { startDate?: string; endDate?: string } = {}) {
    const now = new Date();
    const startDate = params.startDate ? new Date(params.startDate) : (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; })();
    const endDate = params.endDate ? new Date(params.endDate) : (() => { const d = new Date(now); d.setHours(23, 59, 59, 999); return d; })();
    const serverOid = serverId ? new Types.ObjectId(serverId) : null;
    const serverFilter = serverOid ? { server: serverOid } : {};
    const dateFilter = { $gte: startDate, $lte: endDate };

    // Run all DB queries in parallel
    const [
      servers,
      metrics,
      logs,
      scanStats,   // { scanned, cleaned, storageCleanedMb, byCategory } from aggregation
      actionStats, // { byAction: { delete, archive, ignore } } from aggregation
    ] = await Promise.all([
      // ── Servers ────────────────────────────────────────────────────────────
      serverOid
        ? ServerConnection.find({ _id: serverOid })
            .select('name host status')
            .lean()
        : ServerConnection.find({ active: true })
            .select('name host status')
            .lean(),

      // ── Metrics: only the fields we aggregate ───────────────────────────
      Metric.find({ ...serverFilter, collectedAt: dateFilter })
        .select('cpuUsagePercent memoryUsagePercent diskUsagePercent collectedAt')
        .sort({ collectedAt: 1 })
        .lean(),

      // ── Maintenance logs: fields needed for recentActions display ────────
      MaintenanceLog.find({ ...serverFilter, created: dateFilter, action: { $in: ['scan', 'monitor'] } })
        .select('server action status reason metadata created')
        .sort({ created: -1 })
        .lean(),

      // ── Scan stats via aggregation (avoids loading full docs into JS) ────
      ScanResult.aggregate([
        { $match: { ...serverFilter, discoveredAt: dateFilter } },
        {
          $facet: {
            total: [{ $count: 'n' }],
            cleaned: [
              { $match: { actionStatus: { $in: ['completed', 'ignored'] } } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  storageMb: { $sum: '$sizeMb' },
                },
              },
            ],
            byCategory: [
              { $group: { _id: '$category', count: { $sum: 1 } } },
            ],
          },
        },
      ]),

      // ── Action counts via aggregation ────────────────────────────────────
      MaintenanceLog.aggregate([
        {
          $match: {
            ...serverFilter,
            created: dateFilter,
            action: { $in: ['delete', 'archive', 'ignore'] },
            status: 'success',
          },
        },
        { $group: { _id: '$action', count: { $sum: 1 } } },
      ]),
    ]);

    // ── Unpack scan aggregation result ──────────────────────────────────────
    const scanFacet = scanStats[0] ?? {};
    const scanned: number = scanFacet.total?.[0]?.n ?? 0;
    const cleanedCount: number = scanFacet.cleaned?.[0]?.count ?? 0;
    const storageCleanedMb: number = Number(
      (scanFacet.cleaned?.[0]?.storageMb ?? 0).toFixed(2)
    );
    const byCategory: Record<string, number> = fileCategories.reduce<Record<string, number>>((acc, cat) => {
      const found = (scanFacet.byCategory ?? []).find(
        (r: { _id: string; count: number }) => r._id === cat
      );
      acc[cat] = found?.count ?? 0;
      return acc;
    }, {});

    // ── Unpack action stats ─────────────────────────────────────────────────
    const actionsTaken: Record<string, number> = ['delete', 'archive', 'ignore'].reduce<
      Record<string, number>
    >((acc, action) => {
      const found = actionStats.find(
        (r: { _id: string; count: number }) => r._id === action
      );
      acc[action] = found?.count ?? 0;
      return acc;
    }, {});

    return {
      generatedAt: new Date(),
      window: { start: startDate, end: new Date() },
      servers: servers.map((s: any) => ({
        id: s._id,
        name: s.name,
        host: s.host,
        status: s.status,
      })),
      storageUsage: {
        avgDiskPercent: average(metrics.map((m: any) => m.diskUsagePercent)),
        maxDiskPercent: Math.max(0, ...metrics.map((m: any) => m.diskUsagePercent)),
      },
      computeUsage: {
        avgCpuPercent: average(metrics.map((m: any) => m.cpuUsagePercent)),
        avgMemoryPercent: average(metrics.map((m: any) => m.memoryUsagePercent)),
      },
      files: {
        scanned,
        cleaned: cleanedCount,
        storageCleanedMb,
        byCategory,
      },
      actionsTaken,
      recentActions: logs,
    };
  },
};
