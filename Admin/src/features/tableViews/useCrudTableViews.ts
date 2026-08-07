import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { useGetTableViewPreferenceQuery, useUpdateTableViewPreferenceMutation } from '@/services/api/endpoints/tableViewsApi'
import type { CrudTableColumn } from '@/types/crud'
import type { TableViewDefinition, TableViewPreference } from '@/types/tableView'
import { getApiErrorMessage } from '@/services/api/apiError'

interface ResolvedTableColumn<TItem> {
  column: CrudTableColumn<TItem>
  columnId: string
  header: string
  defaultVisible: boolean
  hideable: boolean
  reorderable: boolean
}

export interface CrudTableViewManagerColumn<TItem> extends ResolvedTableColumn<TItem> {
  visible: boolean
  disableVisibilityToggle: boolean
}

interface CrudTableViewOption {
  label: string
  value: string
}

interface UseCrudTableViewsOptions<TItem> {
  tableId: string
  columns: Array<CrudTableColumn<TItem>>
  enabled?: boolean
}

interface UpdateViewOptions {
  successMessage?: string
}

interface UseCrudTableViewsResult<TItem> {
  activeColumns: Array<CrudTableColumn<TItem>>
  activeViewId: string | null
  activeViewName: string
  managerColumns: Array<CrudTableViewManagerColumn<TItem>>
  viewOptions: CrudTableViewOption[]
  hasSavedViews: boolean
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  isUsingDefaultView: boolean
  saveState: 'idle' | 'saving' | 'error'
  selectView: (viewId: string) => void
  setColumnVisibility: (columnId: string, visible: boolean) => void
  reorderColumns: (columnIds: string[]) => void
  saveChanges: () => void
  createView: (name: string) => void
  renameActiveView: (name: string) => void
  deleteActiveView: () => void
  resetActiveView: () => void
}

const DEFAULT_VIEW_ID = 'default'
const DEFAULT_VIEW_NAME = 'Default'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function createColumnId<TItem>(column: CrudTableColumn<TItem>, index: number) {
  return slugify(
    String(
      column.tableViewId ??
        column.key ??
        column.field ??
        column.accessorKey ??
        column.sortField ??
        column.header ??
        `column-${index + 1}`,
    ),
  ) || `column-${index + 1}`
}

function createResolvedColumns<TItem>(columns: Array<CrudTableColumn<TItem>>) {
  const occurrenceCount = new Map<string, number>()

  return columns.map<ResolvedTableColumn<TItem>>((column, index) => {
    const baseId = createColumnId(column, index)
    const nextOccurrence = (occurrenceCount.get(baseId) ?? 0) + 1
    occurrenceCount.set(baseId, nextOccurrence)

    return {
      column,
      columnId: nextOccurrence === 1 ? baseId : `${baseId}-${nextOccurrence}`,
      header: column.header,
      defaultVisible: column.defaultVisible ?? true,
      hideable: column.hideable ?? true,
      reorderable: column.reorderable ?? true,
    }
  })
}

function dedupe(values: string[]) {
  return values.filter((value, index) => values.indexOf(value) === index)
}

function createDefaultView<TItem>(columns: Array<ResolvedTableColumn<TItem>>): TableViewDefinition {
  const columnOrder = columns.map((column) => column.columnId)

  return {
    id: DEFAULT_VIEW_ID,
    name: DEFAULT_VIEW_NAME,
    columnOrder,
    columns: columns.map((column) => ({
      columnId: column.columnId,
      visible: column.defaultVisible,
    })),
  }
}

function normalizeView<TItem>(
  view: TableViewDefinition,
  columns: Array<ResolvedTableColumn<TItem>>,
): TableViewDefinition {
  const validIds = new Set(columns.map((column) => column.columnId))
  const defaultVisibility = new Map(columns.map((column) => [column.columnId, column.defaultVisible]))
  const requestedVisibility = new Map(
    view.columns
      .filter((column) => validIds.has(column.columnId))
      .map((column) => [column.columnId, column.visible]),
  )

  const normalizedOrder = dedupe([
    ...view.columnOrder.filter((columnId) => validIds.has(columnId)),
    ...columns.map((column) => column.columnId),
  ])

  const normalizedColumns = normalizedOrder.map((columnId) => ({
    columnId,
    visible: requestedVisibility.get(columnId) ?? defaultVisibility.get(columnId) ?? true,
  }))

  if (!normalizedColumns.some((column) => column.visible) && normalizedColumns[0]) {
    normalizedColumns[0].visible = true
  }

  return {
    id: view.id.trim(),
    name: view.name.trim() || DEFAULT_VIEW_NAME,
    columnOrder: normalizedOrder,
    columns: normalizedColumns,
  }
}

function normalizePreference<TItem>(
  preference: TableViewPreference | null | undefined,
  tableId: string,
  columns: Array<ResolvedTableColumn<TItem>>,
): TableViewPreference {
  if (!preference) {
    return {
      tableId,
      activeViewId: null,
      views: [],
    }
  }

  const viewsById = new Map<string, TableViewDefinition>()

  for (const view of preference.views) {
    const viewId = view.id.trim()

    if (!viewId || viewsById.has(viewId)) {
      continue
    }

    viewsById.set(viewId, normalizeView(view, columns))
  }

  const views = Array.from(viewsById.values())
  const activeViewId = views.some((view) => view.id === preference.activeViewId)
    ? preference.activeViewId
    : (views[0]?.id ?? null)

  return {
    tableId,
    activeViewId,
    views,
  }
}

function createPersistedDefaultPreference<TItem>(
  tableId: string,
  columns: Array<ResolvedTableColumn<TItem>>,
): TableViewPreference {
  const defaultView = createDefaultView(columns)

  return {
    tableId,
    activeViewId: defaultView.id,
    views: [defaultView],
  }
}

function replaceView(
  preference: TableViewPreference,
  updatedView: TableViewDefinition,
): TableViewPreference {
  return {
    ...preference,
    views: preference.views.map((view) => (view.id === updatedView.id ? updatedView : view)),
  }
}

function createViewId(name: string) {
  const base = slugify(name) || 'view'
  return `${base}-${Date.now()}`
}

function arePreferencesEqual(first: TableViewPreference, second: TableViewPreference) {
  return JSON.stringify(first) === JSON.stringify(second)
}

export function useCrudTableViews<TItem>({
  tableId,
  columns,
  enabled = true,
}: UseCrudTableViewsOptions<TItem>): UseCrudTableViewsResult<TItem> {
  const { showToast } = useToast()
  const resolvedColumns = useMemo(() => createResolvedColumns(columns), [columns])
  const defaultView = useMemo(() => createDefaultView(resolvedColumns), [resolvedColumns])

  // The last preference successfully synced with the server.
  const [syncedPreference, setSyncedPreference] = useState<TableViewPreference>(() =>
    normalizePreference(null, tableId, resolvedColumns),
  )
  // Local working copy — modified instantly without API calls.
  const [localPreference, setLocalPreference] = useState<TableViewPreference>(() =>
    normalizePreference(null, tableId, resolvedColumns),
  )

  const persistQueueRef = useRef(Promise.resolve())
  const { data, isFetching, isLoading, refetch } = useGetTableViewPreferenceQuery(tableId, {
    skip: !enabled,
  })
  const [updatePreference, updatePreferenceState] = useUpdateTableViewPreferenceMutation()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')

  // When server data arrives, sync both synced + local state.
  useEffect(() => {
    const normalized = normalizePreference(data, tableId, resolvedColumns)
    setSyncedPreference(normalized)
    setLocalPreference(normalized)
    setSaveState('idle')
  }, [data, resolvedColumns, tableId])

  // Whether the local working copy differs from the last saved copy.
  const isDirty = !arePreferencesEqual(localPreference, syncedPreference)

  // ── Local-only update (no API) ──────────────────────────────────────────────
  const updateLocalPreference = useCallback((nextPreference: TableViewPreference) => {
    setLocalPreference(nextPreference)
  }, [])

  // ── Explicit persist (API call) ─────────────────────────────────────────────
  const persistPreference = useCallback(
    (nextPreference: TableViewPreference, options?: UpdateViewOptions) => {
      setLocalPreference(nextPreference)
      setSaveState('saving')

      persistQueueRef.current = persistQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const savedPreference = await updatePreference({
              tableId,
              data: {
                activeViewId: nextPreference.activeViewId,
                views: nextPreference.views,
              },
            }).unwrap()

            const normalizedSaved = normalizePreference(savedPreference, tableId, resolvedColumns)
            setSyncedPreference(normalizedSaved)
            setLocalPreference((current) =>
              arePreferencesEqual(current, nextPreference) ? normalizedSaved : current,
            )
            setSaveState('idle')

            if (options?.successMessage) {
              showToast({
                severity: 'success',
                summary: 'Saved',
                detail: options.successMessage,
              })
            }
          } catch (error) {
            // Roll back local state to last known good.
            setSyncedPreference((prev) => {
              setLocalPreference(prev)
              return prev
            })
            setSaveState('error')
            showToast({
              severity: 'error',
              summary: 'Table view failed',
              detail: getApiErrorMessage(error),
            })
            refetch()
          }
        })
    },
    [refetch, resolvedColumns, showToast, tableId, updatePreference],
  )

  // ── Derived view state from local preference ────────────────────────────────
  const activeView = useMemo(
    () => localPreference.views.find((view) => view.id === localPreference.activeViewId) ?? null,
    [localPreference.activeViewId, localPreference.views],
  )
  const currentView = activeView ?? defaultView
  const visibilityMap = useMemo(
    () => new Map(currentView.columns.map((column) => [column.columnId, column.visible])),
    [currentView.columns],
  )
  const orderedResolvedColumns = useMemo(() => {
    const columnMap = new Map(resolvedColumns.map((column) => [column.columnId, column]))

    return currentView.columnOrder
      .map((columnId) => columnMap.get(columnId))
      .filter((column): column is ResolvedTableColumn<TItem> => Boolean(column))
  }, [currentView.columnOrder, resolvedColumns])

  const visibleColumnCount = useMemo(
    () => currentView.columns.filter((column) => column.visible).length,
    [currentView.columns],
  )

  const managerColumns = useMemo(
    () =>
      orderedResolvedColumns.map((column) => ({
        ...column,
        visible: visibilityMap.get(column.columnId) ?? column.defaultVisible,
        disableVisibilityToggle:
          !column.hideable ||
          (visibleColumnCount === 1 && (visibilityMap.get(column.columnId) ?? column.defaultVisible)),
      })),
    [orderedResolvedColumns, visibilityMap, visibleColumnCount],
  )

  // activeColumns are driven by the SYNCED preference (table itself only changes on save)
  const syncedActiveView = useMemo(
    () => syncedPreference.views.find((view) => view.id === syncedPreference.activeViewId) ?? null,
    [syncedPreference],
  )
  const syncedCurrentView = syncedActiveView ?? defaultView
  const syncedVisibilityMap = useMemo(
    () => new Map(syncedCurrentView.columns.map((c) => [c.columnId, c.visible])),
    [syncedCurrentView.columns],
  )
  const syncedOrderedColumns = useMemo(() => {
    const columnMap = new Map(resolvedColumns.map((c) => [c.columnId, c]))
    return syncedCurrentView.columnOrder
      .map((columnId) => columnMap.get(columnId))
      .filter((c): c is ResolvedTableColumn<TItem> => Boolean(c))
  }, [syncedCurrentView.columnOrder, resolvedColumns])

  const activeColumns = useMemo(
    () =>
      syncedOrderedColumns
        .filter((c) => syncedVisibilityMap.get(c.columnId) ?? c.defaultVisible)
        .map((c) => c.column),
    [syncedOrderedColumns, syncedVisibilityMap],
  )

  const viewOptions = useMemo(
    () => localPreference.views.map((view) => ({ label: view.name, value: view.id })),
    [localPreference.views],
  )

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const withPersistedActiveView = useCallback(() => {
    if (localPreference.views.length > 0 && localPreference.activeViewId) {
      return localPreference
    }
    return createPersistedDefaultPreference(tableId, resolvedColumns)
  }, [localPreference, resolvedColumns, tableId])

  const updateActiveViewLocally = useCallback(
    (updater: (view: TableViewDefinition) => TableViewDefinition) => {
      const nextBasePreference = withPersistedActiveView()
      const nextActiveView =
        nextBasePreference.views.find((view) => view.id === nextBasePreference.activeViewId) ??
        nextBasePreference.views[0]

      if (!nextActiveView) return

      const updatedView = normalizeView(updater(nextActiveView), resolvedColumns)
      updateLocalPreference(replaceView(nextBasePreference, updatedView))
    },
    [resolvedColumns, updateLocalPreference, withPersistedActiveView],
  )

  // ── Public actions ──────────────────────────────────────────────────────────

  /** Switch active view — apply immediately using saved view data */
  const selectView = useCallback(
    (viewId: string) => {
      if (
        !localPreference.views.some((view) => view.id === viewId) ||
        localPreference.activeViewId === viewId
      ) {
        return
      }

      const persistedViewExists = syncedPreference.views.some((view) => view.id === viewId)

      if (!persistedViewExists) {
        updateLocalPreference({ ...localPreference, activeViewId: viewId })
        return
      }

      persistPreference({
        ...syncedPreference,
        activeViewId: viewId,
      })
    },
    [localPreference, persistPreference, syncedPreference, updateLocalPreference],
  )

  /** Toggle column visibility — local only, no API */
  const setColumnVisibility = useCallback(
    (columnId: string, visible: boolean) => {
      updateActiveViewLocally((view) => ({
        ...view,
        columns: view.columns.map((column) =>
          column.columnId === columnId ? { ...column, visible } : column,
        ),
      }))
    },
    [updateActiveViewLocally],
  )

  /** Reorder columns — local only, no API */
  const reorderColumns = useCallback(
    (columnIds: string[]) => {
      updateActiveViewLocally((view) => ({
        ...view,
        columnOrder: dedupe([
          ...columnIds.filter((columnId) => view.columnOrder.includes(columnId)),
          ...view.columnOrder,
        ]),
      }))
    },
    [updateActiveViewLocally],
  )

  /** Explicitly persist all pending local changes — triggers the API */
  const saveChanges = useCallback(() => {
    if (!isDirty) return

    // If user has made changes but there's no saved view yet, auto-upgrade to a named view
    const preferenceToSave =
      localPreference.views.length > 0 && localPreference.activeViewId
        ? localPreference
        : (() => {
            const p = createPersistedDefaultPreference(tableId, resolvedColumns)
            return normalizePreference(
              {
                ...p,
                activeViewId: p.views[0]?.id ?? null,
                views: p.views.map((v) =>
                  v.id === p.views[0]?.id
                    ? normalizeView({ ...v, ...localPreference }, resolvedColumns)
                    : v,
                ),
              },
              tableId,
              resolvedColumns,
            )
          })()

    persistPreference(preferenceToSave, { successMessage: 'Table view saved.' })
  }, [isDirty, localPreference, persistPreference, resolvedColumns, tableId])

  /** Create a brand-new named view and immediately persist */
  const createView = useCallback(
    (name: string) => {
      const trimmedName = name.trim()

      if (!trimmedName) {
        showToast({
          severity: 'warn',
          summary: 'View name required',
          detail: 'Enter a name before saving a new table view.',
        })
        return
      }

      const sourcePreference =
        localPreference.views.length > 0
          ? localPreference
          : createPersistedDefaultPreference(tableId, resolvedColumns)
      const sourceView =
        sourcePreference.views.find((view) => view.id === sourcePreference.activeViewId) ??
        sourcePreference.views[0] ??
        createDefaultView(resolvedColumns)

      const nextView: TableViewDefinition = {
        ...sourceView,
        id: createViewId(trimmedName),
        name: trimmedName,
      }

      const nextPreference = normalizePreference(
        {
          tableId,
          activeViewId: nextView.id,
          views: [...sourcePreference.views, nextView],
        },
        tableId,
        resolvedColumns,
      )

      persistPreference(nextPreference, { successMessage: `${trimmedName} saved.` })
    },
    [localPreference, persistPreference, resolvedColumns, showToast, tableId],
  )

  /** Rename current view and immediately persist */
  const renameActiveView = useCallback(
    (name: string) => {
      const trimmedName = name.trim()

      if (!trimmedName || !activeView) return

      persistPreference(
        replaceView(localPreference, { ...activeView, name: trimmedName }),
        { successMessage: 'Table view renamed.' },
      )
    },
    [activeView, localPreference, persistPreference],
  )

  /** Delete active view and immediately persist */
  const deleteActiveView = useCallback(() => {
    if (!activeView) return

    const remainingViews = localPreference.views.filter((view) => view.id !== activeView.id)

    persistPreference(
      {
        tableId,
        activeViewId: remainingViews[0]?.id ?? null,
        views: remainingViews,
      },
      { successMessage: 'Table view deleted.' },
    )
  }, [activeView, localPreference, persistPreference, tableId])

  /** Reset active view to default layout locally; user must save to persist */
  const resetActiveView = useCallback(() => {
    if (!activeView) return

    updateLocalPreference(
      replaceView(localPreference, {
        ...activeView,
        columnOrder: defaultView.columnOrder,
        columns: defaultView.columns,
      }),
    )
  }, [activeView, defaultView.columnOrder, defaultView.columns, localPreference, updateLocalPreference])

  return {
    activeColumns,
    activeViewId: activeView?.id ?? null,
    activeViewName: activeView?.name ?? DEFAULT_VIEW_NAME,
    managerColumns,
    viewOptions,
    hasSavedViews: localPreference.views.length > 0,
    isLoading: enabled ? isLoading || (isFetching && !data) : false,
    isSaving: updatePreferenceState.isLoading || saveState === 'saving',
    isDirty,
    isUsingDefaultView: !activeView,
    saveState,
    selectView,
    setColumnVisibility,
    reorderColumns,
    saveChanges,
    createView,
    renameActiveView,
    deleteActiveView,
    resetActiveView,
  }
}
