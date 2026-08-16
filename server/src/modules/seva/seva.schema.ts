import { z } from 'zod';

export const createSevaSchema = z.object({
  body: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    category: z.enum(['pratyaksha', 'paroksha', 'saswata']),
    timing: z.string().min(1),
    price: z.number().min(0),
    bookingOpensAt: z.string().optional(),
    bookingClosesAt: z.string().optional(),
  }),
});

export const updateSevaSchema = z.object({
  body: z.object({
    slug: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    category: z.enum(['pratyaksha', 'paroksha', 'saswata']).optional(),
    timing: z.string().min(1).optional(),
    price: z.number().min(0).optional(),
    bookingOpensAt: z.string().optional(),
    bookingClosesAt: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createSevaBookingSchema = z.object({
  body: z.object({
    sevaId: z.string().min(24),
    date: z.string().min(1).optional(),
    guestName: z.string().min(1).optional(),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().min(6).optional(),
    preferredLocale: z.string().min(2).max(5).optional(),
  }),
});
