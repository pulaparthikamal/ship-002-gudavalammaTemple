import { z } from 'zod';

export const createReportSchema = z.object({
  body: z.object({
    reportName: z.string().trim().optional(),
    reportType: z.string().trim().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    payerId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    generatedBy: z.string().trim().optional(),
    generatedAt: z.coerce.date().optional(),
    exportFormat: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateReportSchema = z.object({
  body: z.object({
    reportName: z.string().trim().optional(),
    reportType: z.string().trim().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    payerId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    generatedBy: z.string().trim().optional(),
    generatedAt: z.coerce.date().optional(),
    exportFormat: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const rcmOperationsReportSchema = z.object({
  query: z.object({
    dateFrom: z.string().trim().optional(),
    dateTo: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
  }),
});
