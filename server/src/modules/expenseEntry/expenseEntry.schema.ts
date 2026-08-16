import { z } from 'zod';

export const createExpenseEntrySchema = z.object({
  body: z.object({
    date: z.string().min(1),
    eventId: z.string().min(24).optional().nullable(),
    category: z.string().min(1),
    description: z.string().optional(),
    amount: z.number(),
    type: z.enum(['income', 'expense']),
    paymentMode: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']).optional(),
    attachmentRef: z.string().optional(),
  }),
});

export const updateExpenseEntrySchema = z.object({
  body: z.object({
    date: z.string().min(1).optional(),
    eventId: z.string().min(24).optional().nullable(),
    category: z.string().min(1).optional(),
    description: z.string().optional(),
    amount: z.number().optional(),
    type: z.enum(['income', 'expense']).optional(),
    paymentMode: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']).optional(),
    attachmentRef: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

// Used for per-row validation in bulk create (body of a single entry, no wrapper).
export const bulkExpenseEntryRowSchema = z.object({
  date: z.string().min(1),
  eventId: z.string().min(24).optional().nullable(),
  category: z.string().min(1),
  description: z.string().optional(),
  amount: z.number(),
  type: z.enum(['income', 'expense']),
  paymentMode: z.enum(['cash', 'upi', 'bank_transfer', 'cheque', 'other']).optional(),
  attachmentRef: z.string().optional(),
});

export const bulkCreateExpenseEntrySchema = z.object({
  body: z.object({
    entries: z.array(z.record(z.any())).min(1),
  }),
});
