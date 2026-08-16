import { z } from 'zod';

export const createPrasadamItemSchema = z.object({
  body: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    price: z.number().min(0),
    bookingOpensAt: z.string().optional(),
    bookingClosesAt: z.string().optional(),
  }),
});

export const updatePrasadamItemSchema = z.object({
  body: z.object({
    slug: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    price: z.number().min(0).optional(),
    bookingOpensAt: z.string().optional(),
    bookingClosesAt: z.string().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createPrasadamOrderSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          itemId: z.string().min(1),
          qty: z.number().int().min(1),
        })
      )
      .min(1),
    guestName: z.string().min(1).optional(),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().min(6).optional(),
    preferredLocale: z.string().min(2).max(5).optional(),
  }),
});
