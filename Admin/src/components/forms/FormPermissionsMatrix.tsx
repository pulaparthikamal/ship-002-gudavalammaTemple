import { useEffect, useMemo } from 'react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { Checkbox } from 'primereact/checkbox'
import { Dropdown } from 'primereact/dropdown'
import { Message } from 'primereact/message'
import { useGetMenusQuery } from '@/services/api/endpoints/menusApi'
import { cn } from '@/utils/classNames'
import { resolveMenuIcon } from '@/utils/menuIcons'
import type {
  CrudPermissionAction,
  CrudPermissionEntry,
  CrudPermissionLevel,
  CrudPermissionsValue,
} from '@/types/crud'
import type { AppMenuItem } from '@/types/menu'

const defaultPermissionActions: CrudPermissionAction[] = ['Add', 'Update', 'Delete']

const accessOptions: Array<{ label: string; value: CrudPermissionLevel }> = [
  { label: 'No access', value: 'NoView' },
  { label: 'View', value: 'View' },
  { label: 'Edit', value: 'Edit' },
]

interface PermissionScreen {
  key: string
  title: string
  route: string
  iconName?: string
  parentTitle?: string
  sequenceNo: number
  aliases: string[]
}

interface PermissionsMatrixInputProps {
  value: CrudPermissionsValue | undefined
  disabled?: boolean
  actions: CrudPermissionAction[]
  onChange: (value: CrudPermissionsValue) => void
}

interface FormPermissionsMatrixProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>
  name: FieldPath<TFieldValues>
  label: string
  helperText?: string
  containerClassName?: string
  disabled?: boolean
  actions?: CrudPermissionAction[]
}

function getPermissionKey(menu: AppMenuItem) {
  const permissionKey = menu.permissionKey?.trim()

  if (permissionKey) {
    return permissionKey
  }

  const title = menu.title?.trim()
  if (title) {
    return title
  }

  return menu.route.trim()
}

function getPermissionAliases(menu: AppMenuItem) {
  return Array.from(
    new Set(
      [menu.title, menu.permissionKey, menu.name, menu.route]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

function flattenMenuScreens(items: AppMenuItem[], parentTitle?: string): PermissionScreen[] {
  return [...items]
    .sort((firstItem, secondItem) => firstItem.sequenceNo - secondItem.sequenceNo)
    .flatMap((item) => {
      const screen: PermissionScreen = {
        key: getPermissionKey(item),
        title: item.title,
        route: item.route,
        iconName: item.iconName,
        parentTitle,
        sequenceNo: item.sequenceNo,
        aliases: getPermissionAliases(item),
      }

      const childScreens = item.submenu?.length ? flattenMenuScreens(item.submenu, item.title) : []

      return [screen, ...childScreens]
    })
}

function dedupeScreens(items: PermissionScreen[]) {
  const seenKeys = new Set<string>()

  return items.filter((item) => {
    if (seenKeys.has(item.key)) {
      return false
    }

    seenKeys.add(item.key)
    return true
  })
}

function normalizeLookupKey(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function createPermissionLookup(currentValue: CrudPermissionsValue | undefined) {
  const lookup = new Map<string, CrudPermissionEntry>()

  Object.entries(currentValue ?? {}).forEach(([entryKey, entry]) => {
    ;[entryKey, entry.key, entry.title, entry.route]
      .map(normalizeLookupKey)
      .filter(Boolean)
      .forEach((key) => {
        lookup.set(key, entry)
      })
  })

  return lookup
}

function normalizePermissionActions(
  actions: CrudPermissionAction[] | undefined,
  type: CrudPermissionLevel,
  allowedActions: CrudPermissionAction[],
): CrudPermissionAction[] {
  if (type === 'NoView') {
    return []
  }

  if (type === 'View') {
    return ['View']
  }

  const nextActions = new Set<CrudPermissionAction>(['View'])

  actions?.forEach((action) => {
    if (action === 'View' || allowedActions.includes(action)) {
      nextActions.add(action)
    }
  })

  return Array.from(nextActions)
}

function buildPermissionEntry(
  screen: PermissionScreen,
  currentEntry: CrudPermissionEntry | undefined,
  actions: CrudPermissionAction[],
): CrudPermissionEntry {
  const type = currentEntry?.type ?? 'NoView'

  return {
    key: screen.key,
    title: currentEntry?.title || screen.title,
    route: currentEntry?.route || screen.route,
    parentTitle: currentEntry?.parentTitle ?? screen.parentTitle,
    type,
    actions: normalizePermissionActions(currentEntry?.actions, type, actions),
  }
}

function buildMatrixValue(
  screens: PermissionScreen[],
  currentValue: CrudPermissionsValue | undefined,
  actions: CrudPermissionAction[],
) {
  const nextValue: CrudPermissionsValue = {}
  const permissionLookup = createPermissionLookup(currentValue)

  screens.forEach((screen) => {
    const currentEntry =
      screen.aliases
        .map((alias) => permissionLookup.get(normalizeLookupKey(alias)))
        .find((entry) => Boolean(entry)) ?? currentValue?.[screen.key]

    nextValue[screen.key] = buildPermissionEntry(screen, currentEntry, actions)
  })

  return nextValue
}

function serializeMatrixValue(value: CrudPermissionsValue | undefined) {
  const entries = Object.values(value ?? {})
    .map((entry) => ({
      ...entry,
      actions: [...entry.actions].sort(),
    }))
    .sort((firstEntry, secondEntry) => firstEntry.key.localeCompare(secondEntry.key))

  return JSON.stringify(entries)
}

function PermissionsMatrixInput({
  value,
  disabled = false,
  actions,
  onChange,
}: PermissionsMatrixInputProps) {
  const { data: menus = [], error, isFetching, isLoading } = useGetMenusQuery()
  const screens = useMemo(() => dedupeScreens(flattenMenuScreens(menus)), [menus])
  const matrixValue = useMemo(() => buildMatrixValue(screens, value, actions), [actions, screens, value])

  useEffect(() => {
    if (!screens.length) {
      return
    }

    if (serializeMatrixValue(value) === serializeMatrixValue(matrixValue)) {
      return
    }

    onChange(matrixValue)
  }, [matrixValue, onChange, screens.length, value])

  const handleAccessChange = (screen: PermissionScreen, nextType: CrudPermissionLevel) => {
    const currentEntry = matrixValue[screen.key]

    onChange({
      ...matrixValue,
      [screen.key]: {
        ...buildPermissionEntry(screen, currentEntry, actions),
        type: nextType,
        actions: normalizePermissionActions(currentEntry?.actions, nextType, actions),
      },
    })
  }

  const handleActionToggle = (screen: PermissionScreen, action: CrudPermissionAction, checked: boolean) => {
    const currentEntry = matrixValue[screen.key]
    const baseActions = currentEntry?.actions.filter(
      (currentAction) => currentAction !== action && currentAction !== 'View',
    ) ?? []
    const nextActions = checked ? [...baseActions, action] : baseActions

    onChange({
      ...matrixValue,
      [screen.key]: {
        ...buildPermissionEntry(screen, currentEntry, actions),
        type: 'Edit',
        actions: normalizePermissionActions(nextActions, 'Edit', actions),
      },
    })
  }

  if (error) {
    return (
      <Message
        severity="warn"
        text="Unable to load screens from menus for role permissions."
        className="w-full justify-start"
      />
    )
  }

  if (!screens.length && !isLoading && !isFetching) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
        No screens are available from the menus API.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <div className="grid gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)] md:grid-cols-[minmax(0,1.6fr)_13rem_minmax(0,1fr)]">
        <span>Screen</span>
        <span>Access</span>
        <span>Actions</span>
      </div>

      <div className="max-h-[24rem] overflow-y-auto">
        {screens.map((screen) => {
          const entry = matrixValue[screen.key]
          const Icon = resolveMenuIcon(screen.iconName)

          return (
            <div
              key={screen.key}
              className="grid gap-3 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1.6fr)_13rem_minmax(0,1fr)] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{screen.title}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {screen.parentTitle ? `${screen.parentTitle} • ` : ''}
                      {screen.route}
                    </p>
                  </div>
                </div>
              </div>

              <Dropdown
                value={entry.type}
                options={accessOptions}
                optionLabel="label"
                optionValue="value"
                disabled={disabled}
                className="w-full"
                onChange={(event) =>
                  handleAccessChange(screen, event.value as CrudPermissionLevel)
                }
              />

              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {actions.map((action) => (
                  <div key={`${screen.key}-${action}`} className="flex items-center gap-2">
                    <Checkbox
                      inputId={`${screen.key}-${action}`}
                      disabled={disabled || entry.type !== 'Edit'}
                      checked={entry.actions.includes(action)}
                      onChange={(event) =>
                        handleActionToggle(screen, action, Boolean(event.checked))
                      }
                    />
                    <label
                      htmlFor={`${screen.key}-${action}`}
                      className={cn(
                        'text-sm',
                        disabled || entry.type !== 'Edit' ? 'text-neutral-400' : 'text-neutral-700',
                      )}
                    >
                      {action}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FormPermissionsMatrix<TFieldValues extends FieldValues>({
  control,
  name,
  label,
  helperText,
  containerClassName,
  disabled = false,
  actions = defaultPermissionActions,
}: FormPermissionsMatrixProps<TFieldValues>) {
  const inputId = name.replaceAll('.', '-')

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn('flex min-w-0 flex-col gap-2', containerClassName)}>
          <div>
            <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]" htmlFor={inputId}>
              {label}
            </label>
            {helperText ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{helperText}</p> : null}
          </div>

          <div id={inputId}>
            <PermissionsMatrixInput
              value={field.value as CrudPermissionsValue | undefined}
              disabled={disabled}
              actions={actions}
              onChange={field.onChange}
            />
          </div>

          <p
            id={`${inputId}-message`}
            className={cn(
              'min-h-[1.125rem] px-0.5 pt-0.5 text-xs leading-[1.125rem]',
              fieldState.error ? 'text-red-600' : 'text-[var(--color-text-muted)]',
            )}
          >
            {fieldState.error?.message}
          </p>
        </div>
      )}
    />
  )
}
