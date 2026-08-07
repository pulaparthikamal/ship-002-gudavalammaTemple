import { z } from 'zod';

export const createTaskSchema = z.object({
  body: z.object({
    entityId: z.string().trim().optional(),
    entityType: z.string().trim().optional(),
    workflowStage: z.string().trim().optional(),
    assignedTo: z.string().trim().optional(),
    assignedTeam: z.string().trim().optional(),
    priority: z.string().trim().optional(),
    status: z.string().trim().optional(),
    dueDate: z.coerce.date().optional(),
    slaTimer: z.coerce.date().optional(),
    escalationFlag: z.boolean().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    entityId: z.string().trim().optional(),
    entityType: z.string().trim().optional(),
    workflowStage: z.string().trim().optional(),
    assignedTo: z.string().trim().optional(),
    assignedTeam: z.string().trim().optional(),
    priority: z.string().trim().optional(),
    status: z.string().trim().optional(),
    dueDate: z.coerce.date().optional(),
    slaTimer: z.coerce.date().optional(),
    escalationFlag: z.boolean().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
