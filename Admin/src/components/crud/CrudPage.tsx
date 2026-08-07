import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FieldValues } from 'react-hook-form'
import { ArrowLeft, Download, Eye, FilterX, Info, Pencil, Plus, RefreshCw, Search, Trash2, Upload } from 'lucide-react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dialog } from 'primereact/dialog'

import { Paginator } from 'primereact/paginator'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CommonGrid } from './CommonGrid'
import { CommonForm } from './CommonForm'
import { CommonTable } from './CommonTable'
import { CrudTableViewManager } from './CrudTableViewManager'
import { CrudViewToggle } from './CrudViewToggle'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { ScreenHelpButton } from '@/components/ui/ScreenHelpButton'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useCrudTableViews } from '@/features/tableViews/useCrudTableViews'
import { useAppSelector } from '@/hooks/redux'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import { formatDateTime } from '@/utils/date'
import type { EntityId } from '@/types/common'
import type {
  CrudListQuery,
  CrudMutationState,
  CrudMutationTrigger,
  CrudFormField,
  CrudPageConfig,
  CrudPageState,
  CrudSelectOption,
  CrudTableAction,
  CrudTableColumn,
  CrudViewMode,
} from '@/types/crud'
import { hasModuleAccess, hasModuleAction } from '@/utils/permissions'

type DialogMode = 'create' | 'edit' | 'view' | null

interface CrudPageProps<
  TItem,
  TFormValues extends FieldValues,
  TCreatePayload,
  TUpdatePayload,
  TBulkDeletePayload = unknown,
  TBulkDeleteResult = unknown,
> {
  config: CrudPageConfig<
    TItem,
    TFormValues,
    TCreatePayload,
    TUpdatePayload,
    TBulkDeletePayload,
    TBulkDeleteResult
  >
}

function createDisabledBulkDeleteMutation<TPayload, TResult>() {
  const trigger: CrudMutationTrigger<TPayload, TResult> = () => ({
    unwrap: async () => undefined as TResult,
  })

  const state: CrudMutationState = {
    isLoading: false,
    error: undefined,
  }

  return [trigger, state] as const
}

function createDisabledCreateMutation<TPayload, TResult>() {
  const trigger: CrudMutationTrigger<TPayload, TResult> = () => ({
    unwrap: async () => {
      throw new Error('Create is not available for this resource.')
    },
  })

  const state: CrudMutationState = {
    isLoading: false,
    error: undefined,
  }

  return [trigger, state] as const
}

function createDisabledUpdateMutation<TPayload, TResult>() {
  const trigger: CrudMutationTrigger<TPayload, TResult> = () => ({
    unwrap: async () => {
      throw new Error('Update is not available for this resource.')
    },
  })

  const state: CrudMutationState = {
    isLoading: false,
    error: undefined,
  }

  return [trigger, state] as const
}

function createDisabledDeleteMutation<TResult>() {
  const trigger: CrudMutationTrigger<EntityId, TResult> = () => ({
    unwrap: async () => {
      throw new Error('Delete is not available for this resource.')
    },
  })

  const state: CrudMutationState = {
    isLoading: false,
    error: undefined,
  }

  return [trigger, state] as const
}

function sanitizeFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'
}

function formatCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  const textValue = String(value)
  return `"${textValue.replace(/"/g, '""')}"`
}

function getColumnExportValue<TItem>(item: TItem, column: CrudTableColumn<TItem>) {
  if (column.exportValue) {
    return column.exportValue(item)
  }

  if (column.field) {
    return item[column.field]
  }

  return ''
}

const RCM_CRUD_MODULES = new Set([
  'Patients',
  'adjustments',
  'appeals',
  'appointments',
  'ar-work-items',
  'audit-logs',
  'charge-masters',
  'charges',
  'claim-ai-reviews',
  'claim-predictions',
  'claim-submissions',
  'claim-trackings',
  'claims',
  'coding-reviews',
  'collections',
  'corrected-claims',
  'coverage-rules',
  'denials',
  'documents',
  'eligibility-verifications',
  'encounters',
  'era-eob-processings',
  'facilities',
  'fee-schedules',
  'insurance-policies',
  'patient-billings',
  'patient-payments',
  'payment-postings',
  'payers',
  'prior-authorizations',
  'procedure-codes',
  'providers',
  'referrals',
  'refunds',
  'reports',
  'rules',
  'tasks',
])

function isRcmCrudModule(module?: string) {
  return Boolean(module && RCM_CRUD_MODULES.has(module))
}

function isSuperAdminUser(user: { roles?: string[] } | null | undefined) {
  return Boolean(user?.roles?.some((role) => role.trim().toUpperCase() === 'SUPER_ADMIN'))
}

function getCreatedValue(item: unknown) {
  if (!item || typeof item !== 'object') {
    return undefined
  }

  const record = item as Record<string, unknown>
  return record.createdAt ?? record.created
}

function hasCreatedColumn<TItem>(columns: Array<CrudTableColumn<TItem>>) {
  return columns.some((column) => {
    const key = String(column.key ?? column.field ?? column.accessorKey ?? column.sortField ?? '').toLowerCase()
    return key === 'created' || key === 'createdat'
  })
}

function withCreatedColumn<TItem>(columns: Array<CrudTableColumn<TItem>>, enabled: boolean) {
  if (!enabled || hasCreatedColumn(columns)) {
    return columns
  }

  return [
    ...columns,
    {
      key: 'created',
      header: 'Created',
      sortField: 'created',
      sortable: true,
      exportValue: (item: TItem) => formatDateTime(getCreatedValue(item) as string | Date | null | undefined),
      render: (item: TItem) => formatDateTime(getCreatedValue(item) as string | Date | null | undefined),
    },
  ]
}

function getStaticOptions<TValues extends FieldValues>(field?: CrudFormField<TValues>): CrudSelectOption[] | undefined {
  return Array.isArray(field?.options) ? field.options : undefined
}

function isDateLikeField(fieldName: string) {
  return /(date|time|deadline|due|created|updated|submitted|received|effective|termination|expires|expired|at)$/i.test(fieldName)
}

function isNumberLikeField(fieldName: string) {
  return /(amount|balance|total|count|days|rate|score|percent|percentage|sequence|version|units|age|quantity|limit)$/i.test(fieldName)
}

function inferMarkedColumnFilter<TItem, TValues extends FieldValues>(
  column: CrudTableColumn<TItem>,
  formFields: Array<CrudFormField<TValues>>,
): CrudTableColumn<TItem>['filter'] | undefined {
  if (column.filter) {
    return column.filter
  }

  if (column.filterable !== true) {
    return undefined
  }

  const fieldName = String(column.field ?? column.accessorKey ?? column.sortField ?? column.key ?? '')

  if (!fieldName || fieldName === 'actions') {
    return undefined
  }

  const formField = formFields.find((field) => String(field.name) === fieldName)
  const options = getStaticOptions(formField)
  const base = {
    key: fieldName,
    placeholder: `Filter ${column.header}`,
  }

  if (formField?.type === 'date' || formField?.type === 'time' || isDateLikeField(fieldName)) {
    return { ...base, input: 'date', type: 'dateis' }
  }

  if (formField?.type === 'number' || isNumberLikeField(fieldName)) {
    return { ...base, input: 'number', type: 'eq' }
  }

  if (formField?.type === 'checkbox' || formField?.type === 'switch' || typeof options?.[0]?.value === 'boolean') {
    return {
      ...base,
      input: 'select',
      type: 'eq',
      options: options ?? [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    }
  }

  if ((formField?.type === 'select' || formField?.type === 'autocomplete') && options?.length) {
    return { ...base, input: 'select', type: 'eq', options }
  }

  if ((formField?.type === 'multiSelect' || formField?.type === 'chips' || formField?.type === 'tags') && options?.length) {
    return { ...base, input: 'multiSelect', type: 'in', options }
  }

  return { ...base, input: 'text', type: 'contains' }
}

function withMarkedFilters<TItem, TValues extends FieldValues>(
  columns: Array<CrudTableColumn<TItem>>,
  formFields: Array<CrudFormField<TValues>>,
) {
  return columns.map((column) => ({
    ...column,
    filter: inferMarkedColumnFilter(column, formFields),
  }))
}

function serializeQueryValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  return JSON.stringify(value)
}

function areCrudQueriesEqual(first: CrudListQuery, second: CrudListQuery) {
  return (
    first.page === second.page &&
    first.limit === second.limit &&
    first.sortfield === second.sortfield &&
    first.direction === second.direction &&
    first.dashboardQueue === second.dashboardQueue &&
    first.dashboardEntityId === second.dashboardEntityId &&
    first.dashboardFilter === second.dashboardFilter &&
    serializeQueryValue(first.globalSearch) === serializeQueryValue(second.globalSearch) &&
    serializeQueryValue(first.criteria) === serializeQueryValue(second.criteria)
  )
}

export function CrudPage<
  TItem,
  TFormValues extends FieldValues,
  TCreatePayload,
  TUpdatePayload,
  TBulkDeletePayload = unknown,
  TBulkDeleteResult = unknown,
>({
  config,
}: CrudPageProps<
  TItem,
  TFormValues,
  TCreatePayload,
  TUpdatePayload,
  TBulkDeletePayload,
  TBulkDeleteResult
>) {
  const [mode, setMode] = useState<DialogMode>(null)
  const [selectedItem, setSelectedItem] = useState<TItem | null>(null)
  const [selectedItems, setSelectedItems] = useState<TItem[]>([])
  const [deleteItemId, setDeleteItemId] = useState<EntityId | null>(null)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [filterResetKey, setFilterResetKey] = useState(0)
  const [tableRenderVersion, setTableRenderVersion] = useState(0)
  const [actionRenderVersion, setActionRenderVersion] = useState(0)
  const previousTableColumnsRef = useRef(config.table.columns)
  const previousRowActionsRef = useRef(config.slots?.rowActions)
  const [viewMode, setViewMode] = useState<CrudViewMode>(config.defaultViewMode ?? 'list')
  const { showToast } = useToast()
  const currentUser = useAppSelector(selectCurrentUser)
  const useRcmCreatedSort = isRcmCrudModule(config.permissions?.module)
  const [query, setQuery] = useState<CrudListQuery>(() => ({
    page: config.defaultQuery?.page ?? 1,
    limit: config.defaultQuery?.limit ?? 20,
    sortfield: useRcmCreatedSort ? 'created' : config.defaultQuery?.sortfield,
    direction: useRcmCreatedSort ? 'desc' : config.defaultQuery?.direction ?? 'desc',
    criteria: config.defaultQuery?.criteria ?? [],
    dashboardQueue: config.defaultQuery?.dashboardQueue,
    dashboardEntityId: config.defaultQuery?.dashboardEntityId,
  }))

  const [globalSearchValue, setGlobalSearchValue] = useState(query.globalSearch?.value ?? '')
  const navigate = useNavigate()
  const location = useLocation()
  const routeSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const dashboardReturnTo =
    routeSearchParams.get('returnTo')?.trim() ||
    (routeSearchParams.get('dashboardQueue')?.trim() ? '/rcm/dashboard' : '')
  const dashboardReturnLabel =
    routeSearchParams.get('returnLabel')?.trim() ||
    (routeSearchParams.get('dashboardQueue')?.trim() ? 'Back to Dashboard' : 'Back')

  useEffect(() => {
    const handler = setTimeout(() => {
      setQuery((current) => {
        if (current.globalSearch?.value === globalSearchValue) return current
        return {
          ...current,
          page: 1,
          globalSearch: globalSearchValue ? { type: 'all', value: globalSearchValue } : undefined,
        }
      })
    }, 500)
    return () => clearTimeout(handler)
  }, [globalSearchValue])

  const setQueryIfChanged = useCallback((nextQuery: CrudListQuery) => {
    setQuery((currentQuery) => (
      areCrudQueriesEqual(currentQuery, nextQuery) ? currentQuery : nextQuery
    ))
  }, [])

  const permissionModule = config.permissions?.module
  const resourceName = config.resourceName ?? 'record'
  const hasSuperAdminAccess = isSuperAdminUser(currentUser)
  const canViewPage = permissionModule
    ? hasSuperAdminAccess || hasModuleAccess(currentUser?.permissions, permissionModule)
    : true
  const canCreate = Boolean(config.api.useCreateMutation) && (permissionModule
    ? hasSuperAdminAccess || hasModuleAction(currentUser?.permissions, permissionModule, 'Add')
    : true)
  const canUpdate = Boolean(config.api.useUpdateMutation) && (permissionModule
    ? hasSuperAdminAccess || hasModuleAction(currentUser?.permissions, permissionModule, 'Update')
    : true)
  const canDelete = Boolean(config.api.useDeleteMutation) && (permissionModule
    ? hasSuperAdminAccess || hasModuleAction(currentUser?.permissions, permissionModule, 'Delete')
    : true)

  const listResult = config.api.useListQuery(query, { skip: !canViewPage })
  const [createItem, createState] = config.api.useCreateMutation
    ? config.api.useCreateMutation()
    : createDisabledCreateMutation<TCreatePayload, TItem>()
  const [updateItem, updateState] = config.api.useUpdateMutation
    ? config.api.useUpdateMutation()
    : createDisabledUpdateMutation<{ id: EntityId; data: TUpdatePayload }, TItem>()
  const [deleteItem, deleteState] = config.api.useDeleteMutation
    ? config.api.useDeleteMutation()
    : createDisabledDeleteMutation<EntityId>()
  const [bulkDeleteItems, bulkDeleteState] = config.api.useBulkDeleteMutation
    ? config.api.useBulkDeleteMutation()
    : createDisabledBulkDeleteMutation<TBulkDeletePayload, TBulkDeleteResult>()

  const items = useMemo(() => listResult.data?.data ?? [], [listResult.data])
  const totalRecords = listResult.data?.total ?? items.length
  const activeDeleteItem = items.find((item) => config.getRowId(item) === deleteItemId) ?? null
  const listError = listResult.error
  const pageSizeOptions = config.pageSizeOptions ?? [10, 20, 50]
  const hasFilters = query.criteria.length > 0 || Boolean(query.globalSearch?.value)
  const showDashboardReturnButton = Boolean(dashboardReturnTo && !config.slots?.beforeContent)
  const canBulkDelete = Boolean(config.bulkDelete && config.api.useBulkDeleteMutation && canDelete)
  // Sentinel column that makes "Actions" appear in the view manager.
  // It is never rendered by CommonTable directly — its visibility controls the
  // showActions prop instead. We derive this from permission flags directly
  // (defaultRowActions is defined later so can't be referenced here).
  const hasRowActions = canViewPage || canUpdate || canDelete
  const actionsColumn = useMemo(
    () =>
      hasRowActions
        ? [{
            key: 'actions' as const,
            tableViewId: 'actions',
            header: 'Actions',
            hideable: true,
            reorderable: false,
            defaultVisible: true,
            exportable: false,
          } as CrudTableColumn<TItem>]
        : [] as CrudTableColumn<TItem>[],
    [hasRowActions],
  )
  const tableColumns = useMemo(
    () => [
      ...withMarkedFilters(withCreatedColumn(config.table.columns, useRcmCreatedSort), config.form.fields),
      ...actionsColumn,
    ],
    [actionsColumn, config.form.fields, config.table.columns, useRcmCreatedSort],
  )
  const resolvedTableId = useMemo(
    () => config.table.tableId ?? config.permissions?.module ?? location.pathname,
    [config.permissions?.module, config.table.tableId, location.pathname],
  )
  const tableViews = useCrudTableViews({
    tableId: resolvedTableId,
    columns: tableColumns,
    enabled: config.table.enableSavedViews !== false,
  })
  // Strip the sentinel before passing columns to the actual table renderer
  const activeTableColumnsRaw = config.table.enableSavedViews === false ? tableColumns : tableViews.activeColumns
  const showActionsColumn = hasRowActions && activeTableColumnsRaw.some((c) => (c.key ?? c.tableViewId) === 'actions')
  const activeTableColumns = activeTableColumnsRaw.filter((c) => (c.key ?? c.tableViewId) !== 'actions')
  const activeTableViewKey = useMemo(
    () =>
      activeTableColumnsRaw
        .map((column) => String(column.tableViewId ?? column.key ?? column.field ?? column.accessorKey ?? column.header))
        .join('|'),
    [activeTableColumnsRaw],
  )

  useEffect(() => {
    if (listError) {
      showToast({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(listError),
      })
    }
  }, [listError, showToast])

  useEffect(() => {
    if (previousTableColumnsRef.current === config.table.columns) {
      return
    }

    previousTableColumnsRef.current = config.table.columns
    setTableRenderVersion((currentVersion) => currentVersion + 1)
  }, [config.table.columns])

  useEffect(() => {
    if (previousRowActionsRef.current === config.slots?.rowActions) {
      return
    }

    previousRowActionsRef.current = config.slots?.rowActions
    setActionRenderVersion((currentVersion) => currentVersion + 1)
  }, [config.slots?.rowActions])

  const closeDialog = () => {
    setMode(null)
    setSelectedItem(null)
  }

  const openCreateDialog = () => {
    setSelectedItem(null)
    setMode('create')
  }

  const openEditDialog = (item: TItem) => {
    setSelectedItem(item)
    setMode('edit')
  }

  const openViewDialog = (item: TItem) => {
    setSelectedItem(item)
    setMode('view')
  }

  const openDeleteDialog = (item: TItem) => {
    setDeleteItemId(config.getRowId(item))
  }

  const handleSubmit = async (values: TFormValues) => {
    try {
      if (mode === 'edit' && selectedItem) {
        await updateItem({
          id: config.getRowId(selectedItem),
          data: config.mapFormValuesToUpdatePayload(values, selectedItem),
        }).unwrap()
        showToast({
          severity: 'success',
          summary: 'Success',
          detail: `${config.getRowLabel(selectedItem)} updated successfully.`,
        })
        closeDialog()
        return
      }

      const createdItem = await createItem(config.mapFormValuesToCreatePayload(values)).unwrap()
      showToast({
        severity: 'success',
        summary: 'Success',
        detail: `${config.getRowLabel(createdItem)} created successfully.`,
      })
      closeDialog()
    } catch (error) {
      showToast({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error),
      })
    }
  }

  const confirmDelete = async () => {
    if (deleteItemId === null) {
      return
    }

    try {
      await deleteItem(deleteItemId).unwrap()
      showToast({
        severity: 'success',
        summary: 'Success',
        detail: 'Record deleted successfully.',
      })
      setSelectedItems((currentItems) =>
        currentItems.filter((item) => config.getRowId(item) !== deleteItemId),
      )
      setDeleteItemId(null)
    } catch (error) {
      showToast({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error),
      })
    }
  }

  const confirmBulkDelete = async () => {
    if (!config.bulkDelete || !selectedItems.length) {
      return
    }

    try {
      await bulkDeleteItems(config.bulkDelete.mapSelectedItemsToPayload(selectedItems)).unwrap()
      showToast({
        severity: 'success',
        summary: 'Success',
        detail: config.bulkDelete.successMessage?.(selectedItems) ??
          `${selectedItems.length} ${selectedItems.length === 1 ? resourceName : `${resourceName}s`} deleted successfully.`,
      })
      setSelectedItems([])
      setIsBulkDeleteDialogOpen(false)
    } catch (error) {
      showToast({
        severity: 'error',
        summary: 'Error',
        detail: getApiErrorMessage(error),
      })
    }
  }

  const handlePageChange = (event: { first: number; rows: number }) => {
    setSelectedItems([])
    setQuery((currentQuery) => {
      const nextQuery = {
        ...currentQuery,
        page: Math.floor(event.first / event.rows) + 1,
        limit: event.rows,
      }

      return areCrudQueriesEqual(currentQuery, nextQuery) ? currentQuery : nextQuery
    })
  }

  const clearAllFilters = () => {
    setSelectedItems([])
    setFilterResetKey((currentKey) => currentKey + 1)
    setGlobalSearchValue('')
    setQuery((currentQuery) => {
      const nextQuery = {
        ...currentQuery,
        page: 1,
        sortfield: useRcmCreatedSort ? 'created' : config.defaultQuery?.sortfield,
        direction: useRcmCreatedSort ? 'desc' : config.defaultQuery?.direction ?? 'desc',
        globalSearch: undefined,
        criteria: config.defaultQuery?.criteria ?? [],
        dashboardQueue: config.defaultQuery?.dashboardQueue,
        dashboardEntityId: config.defaultQuery?.dashboardEntityId,
      }

      return areCrudQueriesEqual(currentQuery, nextQuery) ? currentQuery : nextQuery
    })
  }

  const exportCurrentRows = () => {
    if (!items.length || typeof document === 'undefined') {
      return
    }

    const exportColumns = activeTableColumns.filter((column) => column.exportable !== false)
    const csvRows = [
      exportColumns.map((column) => formatCsvValue(column.header)).join(','),
      ...items.map((item) =>
        exportColumns
          .map((column) => formatCsvValue(getColumnExportValue(item, column)))
          .join(','),
      ),
    ]
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = objectUrl
    link.download = `${sanitizeFileName(config.exportFileName ?? config.title)}.csv`
    link.click()
    URL.revokeObjectURL(objectUrl)
  }

  const pageState: CrudPageState<TItem> = {
    items,
    totalRecords,
    query,
    setQuery: setQueryIfChanged,
    selectedItems,
    setSelectedItems,
    openCreateDialog,
    openViewDialog,
    openEditDialog,
    openDeleteDialog,
    refetch: listResult.refetch,
  }

  const defaultRowActions: Array<CrudTableAction<TItem>> = [
    ...(canViewPage
      ? [
        {
          label: `View ${resourceName}`,
          icon: <Eye className="h-4 w-4" aria-hidden="true" />,
          onClick: openViewDialog,
        },
      ]
      : []),
    ...(canUpdate
      ? [
        {
          label: `Edit ${resourceName}`,
          icon: <Pencil className="h-4 w-4" aria-hidden="true" />,
          onClick: openEditDialog,
        },
      ]
      : []),
    ...(canDelete
      ? [
        {
          label: `Delete ${resourceName}`,
          icon: <Trash2 className="h-4 w-4" aria-hidden="true" />,
          tone: 'danger' as const,
          onClick: openDeleteDialog,
        },
      ]
      : []),
  ]

  const getRowActions = (item: TItem) =>
    config.slots?.rowActions?.(item, defaultRowActions) ?? defaultRowActions
  const actionRenderKey = `${actionRenderVersion}:${canViewPage ? 1 : 0}:${canUpdate ? 1 : 0}:${canDelete ? 1 : 0}:${resourceName}`
  const contentRenderKey = `${filterResetKey}:${tableRenderVersion}:${actionRenderKey}:${activeTableViewKey}`

  const resolvedFormDialogWidth =
    config.style?.formDialogWidth ??
    (config.form.columns === 3 ? 'min(98vw, 88rem)' : 'min(96vw, 54rem)')

  if (!canViewPage) {
    return <Navigate to="/forbidden" replace />
  }

  const viewContent = selectedItem ? (
    config.slots?.viewContent ? (
      config.slots.viewContent(selectedItem)
    ) : (
      <dl className="grid gap-4 md:grid-cols-2">
        {tableColumns.map((column) => (
          <div key={String(column.key ?? column.field ?? column.accessorKey ?? column.header)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {column.header}
            </dt>
            <dd className="mt-2 text-sm font-medium text-[var(--color-text-strong)]">
              {column.render
                ? column.render(selectedItem)
                : column.cell
                  ? column.cell(
                      column.field || column.accessorKey
                        ? selectedItem[column.field ?? column.accessorKey as keyof TItem]
                        : undefined,
                      selectedItem,
                    )
                  : column.field || column.accessorKey
                    ? String(selectedItem[column.field ?? column.accessorKey as keyof TItem] ?? '-')
                    : '-'}
            </dd>
          </div>
        ))}
      </dl>
    )
  ) : null

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          {config.eyebrow ? (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              {config.eyebrow}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-[var(--color-text-strong)]">
              {config.title}
            </h1>
            {config.help ? (
              <ScreenHelpButton help={config.help}>
                {config.helpChildren}
              </ScreenHelpButton>
            ) : config.description ? (
              <span title={config.description} className="cursor-help">
                <Info
                  className="h-4 w-4 text-[var(--color-text-muted)]"
                  aria-hidden="true"
                />
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {totalRecords} total {config.title}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="crud-global-search relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <InputText
              value={globalSearchValue}
              onChange={(e) => setGlobalSearchValue(e.target.value)}
              placeholder="Search..."
              className="crud-global-search-input h-8 w-48 text-xs"
            />
          </div>

          {hasFilters ? (
            <Button
              type="button"
              label="Clear Filters"
              icon={<FilterX className="h-3.5 w-3.5" />}
              severity="danger"
              text
              className="flex items-center gap-1 h-8 px-3 text-xs font-semibold"
              onClick={clearAllFilters}
            />
          ) : null}

          <Button
            type="button"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            severity="secondary"
            outlined
            className="h-8 w-8 p-0"
            onClick={() => listResult.refetch()}
          />
          {config.table.enableSavedViews !== false ? (
            <CrudTableViewManager
              activeViewId={tableViews.activeViewId}
              activeViewName={tableViews.activeViewName}
              managerColumns={tableViews.managerColumns}
              viewOptions={tableViews.viewOptions}
              hasSavedViews={tableViews.hasSavedViews}
              isLoading={tableViews.isLoading}
              isSaving={tableViews.isSaving}
              isDirty={tableViews.isDirty}
              isUsingDefaultView={tableViews.isUsingDefaultView}
              saveState={tableViews.saveState}
              onSelectView={tableViews.selectView}
              onSetColumnVisibility={tableViews.setColumnVisibility}
              onReorderColumns={tableViews.reorderColumns}
              onSaveChanges={tableViews.saveChanges}
              onCreateView={tableViews.createView}
              onRenameActiveView={tableViews.renameActiveView}
              onDeleteActiveView={tableViews.deleteActiveView}
              onResetActiveView={tableViews.resetActiveView}
            />
          ) : null}
          <CrudViewToggle value={viewMode} onChange={setViewMode} />

          <div className="mx-1 h-4 w-px bg-[var(--color-border)]" />

          {canBulkDelete && selectedItems.length ? (
            <Button
              type="button"
              label={`${config.bulkDelete?.buttonLabel ?? 'Delete Selected'} (${selectedItems.length})`}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              severity="danger"
              outlined
              className="flex items-center gap-1 h-8 px-3 text-xs font-semibold"
              onClick={() => setIsBulkDeleteDialogOpen(true)}
            />
          ) : null}

          <Button
            type="button"
            label="Bulk Upload"
            icon={<Upload className="h-3.5 w-3.5" />}
            severity="secondary"
            outlined
            disabled={true}
            className="flex items-center gap-1 h-8 px-3 text-xs font-semibold"
          />
          <Button
            type="button"
            label="Export"
            icon={<Download className="h-3.5 w-3.5" />}
            severity="secondary"
            outlined
            disabled={!items.length}
            className="flex items-center gap-1 h-8 px-3 text-xs font-semibold"
            onClick={exportCurrentRows}
          />

          {canCreate && config.showCreateButton !== false ? (
            <Button
              type="button"
              label={config.createButtonLabel ?? `Add ${resourceName}`}
              icon={<Plus className="h-4 w-4" />}
              className="flex items-center gap-1 h-8 px-4 text-xs font-bold"
              onClick={openCreateDialog}
            />
          ) : null}

          {config.slots?.toolbarRight?.(pageState)}
        </div>
      </div>

      {showDashboardReturnButton ? (
        <div className="flex items-center">
          <Button
            type="button"
            label={dashboardReturnLabel}
            icon={<ArrowLeft className="h-3.5 w-3.5" />}
            className="rcm-navigation-button h-8 w-fit px-3 text-xs font-semibold"
            outlined
            onClick={() => navigate(dashboardReturnTo)}
          />
        </div>
      ) : null}

      {config.slots?.beforeContent?.(pageState)}

      {viewMode === 'list' ? (
        <section className="mt-2 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <CommonTable
            key={contentRenderKey}
            data={items}
            query={query}
            totalRecords={totalRecords}
            columns={activeTableColumnsRaw}
            getRowId={config.getRowId}
            onQueryChange={setQueryIfChanged}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            emptyMessage={config.emptyMessage}
            isLoading={listResult.isLoading || listResult.isFetching}
            actions={defaultRowActions}
            getActions={getRowActions}
            actionRenderKey={actionRenderKey}
            rowClassName={config.rowClassName}
            showActions={showActionsColumn}
          />
        </section>
      ) : (
        <section>
          <CommonGrid
            key={contentRenderKey}
            data={items}
            columns={tableColumns}
            getRowId={config.getRowId}
            getRowLabel={config.getRowLabel}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            emptyMessage={config.emptyMessage}
            isLoading={listResult.isLoading || listResult.isFetching}
            actions={defaultRowActions}
            getActions={getRowActions}
            actionRenderKey={actionRenderKey}
            renderItemContent={config.slots?.gridItem}
          />
        </section>
      )}

      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 shadow-sm">
        <div className="flex items-center gap-4">
          <Paginator
            first={(query.page - 1) * query.limit}
            rows={query.limit}
            totalRecords={totalRecords}
            rowsPerPageOptions={pageSizeOptions}
            template="CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first}-{last} of {totalRecords}"
            className="compact-paginator"
            onPageChange={handlePageChange}
          />
        </div>
        <Paginator
          first={(query.page - 1) * query.limit}
          rows={query.limit}
          totalRecords={totalRecords}
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
          className="compact-paginator"
          onPageChange={handlePageChange}
        />
      </div>

      {config.slots?.afterContent?.(pageState)}

      <Dialog
        visible={mode === 'create' || mode === 'edit'}
        header={mode === 'edit' ? config.editDialogTitle ?? 'Edit record' : config.createDialogTitle ?? 'Create record'}
        modal
        blockScroll
        draggable={false}
        resizable={false}
        className="crud-form-dialog"
        style={{ width: resolvedFormDialogWidth }}
        maskClassName="crud-form-dialog-mask"
        onHide={closeDialog}
      >
        <CommonForm
          config={config.form}
          mode={mode === 'edit' ? 'edit' : 'create'}
          initialValues={selectedItem ? config.mapItemToFormValues(selectedItem) : null}
          submitLabel={mode === 'edit' ? 'Save changes' : 'Create'}
          isSubmitting={createState.isLoading || updateState.isLoading}
          datePickerDisplayMode="inline"
          onCancel={closeDialog}
          onSubmit={handleSubmit}
        />
      </Dialog>

      <Dialog
        visible={mode === 'view'}
        header={config.viewDialogTitle ?? 'View record'}
        modal
        blockScroll
        draggable={false}
        resizable={false}
        className="crud-view-dialog"
        contentClassName="overflow-x-auto"
        style={{ 
          width: config.style?.viewDialogWidth ? config.style.viewDialogWidth : 'min(96vw, 66rem)',
          minHeight: config.style?.viewDialogMinHeight ? config.style.viewDialogMinHeight : undefined
        }}
        onHide={closeDialog}
      >
        {viewContent}
      </Dialog>

      <ConfirmationDialog
        open={deleteItemId !== null}
        title={config.deleteDialogTitle ?? 'Delete record?'}
        message={
          activeDeleteItem
            ? config.deleteDialogMessage?.(activeDeleteItem) ??
            `This will permanently delete ${config.getRowLabel(activeDeleteItem)}.`
            : 'This will permanently delete this record.'
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        confirmLoading={deleteState.isLoading}
        onClose={() => setDeleteItemId(null)}
        onConfirm={confirmDelete}
      />

      <ConfirmationDialog
        open={isBulkDeleteDialogOpen}
        title={config.bulkDelete?.confirmTitle ?? 'Delete selected records?'}
        message={
          config.bulkDelete?.confirmMessage?.(selectedItems) ??
          `This will permanently delete ${selectedItems.length} selected ${selectedItems.length === 1 ? resourceName : `${resourceName}s`
          }.`
        }
        confirmLabel={config.bulkDelete?.confirmLabel ?? 'Delete Selected'}
        cancelLabel="Cancel"
        tone="danger"
        confirmLoading={bulkDeleteState.isLoading}
        onClose={() => setIsBulkDeleteDialogOpen(false)}
        onConfirm={confirmBulkDelete}
      />
    </div>
  )
}
