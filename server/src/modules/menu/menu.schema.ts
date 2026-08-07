import { z } from 'zod';

const subMenuSchema = z.object({
  name: z.string(),
  route: z.string(),
  iconName: z.string().optional(),
  sequenceNo: z.number(),
  title: z.string(),
  permissionKey: z.string().optional(),
});

export const createMenuSchema = z.object({
  body: z.object({
    iconName: z.string().optional(),
    route: z.string(),
    sequenceNo: z.number(),
    title: z.string(),
    permissionKey: z.string().optional(),
    submenu: z.array(subMenuSchema).optional(),
  }),
});

export const updateMenuSchema = z.object({
  body: z.object({
    iconName: z.string().optional(),
    route: z.string().optional(),
    sequenceNo: z.number().optional(),
    title: z.string().optional(),
    permissionKey: z.string().optional(),
    submenu: z.array(subMenuSchema).optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
