import { z } from 'zod';

const permissionItemSchema = z.object({
  type: z.string(),
  actions: z.array(z.string()),
});

export const createRoleSchema = z.object({
  body: z.object({
    role: z.string().min(1),
    roleType: z.string().min(1),
    status: z.string().optional(),
    active: z.boolean().optional(),
    permissions: z.record(permissionItemSchema).optional(),
  }),
});

export const updateRoleSchema = z.object({
  body: z.object({
    role: z.string().min(1).optional(),
    roleType: z.string().min(1).optional(),
    status: z.string().optional(),
    active: z.boolean().optional(),
    permissions: z.record(permissionItemSchema).optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
