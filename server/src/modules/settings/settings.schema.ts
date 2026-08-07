import { z } from 'zod';

export const createSettingSchema = z.object({
  body: z.object({
    key: z.string().min(1),
    value: z.any(),
    group: z.string().optional(),
    label: z.string().optional(),
    isPublic: z.boolean().optional(),
    isEditable: z.boolean().optional(),
  }),
});

export const updateSettingSchema = z.object({
  body: z.object({
    value: z.any().optional(),
    group: z.string().optional(),
    label: z.string().optional(),
    isPublic: z.boolean().optional(),
    isEditable: z.boolean().optional(),
  }),
  params: z.object({
    key: z.string().min(1),
  }),
});
