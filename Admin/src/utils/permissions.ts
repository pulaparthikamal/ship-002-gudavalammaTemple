import type { CrudPermissionAction, CrudPermissionLevel } from '@/types/crud'
import type { AppMenuItem } from '@/types/menu'

type PermissionMap = Record<string, unknown> | undefined

interface NormalizedPermissionEntry {
  key: string
  type: CrudPermissionLevel
  actions: CrudPermissionAction[]
}

function normalizeLookupValue(value: string | undefined | null) {
  return value?.trim().toLowerCase() ?? ''
}

function getRouteAliases(route: string | undefined) {
  const normalizedRoute = route?.trim()

  if (!normalizedRoute) {
    return []
  }

  const cleanRoute = normalizedRoute.replace(/^\/+|\/+$/g, '')
  const lastSegment = cleanRoute.split('/').filter(Boolean).at(-1)

  return [normalizedRoute, cleanRoute, lastSegment].filter(
    (value): value is string => Boolean(value),
  )
}

function toPermissionAction(value: unknown): CrudPermissionAction | null {
  if (value === 'Create' || value === 'Add') {
    return 'Add'
  }

  if (value === 'View' || value === 'Update' || value === 'Delete') {
    return value
  }

  return null
}

function toPermissionType(value: unknown): CrudPermissionLevel {
  if (value === 'View' || value === 'Edit') {
    return value
  }

  return 'NoView'
}

function isPermissionMapAvailable(permissions: PermissionMap): permissions is Record<string, unknown> {
  return typeof permissions === 'object' && permissions !== null
}

function getPermissionAliases(permissionKey: string, permissionValue: Record<string, unknown>) {
  return Array.from(
    new Set(
      [
        permissionKey,
        typeof permissionValue.key === 'string' ? permissionValue.key : undefined,
        typeof permissionValue.title === 'string' ? permissionValue.title : undefined,
        typeof permissionValue.name === 'string' ? permissionValue.name : undefined,
        typeof permissionValue.route === 'string' ? permissionValue.route : undefined,
        ...getRouteAliases(
          typeof permissionValue.route === 'string' ? permissionValue.route : undefined,
        ),
      ]
        .map(normalizeLookupValue)
        .filter(Boolean),
    ),
  )
}

function buildPermissionLookup(permissions: PermissionMap) {
  if (!isPermissionMapAvailable(permissions)) {
    return null
  }

  const lookup = new Map<string, NormalizedPermissionEntry>()

  Object.entries(permissions).forEach(([permissionKey, permissionValue]) => {
    if (typeof permissionValue !== 'object' || permissionValue === null) {
      return
    }

    const record = permissionValue as Record<string, unknown>
    const normalizedEntry: NormalizedPermissionEntry = {
      key: permissionKey,
      type: toPermissionType(record.type),
      actions: Array.isArray(record.actions)
        ? record.actions
            .map(toPermissionAction)
            .filter((action): action is CrudPermissionAction => action !== null)
        : [],
    }

    getPermissionAliases(permissionKey, record).forEach((alias) => {
      lookup.set(alias, normalizedEntry)
    })
  })

  return lookup
}

function toAliasList(module: string | string[]) {
  return (Array.isArray(module) ? module : [module])
    .flatMap((value) => [value, ...getRouteAliases(value)])
    .map(normalizeLookupValue)
    .filter(Boolean)
}

export function resolvePermissionEntry(permissions: PermissionMap, module: string | string[]) {
  const lookup = buildPermissionLookup(permissions)

  if (!lookup) {
    return null
  }

  return toAliasList(module).map((alias) => lookup.get(alias)).find(Boolean) ?? null
}

export function hasModuleAccess(permissions: PermissionMap, module: string | string[]) {
  if (!isPermissionMapAvailable(permissions)) {
    return false
  }

  const permissionEntry = resolvePermissionEntry(permissions, module)
  return permissionEntry?.type === 'View' || permissionEntry?.type === 'Edit'
}

export function hasModuleAction(
  permissions: PermissionMap,
  module: string | string[],
  action: CrudPermissionAction,
) {
  if (!isPermissionMapAvailable(permissions)) {
    return false
  }

  if (action === 'View') {
    return hasModuleAccess(permissions, module)
  }

  const permissionEntry = resolvePermissionEntry(permissions, module)

  if (!permissionEntry || permissionEntry.type !== 'Edit') {
    return false
  }

  const normalizedAction = toPermissionAction(action)

  return normalizedAction ? permissionEntry.actions.includes(normalizedAction) : false
}

export function getMenuPermissionAliases(menu: AppMenuItem) {
  return Array.from(
    new Set(
      [menu.title, menu.permissionKey, menu.name, menu.route, ...getRouteAliases(menu.route)]
        .map(normalizeLookupValue)
        .filter(Boolean),
    ),
  )
}

export function canShowMenuItem(permissions: PermissionMap, menu: AppMenuItem) {
  return hasModuleAccess(permissions, getMenuPermissionAliases(menu))
}
