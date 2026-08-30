import { z } from 'zod';
import { NAV_TAB_KEYS, NAV_TAB_ROLES } from './navTab.model';

export const setNavTabRolesSchema = z.object({
  body: z.object({
    allowedRoles: z.array(z.enum(NAV_TAB_ROLES)),
  }),
  params: z.object({
    key: z.enum(NAV_TAB_KEYS),
  }),
});
