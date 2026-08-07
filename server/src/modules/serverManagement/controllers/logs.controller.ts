import { Request, Response } from 'express';
import { logService } from '../services/log.service';
import { logAnalysisService } from '../services/logAnalysis';
import { SupportedLogSource } from '../models/logAnalysis.model';

export const logsController = {
  async list(req: Request, res: Response) {
    let filterParams: any = {};
    if (req.query.filter) {
      try {
        filterParams = JSON.parse(String(req.query.filter));
      } catch (e) {
        // ignore
      }
    }

    const serverId = req.query.serverId ? String(req.query.serverId) : filterParams.serverId;
    const page = filterParams.page ? Number(filterParams.page) : (req.query.page ? Number(req.query.page) : 1);
    const limit = filterParams.limit ? Number(filterParams.limit) : (req.query.limit ? Number(req.query.limit) : 20);
    const sortfield = filterParams.sortfield ? String(filterParams.sortfield) : (req.query.sortfield ? String(req.query.sortfield) : 'created');
    const direction = filterParams.direction ? String(filterParams.direction) : (req.query.direction ? String(req.query.direction) : 'desc');
    let criteria = filterParams.criteria || [];

    if (!filterParams.criteria && req.query.criteria) {
      try {
        criteria = JSON.parse(String(req.query.criteria));
      } catch (e) {
        criteria = [];
      }
    }

    const { logs, total } = await logService.list({
      serverId,
      page,
      limit,
      sortfield,
      direction,
      criteria
    });

    return res.json({
      success: true,
      data: logs,
      meta: {
        total,
        page,
        limit
      }
    });
  },

  async intelligence(req: Request, res: Response) {
    const serverId = req.query.serverId ? String(req.query.serverId) : undefined;
    const severity = logAnalysisService.parseSeverity(req.query.severity);
    const data = await logAnalysisService.getIntelligence({ serverId, severity });

    return res.json({
      success: true,
      data,
    });
  },

  async query(req: Request, res: Response) {
    const severity = logAnalysisService.parseSeverity(req.query.severity);
    const source = req.query.source
      ? String(req.query.source).split(',').map((item) => item.trim()).filter(Boolean) as SupportedLogSource[]
      : undefined;
    const data = await logAnalysisService.queryLogs({
      serverId: req.query.serverId ? String(req.query.serverId) : undefined,
      timeRange: req.query.timeRange ? String(req.query.timeRange) as any : undefined,
      startTime: req.query.startTime ? String(req.query.startTime) : undefined,
      endTime: req.query.endTime ? String(req.query.endTime) : undefined,
      severity,
      source,
      logType: req.query.logType ? String(req.query.logType) : undefined,
      serviceName: req.query.serviceName ? String(req.query.serviceName) : undefined,
      keyword: req.query.keyword ? String(req.query.keyword) : undefined,
      errorSecurityOnly: req.query.errorSecurityOnly === 'true',
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      sort: req.query.sort ? String(req.query.sort) as any : undefined,
    });

    return res.json({
      success: true,
      data,
      meta: {
        collection: 'logs_processed',
      },
    });
  },

  async analytics(req: Request, res: Response) {
    const severity = logAnalysisService.parseSeverity(req.query.severity);
    const source = req.query.source
      ? String(req.query.source).split(',').map((item) => item.trim()).filter(Boolean) as SupportedLogSource[]
      : undefined;
    const result = await logAnalysisService.queryLogs({
      serverId: req.query.serverId ? String(req.query.serverId) : undefined,
      timeRange: req.query.timeRange ? String(req.query.timeRange) as any : undefined,
      startTime: req.query.startTime ? String(req.query.startTime) : undefined,
      endTime: req.query.endTime ? String(req.query.endTime) : undefined,
      severity,
      source,
      logType: req.query.logType ? String(req.query.logType) : undefined,
      serviceName: req.query.serviceName ? String(req.query.serviceName) : undefined,
      keyword: req.query.keyword ? String(req.query.keyword) : undefined,
      errorSecurityOnly: req.query.errorSecurityOnly === 'true',
      limit: 5,
      page: 1,
      sort: req.query.sort ? String(req.query.sort) as any : undefined,
    });

    return res.json({
      success: true,
      data: {
        total: result.total,
        startTime: result.startTime,
        endTime: result.endTime,
        summary: result.summary,
      },
      meta: {
        collection: 'logs_processed',
      },
    });
  },

  async collect(req: Request, res: Response) {
    const { serverId, sources } = req.body as {
      serverId?: string;
      sources?: SupportedLogSource[];
    };

    if (!serverId) {
      return res.status(400).json({ success: false, message: 'serverId is required' });
    }

    const data = await logAnalysisService.collect(serverId, sources);

    return res.json({
      success: true,
      data,
    });
  },

  async ingest(req: Request, res: Response) {
    const { serverId, source, lines, path } = req.body as {
      serverId?: string;
      source?: SupportedLogSource;
      lines?: string[];
      path?: string;
    };

    if (!serverId || !source || !Array.isArray(lines)) {
      return res.status(400).json({
        success: false,
        message: 'serverId, source, and lines[] are required',
      });
    }

    const data = await logAnalysisService.ingest({ serverId, source, lines, path });

    return res.json({
      success: true,
      data,
    });
  },

  async cleanupRecommendations(req: Request, res: Response) {
    const serverId = req.query.serverId ? String(req.query.serverId) : undefined;
    if (!serverId) {
      return res.status(400).json({ success: false, message: 'serverId is required' });
    }

    const data = await logAnalysisService.getCleanupRecommendations(serverId);

    return res.json({
      success: true,
      data,
    });
  },

  async retentionPolicies(req: Request, res: Response) {
    const serverId = req.query.serverId ? String(req.query.serverId) : undefined;
    return res.json({
      success: true,
      data: await logAnalysisService.getRetentionPolicies(serverId),
    });
  },
};
