import { z } from 'zod';

export const createDonationSchema = z.object({
  body: z.object({
    fundId: z.string().min(24),
    amount: z.number().positive(),
    guestName: z.string().min(1).optional(),
    guestEmail: z.string().email().optional(),
    guestPhone: z.string().min(6).optional(),
    preferredLocale: z.string().min(2).max(5).optional(),
  }),
});
