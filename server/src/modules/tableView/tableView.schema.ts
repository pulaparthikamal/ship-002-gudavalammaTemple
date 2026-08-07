import { z } from 'zod';

const tableViewColumnPreferenceSchema = z.object({
  columnId: z.string().trim().min(1).max(120),
  visible: z.boolean(),
});

const tableViewDefinitionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(80),
  columnOrder: z.array(z.string().trim().min(1).max(120)).min(1).max(200),
  columns: z.array(tableViewColumnPreferenceSchema).min(1).max(200),
});

export const tableViewPreferenceParamsSchema = z.object({
  params: z.object({
    tableId: z.string().trim().min(1).max(120),
  }),
});

export const updateTableViewPreferenceSchema = z.object({
  params: z.object({
    tableId: z.string().trim().min(1).max(120),
  }),
  body: z.object({
    activeViewId: z.string().trim().min(1).max(120).nullable(),
    views: z.array(tableViewDefinitionSchema).max(25),
  }),
});
