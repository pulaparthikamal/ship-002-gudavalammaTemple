import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import { menuApiDetails } from '@/models/menuModel'
import type { AppMenuItem } from '@/types/menu'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function getNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getMenuChildren(value: Record<string, unknown>) {
  return value.submenu ?? value.submenus ?? value.children ?? value.items
}

function normalizeMenuList(value: unknown): AppMenuItem[] {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => normalizeMenuItem(item, index))
      .filter((item): item is AppMenuItem => item !== null)
  }

  if (!isRecord(value)) {
    return []
  }

  const nestedValue = value.data ?? value.menu ?? value.menus ?? value.submenu ?? value.submenus ?? value.children ?? value.items

  if (nestedValue && nestedValue !== value) {
    return normalizeMenuList(nestedValue)
  }

  const menuItem = normalizeMenuItem(value, 0)
  return menuItem ? [menuItem] : []
}

function normalizeMenuItem(value: unknown, index: number): AppMenuItem | null {
  if (!isRecord(value)) {
    return null
  }

  const submenu = normalizeMenuList(getMenuChildren(value))
  const route = getString(value.route) ?? submenu[0]?.route ?? ''
  const title = getString(value.title) ?? getString(value.name) ?? route
  const permissionKey =
    getString(value.permissionKey) ??
    getString(value.key) ??
    route.split('/').filter(Boolean).at(-1) ??
    title

  if (!title && !route && !submenu.length) {
    return null
  }

  return {
    _id: getString(value._id) ?? getString(value.id),
    iconName: getString(value.iconName) ?? getString(value.icon) ?? getString(value.iconKey),
    route,
    sequenceNo: getNumber(value.sequenceNo ?? value.order ?? value.position, index),
    title,
    name: getString(value.name),
    permissionKey,
    roleId: getString(value.roleId),
    roleName: getString(value.roleName),
    submenu,
    createdAt: getString(value.createdAt) ?? getString(value.created),
    updatedAt: getString(value.updatedAt) ?? getString(value.updated),
    __v: typeof value.__v === 'number' ? value.__v : undefined,
  }
}

function normalizeMenuResponse(response: unknown): AppMenuItem[] {
  const nestedMenus = readResponsePath<AppMenuItem[] | AppMenuItem>(
    response,
    menuApiDetails.responseDataPath,
  )

  const normalizedMenus = normalizeMenuList(nestedMenus)

  if (normalizedMenus.length) {
    return normalizedMenus
  }

  return normalizeMenuList(response)
}

export const menusApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMenus: builder.query<AppMenuItem[], void>({
      query: () => ({
        url: menuApiDetails.endpoint,
        method: 'GET',
      }),
      transformResponse: normalizeMenuResponse,
      providesTags: ['Menu'],
    }),
  }),
})

export const { useGetMenusQuery } = menusApi
