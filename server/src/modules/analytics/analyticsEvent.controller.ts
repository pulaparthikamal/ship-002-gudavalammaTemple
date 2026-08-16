import { Request, Response } from 'express';
import { analyticsEventService } from './analyticsEvent.service';

const currentUserId = (req: Request): string | undefined => {
  const user = req.user as { _id?: string } | undefined;
  return user?._id ? String(user._id) : undefined;
};

const todayKey = (): string => new Date().toISOString().slice(0, 10);

export const analyticsEventController = {
  async ingest(req: Request, res: Response) {
    const { events } = req.body as { events: any[] };
    const result = await analyticsEventService.ingestBatch(events, currentUserId(req));
    return res.json(result);
  },

  async getSummary(req: Request, res: Response) {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 90);
    const summary = await analyticsEventService.getSummary(days);
    return res.json({ summary });
  },

  async runRollup(req: Request, res: Response) {
    const date = (req.body?.date as string | undefined) ?? todayKey();
    const rollup = await analyticsEventService.computeDailyRollup(date);
    return res.json({ rollup });
  },
};
