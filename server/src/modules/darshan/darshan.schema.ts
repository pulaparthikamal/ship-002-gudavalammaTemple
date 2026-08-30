import { z } from 'zod';

export const createDarshanQuotaSchema = z.object({
  body: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    price: z.number().min(0),
    dailyCapacity: z.number().min(1).optional(),
    bookingOpensAt: z.string().optional(),
    bookingClosesAt: z.string().optional(),
  }),
});

export const updateDarshanQuotaSchema = z.object({
  body: z.object({
    slug: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    price: z.number().min(0).optional(),
    dailyCapacity: z.number().min(1).optional(),
    bookingOpensAt: z.string().optional(),
    bookingClosesAt: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createDarshanBookingSchema = z.object({
  body: z.object({
    quotaId: z.string().min(24),
    date: z.string().min(1),
    devoteeCount: z.number().min(1).max(5),
    guestName: z.string().min(1).optional(),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().min(6).optional(),
    preferredLocale: z.string().min(2).max(5).optional(),
  }),
});
