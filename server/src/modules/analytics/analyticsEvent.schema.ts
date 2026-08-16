import { z } from 'zod';

const eventSchema = z.object({
  sessionId: z.string().min(1),
  path: z.string().min(1),
  eventType: z.enum(['pageview', 'click', 'funnel_step']),
  targetLabel: z.string().optional(),
  funnelName: z.string().optional(),
  stepIndex: z.number().optional(),
  stepName: z.string().optional(),
  durationMs: z.number().optional(),
  timestamp: z.coerce.date(),
});

export const ingestEventsSchema = z.object({
  body: z.object({
    events: z.array(eventSchema).min(1).max(200),
  }),
});

export const runRollupSchema = z.object({
  body: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
});
