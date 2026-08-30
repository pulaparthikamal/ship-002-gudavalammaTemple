import { z } from 'zod';

export const createTempleEventSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    registrationRequired: z.boolean().optional(),
    capacity: z.number().min(1).optional(),
    registrationDeadline: z.coerce.date().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateTempleEventSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    registrationRequired: z.boolean().optional(),
    capacity: z.number().min(1).optional(),
    registrationDeadline: z.coerce.date().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createEventRegistrationSchema = z.object({
  body: z.object({
    eventId: z.string().min(24),
    guestName: z.string().min(1).optional(),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().min(6).optional(),
    preferredLocale: z.string().min(2).max(5).optional(),
  }),
});
