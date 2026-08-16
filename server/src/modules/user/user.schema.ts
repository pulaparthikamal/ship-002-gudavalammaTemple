import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().optional(),
    role: z.string().min(24).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const updateOwnLocaleSchema = z.object({
  body: z.object({
    preferredLocale: z.enum(['en', 'te', 'hi']),
  }),
});

export const updateOwnProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    active: z.boolean(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
