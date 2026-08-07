import { Types } from 'mongoose';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Deployment, IDeployment } from '../models/deployment.model';
import { Application } from '../models/application.model';
import { DeploymentTarget } from '../models/deploymentTarget.model';
import { DeploymentHealthCheckLog } from '../models/deploymentHealthCheckLog.model';
import { DeploymentAuditLog } from '../models/deploymentAuditLog.model';
import { DeploymentEmailLog } from '../models/deploymentEmailLog.model';
import { User } from '../../user/user.model';
import { deploymentTargetService } from './deploymentTarget.service';
import { sshUtil } from '../utils/ssh.util';
import { deploymentPathUtil } from '../utils/path.util';

const NVM_LOAD = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"';

export interface IAuditLogPayload {
  action: string;
  result: 'success' | 'failed' | 'skipped' | 'info';
  userId?: Types.ObjectId | string;
  userName?: string;
  applicationId?: Types.ObjectId | string;
  appName?: string;
  targetId?: Types.ObjectId | string;
  targetName?: string;
  environment?: string;
  details?: string;
}

export const reportService = {
  /**
   * Build unified query helper for reports
   */
  async buildQuery(filters: any) {
    const query: any = {};
    if (filters.applicationId) {
      query.applicationId = new Types.ObjectId(filters.applicationId);
    }
    if (filters.targetId) {
      query.targetId = new Types.ObjectId(filters.targetId);
    }
    if (filters.status) {
      if (filters.status === 'failed') {
        query.status = { $in: ['failed', 'rolled_back'] };
      } else {
        query.status = filters.status;
      }
    }
    if (filters.environment) {
      const targets = await DeploymentTarget.find({ isDeleted: false }).lean();
      const targetIds = targets
        .filter((t) => {
          const nameLower = t.name.toLowerCase();
          const env = nameLower.includes('staging')
            ? 'staging'
            : nameLower.includes('dev')
              ? 'development'
              : 'production';
          return env === filters.environment;
        })
        .map((t) => t._id);

      if (filters.targetId) {
        const targetIdObj = new Types.ObjectId(filters.targetId);
        if (targetIds.some((id) => id.toString() === targetIdObj.toString())) {
          query.targetId = targetIdObj;
        } else {
          query.targetId = new Types.ObjectId();
        }
      } else {
        query.targetId = { $in: targetIds };
      }
    }
    return query;
  },

  /**
   * Write an entry to the operational audit log
   */
  async logAudit(payload: IAuditLogPayload): Promise<void> {
    try {
      let resolvedUserName = payload.userName || 'System';
      if (payload.userId && !payload.userName) {
        const user = await User.findById(payload.userId).select('firstName lastName').lean();
        if (user) {
          resolvedUserName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
        }
      }

      let resolvedAppName = payload.appName;
      if (payload.applicationId && !payload.appName) {
        const app = await Application.findById(payload.applicationId).select('name').lean();
        if (app) resolvedAppName = app.name;
      }

      let resolvedTargetName = payload.targetName;
      if (payload.targetId && !payload.targetName) {
        const target = await DeploymentTarget.findById(payload.targetId).select('name').lean();
        if (target) resolvedTargetName = target.name;
      }

      await DeploymentAuditLog.create({
        timestamp: new Date(),
        userId: payload.userId ? new Types.ObjectId(payload.userId) : undefined,
        userName: resolvedUserName,
        applicationId: payload.applicationId ? new Types.ObjectId(payload.applicationId) : undefined,
        appName: resolvedAppName,
        targetId: payload.targetId ? new Types.ObjectId(payload.targetId) : undefined,
        targetName: resolvedTargetName,
        environment: payload.environment,
        action: payload.action,
        result: payload.result,
        details: payload.details,
      });
    } catch (err: any) {
      console.error('[ReportService] Failed to write audit log:', err.message);
    }
  },

  /**
   * Get Dashboard Reports & Analytics Overview Counts
   */
  async getDashboardStats(filters: any = {}) {
    const dashboardFilters = { ...filters };
    const query = await this.buildQuery(dashboardFilters);

    const totalApps = await Application.countDocuments({ isDeleted: false });
    const totalServers = await DeploymentTarget.countDocuments({ isDeleted: false });
    const totalDeployments = await Deployment.countDocuments(query);
    let successfulDeployments = 0;
    let failedDeployments = 0;

    if (filters.status) {
      if (filters.status === 'success') {
        successfulDeployments = totalDeployments;
        failedDeployments = 0;
      } else if (filters.status === 'failed') {
        successfulDeployments = 0;
        failedDeployments = totalDeployments;
      } else {
        successfulDeployments = 0;
        failedDeployments = 0;
      }
    } else {
      successfulDeployments = await Deployment.countDocuments({ ...query, status: 'success' });
      failedDeployments = await Deployment.countDocuments({ ...query, status: { $in: ['failed', 'rolled_back'] } });
    }

    // Group deployments by status
    const statusCounts = await Deployment.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statsMap: Record<string, number> = {
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
      rolling_back: 0,
      rolled_back: 0,
      cancelled: 0,
    };
    statusCounts.forEach((item) => {
      if (item._id) statsMap[item._id] = item.count;
    });

    // PM2 Managed components
    const appQuery: any = { isDeleted: false };
    if (filters.applicationId) appQuery._id = new Types.ObjectId(filters.applicationId);
    const apps = await Application.find(appQuery).lean();
    let pm2ProcessesCount = 0;
    apps.forEach((app) => {
      app.components?.forEach((c: any) => {
        if (c.type === 'node-api') pm2ProcessesCount++;
      });
    });

    // Active health checks failures (check the most recent status of each component)
    const healthLogQuery = await this.buildQuery(dashboardFilters);
    const latestChecks = await DeploymentHealthCheckLog.aggregate([
      { $match: healthLogQuery },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: { applicationId: '$applicationId', componentKey: '$componentKey' },
          status: { $first: '$status' },
          timestamp: { $first: '$timestamp' },
        },
      },
    ]);
    const healthFailuresCount = latestChecks.filter((check) => check.status === 'failed').length;

    // Average duration aggregation
    const durationAgg = await Deployment.aggregate([
      { $match: { ...query, durationMs: { $exists: true, $ne: null } } },
      { $group: { _id: null, avgDuration: { $avg: '$durationMs' } } }
    ]);
    const avgDuration = durationAgg[0]?.avgDuration || 0;

    // Monthly trends aggregation
    const monthlyTrends = await Deployment.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$created' },
            month: { $month: '$created' }
          },
          success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $in: ['$status', ['failed', 'rolled_back']] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    const formattedMonthlyTrends = monthlyTrends.map((t) => {
      const monthStr = String(t._id.month).padStart(2, '0');
      return {
        _id: `${t._id.year}-${monthStr}`,
        success: t.success,
        failed: t.failed,
      };
    });

    // Duration trends aggregation (shows last 15 individual deployment durations)
    const durationTrends = await Deployment.find({
      ...query,
      durationMs: { $exists: true, $ne: null }
    })
      .populate('applicationId', 'name')
      .populate('targetId', 'name')
      .sort({ created: -1 })
      .limit(15)
      .lean();

    durationTrends.reverse();

    const formattedDurationTrends = durationTrends.map((d: any) => {
      const appName = d.applicationId?.name || 'Unknown';
      const createdDate = new Date(d.created);
      const dateStr = createdDate.toLocaleDateString();
      const timeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        _id: `${appName} (${dateStr} ${timeStr})`,
        avgDuration: d.durationMs,
      };
    });

    // Last 10 deployments
    const recentDeployments = await Deployment.find(query)
      .populate('applicationId', 'name')
      .populate('targetId', 'name')
      .sort({ created: -1 })
      .limit(10)
      .lean();

    return {
      totalApps,
      totalServers,
      totalDeployments,
      successfulDeployments,
      failedDeployments,
      avgDuration,
      statsMap,
      pm2ProcessesCount,
      healthFailuresCount,
      monthlyTrends: formattedMonthlyTrends,
      durationTrends: formattedDurationTrends,
      recentDeployments: recentDeployments.map((d: any) => ({
        id: d._id,
        appName: d.applicationId?.name || 'Unknown App',
        serverName: d.targetId?.name || 'Unknown Server',
        status: d.status,
        durationMs: d.durationMs,
        created: d.created,
        environment: d.branch || 'production',
      })),
    };
  },

  /**
   * Filter and fetch deployments list
   */
  async getDeploymentsReport(filters: any) {
    const query = await this.buildQuery(filters);

    if (filters.startDate || filters.endDate) {
      query.created = {};
      if (filters.startDate) query.created.$gte = new Date(filters.startDate);
      if (filters.endDate) query.created.$lte = new Date(filters.endDate);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 20);
    const skip = (page - 1) * limit;

    const items = await Deployment.find(query)
      .populate('applicationId', 'name')
      .populate('targetId', 'name')
      .populate('triggeredBy', 'firstName lastName')
      .sort({ created: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Deployment.countDocuments(query);

    return {
      items: items.map((d: any) => ({
        id: d._id,
        appName: d.applicationId?.name || 'Unknown',
        serverName: d.targetId?.name || 'Unknown',
        version: d.commitSha?.slice(0, 8) || String(d._id).slice(-8),
        commitMsg: d.commit?.message || '—',
        environment: d.branch || 'production',
        status: d.status,
        durationMs: d.durationMs,
        startedAt: d.startedAt || d.created,
        completedAt: d.completedAt,
        triggeredBy: d.triggeredBy ? `${d.triggeredBy.firstName || ''} ${d.triggeredBy.lastName || ''}`.trim() : 'System/Webhook',
      })),
      total,
      page,
      limit,
    };
  },

  /**
   * Version History Report
   */
  async getVersionsReport(filters: any) {
    const baseQuery = await this.buildQuery(filters);
    const query = { ...baseQuery, status: 'success' };

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 20);
    const skip = (page - 1) * limit;

    const items = await Deployment.find(query)
      .populate('applicationId', 'name')
      .populate('targetId', 'name')
      .populate('triggeredBy', 'firstName lastName')
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Deployment.countDocuments(query);

    return {
      items: items.map((d: any) => ({
        id: d._id,
        appName: d.applicationId?.name || 'Unknown',
        serverName: d.targetId?.name || 'Unknown',
        version: d.commitSha?.slice(0, 8) || String(d._id).slice(-8),
        commitHash: d.commitSha || '—',
        commitMsg: d.commit?.message || '—',
        environment: d.branch || 'production',
        deployedAt: d.completedAt || d.created,
        deployedBy: d.triggeredBy ? `${d.triggeredBy.firstName || ''} ${d.triggeredBy.lastName || ''}`.trim() : 'System',
        rollbackCount: d.rollbackHistory?.length || 0,
      })),
      total,
      page,
      limit,
    };
  },

  /**
   * Server Deployment Target Report
   */
  async getServersReport() {
    const targets = await DeploymentTarget.find({ isDeleted: false }).lean();
    const serverDetails = [];

    for (const t of targets) {
      // Find apps hosted on this server
      const apps = await Application.find({
        isDeleted: false,
        'autoDeploy.targetId': t._id,
      }).select('name').lean();

      // Find deployments on this server
      const totalDeployments = await Deployment.countDocuments({ targetId: t._id });
      const lastDeployment = await Deployment.findOne({ targetId: t._id })
        .sort({ created: -1 })
        .select('completedAt created')
        .lean();

      serverDetails.push({
        id: t._id,
        name: t.name,
        host: t.host,
        status: t.status || 'unknown',
        environment: t.name.toLowerCase().includes('staging') ? 'staging' : t.name.toLowerCase().includes('dev') ? 'development' : 'production',
        totalApps: apps.length,
        hostedApps: apps.map((a) => a.name).join(', ') || 'None',
        totalDeployments,
        lastDeploymentDate: lastDeployment ? lastDeployment.completedAt || lastDeployment.created : null,
        osVersion: (t as any).osVersion || '—',
        nodeVersion: (t as any).nodeVersion || '—',
        pm2Version: (t as any).pm2Version || '—',
      });
    }

    return serverDetails;
  },

  /**
   * Health Checks Report
   */
  async getHealthChecksReport(filters: any) {
    const query = await this.buildQuery(filters);

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 20);
    const skip = (page - 1) * limit;

    const items = await DeploymentHealthCheckLog.find(query)
      .populate('applicationId', 'name')
      .populate('targetId', 'name')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await DeploymentHealthCheckLog.countDocuments(query);

    // Calculate response time trend and status trend (grouped by day)
    const trendStats = await DeploymentHealthCheckLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
          },
          avgResponseTime: { $avg: '$responseTimeMs' },
          successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          failureCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      { $limit: 30 },
    ]);

    const formattedTrend = trendStats.map((stat) => {
      const dateStr = `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}-${String(stat._id.day).padStart(2, '0')}`;
      return {
        date: dateStr,
        responseTime: Math.round(stat.avgResponseTime || 0),
        success: stat.successCount,
        failed: stat.failureCount,
      };
    });

    return {
      items: items.map((h: any) => ({
        id: h._id,
        appName: h.applicationId?.name || 'Unknown',
        serverName: h.targetId?.name || 'Unknown',
        componentKey: h.componentKey,
        url: h.url,
        status: h.status,
        httpCode: h.httpCode || '—',
        responseTimeMs: h.responseTimeMs || 0,
        error: h.error || '—',
        timestamp: h.timestamp,
      })),
      total,
      page,
      limit,
      trend: formattedTrend,
    };
  },

  /**
   * PM2 Live Monitoring Status
   */
  async getPm2Report(targetId: string) {
    const target = await DeploymentTarget.findById(targetId);
    if (!target) throw new Error('Target server not found');

    const sshConfig = await deploymentTargetService.getSshConfig(target);
    const nodeVersion = 'lts/*';
    const pm2Path = target.nodeInstallStrategy === 'nvm'
      ? `${NVM_LOAD} && nvm use ${nodeVersion} >/dev/null 2>&1 && pm2 jlist`
      : 'pm2 jlist';

    const pm2Result = await sshUtil.executeOnce(sshConfig, pm2Path, 20000);
    if (pm2Result.code !== 0) {
      throw new Error(`PM2 Command failed: ${pm2Result.stderr || 'Connection timed out'}`);
    }

    try {
      const parsed = JSON.parse(pm2Result.stdout.trim());
      if (!Array.isArray(parsed)) return [];

      return parsed.map((proc: any) => {
        const pm2Env = proc.pm2_env || {};
        const uptime = pm2Env.pm_uptime ? Date.now() - pm2Env.pm_uptime : 0;
        return {
          processName: proc.name,
          pid: proc.pid,
          status: pm2Env.status || 'unknown',
          restarts: pm2Env.restart_time || 0,
          uptimeMs: uptime,
          memoryBytes: proc.monit?.memory || 0,
          cpuPercent: proc.monit?.cpu || 0,
          nodePath: pm2Env.node_path || '—',
        };
      });
    } catch (parseErr: any) {
      throw new Error(`Failed to parse PM2 JSON output: ${parseErr.message}`);
    }
  },

  /**
   * Deployment Failure Stage/Category analysis
   */
  async getFailuresReport(filters: any) {
    if (filters.status && filters.status !== 'failed') {
      return {
        items: [],
        categoryTrend: [],
      };
    }
    const baseQuery = await this.buildQuery(filters);
    const query = { ...baseQuery, status: { $in: ['failed', 'rolled_back'] } };

    if (filters.startDate || filters.endDate) {
      query.created = {};
      if (filters.startDate) query.created.$gte = new Date(filters.startDate);
      if (filters.endDate) query.created.$lte = new Date(filters.endDate);
    }

    const failedDeployments = await Deployment.find(query)
      .populate('applicationId', 'name')
      .populate('targetId', 'name')
      .populate('triggeredBy', 'firstName lastName')
      .sort({ created: -1 })
      .lean();

    const failureItems = failedDeployments.map((d: any) => {
      // Find the step that failed
      const failedStep = (d.steps || []).find((s: any) => s.status === 'failed');
      const stepName = failedStep ? failedStep.stepName : 'Unknown';
      const errorMsg = failedStep?.error || d.error || 'General deployment error';

      // Map to Stage and Category
      let stage = 'Environment Setup';
      let category = 'Environment Configuration Failure';

      if (stepName === 'connect') {
        stage = 'SSH Connection';
        category = /auth|permission|denied|key/i.test(errorMsg) ? 'Authentication Failure' : 'SSH Connection Failure';
      } else if (stepName === 'fetch-source' || stepName === 'ensure-git') {
        stage = 'Fetch Source';
        category = 'Upload Failure';
      } else if (stepName === 'install-dependencies') {
        stage = 'Install Dependencies';
        category = 'Dependency Installation Failure';
      } else if (stepName === 'build') {
        stage = 'Build Stage';
        category = 'Build Failure';
      } else if (['start-process', 'persist-pm2', 'activate-release'].includes(stepName)) {
        stage = 'PM2 Execution';
        category = 'PM2 Failure';
      } else if (stepName === 'health-check') {
        stage = 'Health Verification';
        category = 'Health Check Failure';
      }

      return {
        id: d._id,
        appName: d.applicationId?.name || 'Unknown',
        serverName: d.targetId?.name || 'Unknown',
        date: d.completedAt || d.created,
        version: d.commitSha?.slice(0, 8) || String(d._id).slice(-8),
        failureStage: stage,
        failureCategory: category,
        reason: errorMsg,
        environment: d.branch || 'production',
        triggeredBy: d.triggeredBy ? `${d.triggeredBy.firstName || ''} ${d.triggeredBy.lastName || ''}`.trim() : 'System',
      };
    });

    // Aggregate counts by category for charts
    const categoryCounts: Record<string, number> = {};
    failureItems.forEach((item) => {
      categoryCounts[item.failureCategory] = (categoryCounts[item.failureCategory] || 0) + 1;
    });

    const categoryTrend = Object.keys(categoryCounts).map((cat) => ({
      category: cat,
      count: categoryCounts[cat],
    }));

    return {
      items: failureItems,
      categoryTrend,
    };
  },

  /**
   * User Activity Report & Audit Log
   */
  async getUserActivityReport() {
    const users = await User.find({ active: true }).select('firstName lastName email').lean();
    const userReport = [];

    for (const u of users) {
      const userId = u._id;
      const total = await Deployment.countDocuments({ triggeredBy: userId });
      const success = await Deployment.countDocuments({ triggeredBy: userId, status: 'success' });
      const failed = await Deployment.countDocuments({ triggeredBy: userId, status: 'failed' });
      const last = await Deployment.findOne({ triggeredBy: userId })
        .sort({ created: -1 })
        .select('created')
        .lean();

      if (total > 0) {
        userReport.push({
          userId,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          email: u.email,
          totalDeployments: total,
          successfulDeployments: success,
          failedDeployments: failed,
          lastDeploymentDate: last ? last.created : null,
        });
      }
    }

    // Sort by total deployments descending
    userReport.sort((a, b) => b.totalDeployments - a.totalDeployments);

    return userReport;
  },

  /**
   * Audit Trail paginated view
   */
  async getAuditTrailReport(filters: any) {
    const query = await this.buildQuery(filters);
    if (filters.userId) query.userId = new Types.ObjectId(filters.userId);
    if (filters.result) query.result = filters.result;

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 20);
    const skip = (page - 1) * limit;

    const items = await DeploymentAuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await DeploymentAuditLog.countDocuments(query);

    return {
      items,
      total,
      page,
      limit,
    };
  },

  /**
   * Get notification email delivery reports/logs
   */
  async getNotificationsReport(filters: any) {
    const query: any = {};
    if (filters.applicationId) {
      const deployments = await Deployment.find({ applicationId: new Types.ObjectId(filters.applicationId) }).select('_id');
      const deploymentIds = deployments.map((d) => d._id);
      query.deploymentId = { $in: deploymentIds };
    }
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.sentAt = {};
      if (filters.startDate) query.sentAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.sentAt.$lte = new Date(filters.endDate);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Number(filters.limit) || 20);
    const skip = (page - 1) * limit;

    const items = await DeploymentEmailLog.find(query)
      .populate({
        path: 'deploymentId',
        select: 'applicationId targetId status trigger commit branch commitSha created',
        populate: [
          { path: 'applicationId', select: 'name displayName' },
          { path: 'targetId', select: 'name' },
        ],
      })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await DeploymentEmailLog.countDocuments(query);

    return {
      items: items.map((log: any) => {
        const dep = log.deploymentId || {};
        const app = dep.applicationId || {};
        const target = dep.targetId || {};
        
        let appName = app.displayName || app.name || '';
        if (!appName && log.subject) {
          const parts = log.subject.split('-');
          if (parts.length > 1) {
            appName = parts.slice(1).join('-').trim();
          }
        }
        if (!appName) {
          appName = 'Unknown';
        }

        return {
          id: log._id,
          appName,
          serverName: target.name || 'Unknown',
          version: dep.commitSha?.slice(0, 8) || (dep._id ? String(dep._id).slice(-8) : '—'),
          environment: dep.branch || 'production',
          recipient: log.recipient,
          eventType: log.eventType,
          subject: log.subject,
          status: log.status,
          sentAt: log.sentAt,
          errorMessage: log.errorMessage,
        };
      }),
      total,
      page,
      limit,
    };
  },

  /**
   * Export Report to CSV, Excel, or PDF
   */
  async exportReport(type: string, format: string, filters: any) {
    let headers: string[] = [];
    let rows: any[][] = [];
    let title = 'Report';

    if (type === 'deployments') {
      title = 'Deployment History Report';
      headers = ['Deployment ID', 'Application', 'Target Server', 'Environment', 'Version', 'Status', 'Duration', 'Triggered By', 'Date'];
      const data = await this.getDeploymentsReport({ ...filters, limit: 10000 });
      rows = data.items.map((i) => [
        i.id,
        i.appName,
        i.serverName,
        i.environment,
        i.version,
        i.status.toUpperCase(),
        i.durationMs ? `${Math.round(i.durationMs / 1000)}s` : '—',
        i.triggeredBy,
        new Date(i.startedAt).toISOString(),
      ]);
    } else if (type === 'versions') {
      title = 'Application Version Report';
      headers = ['Deployment ID', 'Application', 'Target Server', 'Environment', 'Commit Sha', 'Commit Message', 'Deployed By', 'Deployed Date'];
      const data = await this.getVersionsReport({ ...filters, limit: 10000 });
      rows = data.items.map((i) => [
        i.id,
        i.appName,
        i.serverName,
        i.environment,
        i.version,
        i.commitMsg,
        i.deployedBy,
        new Date(i.deployedAt).toISOString(),
      ]);
    } else if (type === 'servers') {
      title = 'Server Connection & Deployment Report';
      headers = ['Server Name', 'Host IP', 'Status', 'Environment', 'Apps Count', 'Hosted Apps', 'Total Deployments', 'OS Release', 'Node.js', 'PM2'];
      const data = await this.getServersReport();
      rows = data.map((i) => [
        i.name,
        i.host,
        i.status.toUpperCase(),
        i.environment.toUpperCase(),
        i.totalApps,
        i.hostedApps,
        i.totalDeployments,
        i.osVersion,
        i.nodeVersion,
        i.pm2Version,
      ]);
    } else if (type === 'health-checks') {
      title = 'Application Health Checks Report';
      headers = ['Check ID', 'Application', 'Server', 'Component', 'Target URL', 'Status', 'HTTP Code', 'Latency (ms)', 'Error Reason', 'Timestamp'];
      const data = await this.getHealthChecksReport({ ...filters, limit: 10000 });
      rows = data.items.map((i) => [
        i.id,
        i.appName,
        i.serverName,
        i.componentKey,
        i.url,
        i.status.toUpperCase(),
        i.httpCode,
        i.responseTimeMs,
        i.error,
        new Date(i.timestamp).toISOString(),
      ]);
    } else if (type === 'failures') {
      title = 'Deployment Failure Stage & Root Cause Analysis';
      headers = ['Deployment ID', 'Application', 'Server', 'Environment', 'Failure Stage', 'Failure Category', 'Error Reason', 'Triggered By', 'Date'];
      const data = await this.getFailuresReport(filters);
      rows = data.items.map((i) => [
        i.id,
        i.appName,
        i.serverName,
        i.environment,
        i.failureStage,
        i.failureCategory,
        i.reason,
        i.triggeredBy,
        new Date(i.date).toISOString(),
      ]);
    } else if (type === 'audit-trail') {
      title = 'System Operational Audit Trail';
      headers = ['Timestamp', 'User', 'Action', 'Result', 'Application', 'Server', 'Environment', 'Details'];
      const data = await this.getAuditTrailReport({ ...filters, limit: 10000 });
      rows = data.items.map((i) => [
        new Date(i.timestamp).toISOString(),
        i.userName,
        i.action.toUpperCase(),
        i.result.toUpperCase(),
        i.appName || '—',
        i.targetName || '—',
        i.environment || '—',
        i.details || '—',
      ]);
    }

    if (format === 'csv') {
      const csvStr = [
        headers.join(','),
        ...rows.map((row) =>
          row
            .map((val) => {
              const s = val === null || val === undefined ? '' : String(val);
              return `"${s.replace(/"/g, '""')}"`;
            })
            .join(',')
        ),
      ].join('\r\n');

      return {
        buffer: Buffer.from(csvStr, 'utf8'),
        contentType: 'text/csv',
        filename: `${type}_report_${Date.now()}.csv`,
      };
    } else if (format === 'excel') {
      const htmlStr = jsonToExcelHtml(title.slice(0, 30), headers, rows);
      return {
        buffer: Buffer.from(htmlStr, 'utf8'),
        contentType: 'application/vnd.ms-excel',
        filename: `${type}_report_${Date.now()}.xls`,
      };
    } else if (format === 'pdf') {
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([842, 595]); // Landscape Letter size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let yOffset = 540;

      // Draw PDF Title
      page.drawText(title, { x: 40, y: yOffset, size: 18, font: fontBold, color: rgb(0.1, 0.2, 0.4) });
      page.drawText(`Generated on: ${new Date().toLocaleString()}`, { x: 40, y: yOffset - 20, size: 10, font });
      yOffset -= 60;

      // Column widths calculation
      const colWidth = Math.floor(762 / headers.length);

      // Draw Headers
      headers.forEach((header, index) => {
        page.drawText(header, { x: 40 + index * colWidth, y: yOffset, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      });
      page.drawLine({
        start: { x: 40, y: yOffset - 5 },
        end: { x: 802, y: yOffset - 5 },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5),
      });
      yOffset -= 20;

      // Draw rows
      for (const row of rows) {
        if (yOffset < 40) {
          page = pdfDoc.addPage([842, 595]);
          yOffset = 540;
          // Re-draw headers on new page
          headers.forEach((header, index) => {
            page.drawText(header, { x: 40 + index * colWidth, y: yOffset, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
          });
          page.drawLine({
            start: { x: 40, y: yOffset - 5 },
            end: { x: 802, y: yOffset - 5 },
            thickness: 1,
            color: rgb(0.5, 0.5, 0.5),
          });
          yOffset -= 20;
        }

        row.forEach((cellVal, colIndex) => {
          const rawText = cellVal === null || cellVal === undefined ? '' : String(cellVal);
          // Truncate text if it is too long for the column
          const maxChar = Math.floor(colWidth / 5.5);
          const text = rawText.length > maxChar ? rawText.slice(0, maxChar - 3) + '...' : rawText;

          page.drawText(text, { x: 40 + colIndex * colWidth, y: yOffset, size: 8, font });
        });

        yOffset -= 15;
      }

      const pdfBytes = await pdfDoc.save();
      return {
        buffer: Buffer.from(pdfBytes),
        contentType: 'application/pdf',
        filename: `${type}_report_${Date.now()}.pdf`,
      };
    }

    throw new Error('Unsupported format');
  },
};

function jsonToExcelHtml(sheetName: string, headers: string[], rows: any[][]): string {
  const headerHtml = headers
    .map(
      (h) =>
        `<th style="background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px;">${h}</th>`
    )
    .join('');

  const rowsHtml = rows
    .map((row) => {
      const cells = row
        .map(
          (val) =>
            `<td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; color: #334155;">${
              val === null || val === undefined ? '' : String(val)
            }</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${sheetName}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
      </style>
    </head>
    <body>
      <h2 style="color: #1e293b; font-family: 'Segoe UI', sans-serif; padding-bottom: 5px;">${sheetName}</h2>
      <p style="color: #64748b; font-family: 'Segoe UI', sans-serif; font-size: 11px; margin-top: 0; margin-bottom: 15px;">Generated on: ${new Date().toLocaleString()}</p>
      <table>
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `;
}
