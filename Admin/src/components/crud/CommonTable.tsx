import { useState } from 'react'
import { FilterOperator } from 'primereact/api'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import type {
  DataTableFilterEvent,
  DataTableFilterMeta,
  DataTableSortEvent,
} from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import { MultiSelect } from 'primereact/multiselect'
import { InputNumber } from 'primereact/inputnumber'
import { cn } from '@/utils/classNames'
import type {
  CrudCriteriaType,
  CrudCriteriaValue,
  CrudFilterMatchMode,
  CrudListCriteria,
  CrudListQuery,
  CrudTableAction,
  CrudTableColumn,
} from '@/types/crud'

interface CommonTableProps<TItem> {
  data: TItem[]
  query: CrudListQuery
  totalRecords: number
  columns: Array<CrudTableColumn<TItem>>
  getRowId: (item: TItem) => string | number
  onQueryChange: (query: CrudListQuery) => void
  selectedItems?: TItem[]
  onSelectionChange?: (items: TItem[]) => void
  actions?: Array<CrudTableAction<TItem>>
  getActions?: (item: TItem) => Array<CrudTableAction<TItem>>
  actionRenderKey?: string | number
  emptyMessage?: string
  isLoading?: boolean
  rowClassName?: (item: TItem) => string
  showSelection?: boolean
  /** Controls whether the Actions column is rendered. Defaults to true. */
  showActions?: boolean
}

interface TableFilterMetaValue {
  value?: unknown
  matchMode?: CrudFilterMatchMode
  constraints?: Array<{ value?: unknown; matchMode?: CrudFilterMatchMode }>
}

interface FilterValueWithMode {
  value: unknown
  matchMode?: CrudFilterMatchMode
}

const textFilterMatchModes: Array<{ label: string; value: CrudFilterMatchMode }> = [
  { label: 'Starts with', value: 'startsWith' },
  { label: 'Contains', value: 'contains' },
  { label: 'Ends with', value: 'endsWith' },
  { label: 'Equals', value: 'equals' },
  { label: 'Not equals', value: 'notEquals' },
]

const selectFilterMatchModes: Array<{ label: string; value: CrudFilterMatchMode }> = [
  { label: 'Equals', value: 'equals' },
  { label: 'Not equals', value: 'notEquals' },
]

const multiSelectFilterMatchModes: Array<{ label: string; value: CrudFilterMatchMode }> = [
  { label: 'In', value: 'in' },
  { label: 'Not in', value: 'notIn' },
]

const dateFilterMatchModes: Array<{ label: string; value: CrudFilterMatchMode }> = [
  { label: 'Date Is', value: 'dateIs' },
  { label: 'Date Is Not', value: 'dateIsNot' },
  { label: 'Date Before', value: 'dateBefore' },
  { label: 'Date After', value: 'dateAfter' },
]

const numberFilterMatchModes: Array<{ label: string; value: CrudFilterMatchMode }> = [
  { label: 'Equals', value: 'equals' },
  { label: 'Not equals', value: 'notEquals' },
  { label: 'Less than', value: 'lt' },
  { label: 'Less than or equal', value: 'lte' },
  { label: 'Greater than', value: 'gt' },
  { label: 'Greater than or equal', value: 'gte' },
]

function getColumnValue<TItem>(item: TItem, column: CrudTableColumn<TItem>) {
  const field = column.field ?? column.accessorKey

  if (!field) {
    return null
  }

  const value = item[field]

  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function getRawColumnValue<TItem>(item: TItem, column: CrudTableColumn<TItem>) {
  const field = column.field ?? column.accessorKey

  return field ? item[field] : undefined
}

function getSortField<TItem>(column: CrudTableColumn<TItem>) {
  return column.sortField ?? String(column.field ?? column.accessorKey ?? column.key ?? '')
}

function getColumnKey<TItem>(column: CrudTableColumn<TItem>) {
  return String(column.key ?? column.field ?? column.accessorKey ?? column.header)
}

function isActionsColumn<TItem>(column: CrudTableColumn<TItem>) {
  return String(column.key ?? column.field ?? column.accessorKey ?? '') === 'actions'
}

function getFilterField<TItem>(column: CrudTableColumn<TItem>) {
  return column.filter?.key ?? getSortField(column)
}

function getDefaultMatchMode<TItem>(column: CrudTableColumn<TItem>): CrudFilterMatchMode {
  if (column.filter?.type && column.filter.type !== 'regexOr') {
    const type = column.filter.type

    if (type === 'eq') return 'equals'
    if (type === 'ne') return 'notEquals'
    if (type === 'sw') return 'startsWith'
    if (type === 'ew') return 'endsWith'
    if (type === 'nin') return 'notIn'
    if (type === 'dateis') return 'dateIs'
    if (type === 'datelt') return 'dateBefore'
    if (type === 'dategt') return 'dateAfter'
    if (type === 'datelte') return 'dateBefore'
    if (type === 'dategte') return 'dateAfter'

    return type
  }

  if (column.filter?.input === 'multiSelect') {
    return 'in'
  }

  if (column.filter?.input === 'select') {
    return 'equals'
  }

  if (column.filter?.input === 'number') {
    return 'equals'
  }

  if (column.filter?.input === 'date') {
    return 'dateIs'
  }

  return 'contains'
}

function getFilterMatchModeOptions<TItem>(column: CrudTableColumn<TItem>) {
  const sourceOptions =
    column.filter?.matchModes ??
    (column.filter?.input === 'multiSelect'
      ? multiSelectFilterMatchModes.map((option) => option.value)
      : column.filter?.input === 'select'
        ? selectFilterMatchModes.map((option) => option.value)
        : column.filter?.input === 'number'
          ? numberFilterMatchModes.map((option) => option.value)
          : column.filter?.input === 'date'
            ? dateFilterMatchModes.map((option) => option.value)
            : textFilterMatchModes.map((option) => option.value))

  const availableOptions = [
    ...textFilterMatchModes,
    ...selectFilterMatchModes,
    ...multiSelectFilterMatchModes,
    ...dateFilterMatchModes,
    ...numberFilterMatchModes,
  ]

  return sourceOptions.map((mode) => ({
    label: availableOptions.find((option) => option.value === mode)?.label ?? mode,
    value: mode,
  }))
}

function createInitialFilters<TItem>(columns: Array<CrudTableColumn<TItem>>) {
  return columns.reduce<DataTableFilterMeta>((filters, column) => {
    if (!column.filter) {
      return filters
    }

    filters[getFilterField(column)] = {
      operator: FilterOperator.AND,
      constraints: [
        {
          value: null,
          matchMode: getDefaultMatchMode(column),
        },
      ],
    }

    return filters
  }, {})
}

function readFilterValues(meta: DataTableFilterMeta[string]): FilterValueWithMode[] {
  const filterMeta = meta as TableFilterMetaValue | undefined

  if (!filterMeta) {
    return []
  }

  if (Array.isArray(filterMeta.constraints) && filterMeta.constraints.length > 0) {
    return filterMeta.constraints
      .filter((constraint) => hasFilterValue(constraint.value))
      .map((constraint) => ({
        value: constraint.value,
        matchMode: constraint.matchMode,
      }))
  }

  return hasFilterValue(filterMeta.value)
    ? [
        {
          value: filterMeta.value,
          matchMode: filterMeta.matchMode,
        },
      ]
    : []
}

function hasFilterValue(value: unknown) {
  if (value instanceof Date) {
    return true
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return value !== null && value !== undefined && String(value).trim() !== ''
}

function getCriteriaType(
  value: unknown,
  matchMode: CrudFilterMatchMode | undefined,
  fallbackType?: CrudCriteriaType,
): CrudListCriteria['type'] {
  if (matchMode) {
    const modeMap: Record<string, CrudCriteriaType> = {
      startsWith: 'sw',
      contains: 'contains',
      notContains: 'notContains',
      endsWith: 'ew',
      equals: 'eq',
      notEquals: 'ne',
      in: 'in',
      notIn: 'nin',
      lt: 'lt',
      lte: 'lte',
      gt: 'gt',
      gte: 'gte',
      dateIs: 'dateis',
      dateIsNot: 'dateIsNot',
      dateBefore: 'datelt',
      dateAfter: 'dategt',
    }

    if (modeMap[matchMode]) {
      return modeMap[matchMode]
    }

    return matchMode as CrudListCriteria['type']
  }

  if (fallbackType) {
    return fallbackType as CrudListCriteria['type']
  }

  return Array.isArray(value) ? 'in' : 'regexOr'
}

function normalizeFilterValueForCriteria<TItem>(
  column: CrudTableColumn<TItem>,
  value: unknown,
): CrudCriteriaValue {
  if (column.filter?.input === 'date' && value instanceof Date) {
    return value
  }

  if (column.filter?.input === 'number') {
    return typeof value === 'number' ? value : Number(value)
  }

  if (Array.isArray(value)) {
    return value as Array<string | number | boolean>
  }

  return value as CrudCriteriaValue
}

function buildCriteria<TItem>(
  columns: Array<CrudTableColumn<TItem>>,
  filters: DataTableFilterMeta,
): CrudListCriteria[] {
  return columns.flatMap((column) => {
    if (!column.filter) {
      return []
    }

    return readFilterValues(filters[getFilterField(column)]).map(({ value, matchMode }) => {
      const normalizedValue = normalizeFilterValueForCriteria(column, value)

      return {
        key: column.filter?.key ?? getFilterField(column),
        value: normalizedValue,
        type: getCriteriaType(normalizedValue, matchMode, column.filter?.type),
      }
    })
  })
}

function getColumnFilterKeys<TItem>(columns: Array<CrudTableColumn<TItem>>) {
  return new Set(
    columns
      .filter((column) => column.filter)
      .map((column) => column.filter?.key ?? getFilterField(column)),
  )
}

function serializeCriteriaValue(value: CrudCriteriaValue) {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return Array.isArray(value) ? JSON.stringify(value) : String(value)
}

function serializeCriteria(criterion: CrudListCriteria) {
  return `${criterion.key}:${criterion.type}:${serializeCriteriaValue(criterion.value)}`
}

function areCriteriaEqual(firstCriteria: CrudListCriteria[], secondCriteria: CrudListCriteria[]) {
  if (firstCriteria.length !== secondCriteria.length) {
    return false
  }

  return firstCriteria.every(
    (criterion, index) => serializeCriteria(criterion) === serializeCriteria(secondCriteria[index]),
  )
}

function getActionButtonClassName<TItem>(action: CrudTableAction<TItem>, item?: TItem) {
  const rawLabel = typeof action.label === 'function' ? action.label(item as TItem) : action.label
  const label = (rawLabel || '').toLowerCase()

  if (action.tone === 'danger' || label.includes('delete')) {
    return 'crud-table-action-button crud-table-action-delete'
  }

  if (label.includes('edit')) {
    return 'crud-table-action-button crud-table-action-edit'
  }

  if (label.includes('view') && !label.includes('review')) {
    return 'crud-table-action-button crud-table-action-view'
  }

  return 'crud-table-action-button'
}

export function CommonTable<TItem>({
  data,
  query,
  totalRecords,
  columns,
  getRowId,
  onQueryChange,
  selectedItems = [],
  onSelectionChange,
  actions = [],
  getActions,
  actionRenderKey = 0,
  emptyMessage = 'No records found.',
  isLoading = false,
  rowClassName,
  showSelection = true,
  showActions = true,
}: CommonTableProps<TItem>) {
  const tableData = data as Array<Record<string, unknown>>
  const [filters, setFilters] = useState<DataTableFilterMeta>(() => createInitialFilters(columns))
  const hasInlineActionsColumn = columns.some((column) => isActionsColumn(column))

  const updateQuery = (nextQuery: CrudListQuery) => {
    onQueryChange(nextQuery)
  }

  const handleSort = (event: DataTableSortEvent) => {
    updateQuery({
      ...query,
      page: 1,
      sortfield: event.sortField || undefined,
      direction: event.sortOrder === 1 ? 'asc' : 'desc',
    })
  }

  const handleFilter = (event: DataTableFilterEvent) => {
    const filterKeys = getColumnFilterKeys(columns)
    const existingNonTableCriteria = query.criteria.filter((criterion) => !filterKeys.has(criterion.key))
    const nextCriteria = [...existingNonTableCriteria, ...buildCriteria(columns, event.filters)]

    setFilters(event.filters)

    if (areCriteriaEqual(query.criteria, nextCriteria)) {
      return
    }

    updateQuery({
      ...query,
      page: 1,
      criteria: nextCriteria,
    })
  }

  const actionsTemplate = (item: TItem) => {
    const rowActions = getActions?.(item) ?? actions

    if (!rowActions.length) {
      return null
    }

    return (
      <div key={`${String(getRowId(item))}-${actionRenderKey}`} className="flex justify-start gap-1">
        {rowActions.map((action, idx) => {
          const resolvedLabel = typeof action.label === 'function' ? action.label(item) : action.label
          const resolvedTooltip = action.tooltip
            ? (typeof action.tooltip === 'function' ? action.tooltip(item) : action.tooltip)
            : resolvedLabel
          const isDisabled =
            typeof action.disabled === 'function' ? action.disabled(item) : (action.disabled ?? false)

          const btn = (
            <Button
              key={resolvedLabel + idx}
              type="button"
              title={resolvedLabel}
              text
              rounded
              icon={action.icon}
              loading={action.loading}
              severity={action.tone === 'danger' ? 'danger' : 'secondary'}
              aria-label={resolvedLabel}
              className={cn('h-8 w-8 p-0', getActionButtonClassName(action, item))}
              disabled={isDisabled || action.loading}
              onClick={() => action.onClick(item)}
            />
          )

          // Wrap in span so tooltip shows even when button is disabled
          return (
            <span key={resolvedLabel + idx} title={resolvedTooltip} style={{ display: 'inline-flex' }}>
              {btn}
            </span>
          )
        })}
      </div>
    )
  }

  const renderFilterElement = (column: CrudTableColumn<TItem>) => {
    if (column.filter?.input === 'select') {
      return (options: { value: unknown; filterCallback: (value: unknown) => void }) => (
        <Dropdown
          value={options.value ?? null}
          options={column.filter?.options ?? []}
          placeholder={column.filter?.placeholder ?? 'Select'}
          showClear
          className="w-full"
          onChange={(event) => options.filterCallback(event.value)}
        />
      )
    }

    if (column.filter?.input === 'multiSelect') {
      return (options: { value: unknown; filterCallback: (value: unknown) => void }) => (
        <MultiSelect
          value={options.value ?? []}
          options={column.filter?.options ?? []}
          placeholder={column.filter?.placeholder ?? 'Filter'}
          display="chip"
          className="w-full"
          maxSelectedLabels={2}
          onChange={(event) => options.filterCallback(event.value)}
        />
      )
    }

    if (column.filter?.input === 'date') {
      return (options: { value: unknown; filterCallback: (value: unknown) => void }) => (
        <Calendar
          value={options.value as Date | undefined | null}
          onChange={(e) => options.filterCallback(e.value)}
          dateFormat="dd-mm-yy"
          placeholder="Select Date"
          mask="99-99-9999"
          showButtonBar
        />
      )
    }

    if (column.filter?.input === 'number') {
      return (options: { value: unknown; filterCallback: (value: unknown) => void }) => (
        <InputNumber
          value={typeof options.value === 'number' ? options.value : null}
          placeholder={column.filter?.placeholder ?? 'Enter value'}
          className="w-full"
          inputClassName="w-full"
          onValueChange={(event) => options.filterCallback(event.value)}
        />
      )
    }

    return undefined
  }

  return (
    <DataTable
      value={tableData}
      dataKey={(item) => String(getRowId(item as TItem))}
      loading={isLoading}
      emptyMessage={emptyMessage}
      lazy
      totalRecords={totalRecords}
      sortField={query.sortfield}
      sortOrder={query.direction === 'asc' ? 1 : -1}
      filters={filters}
      filterDisplay="menu"
      selectionMode="multiple"
      selection={selectedItems as Array<Record<string, unknown>>}
      onSelectionChange={(event) => onSelectionChange?.(event.value as unknown as TItem[])}
      onSort={handleSort}
      onFilter={handleFilter}
      removableSort
      rowHover
      rowClassName={(item) => rowClassName?.(item as TItem) || ''}
      size="small"
      tableStyle={{ minWidth: '680px' }}
      className="crud-data-table"
    >
      {showSelection ? (
        <Column
          selectionMode="multiple"
          align="center"
          alignHeader="center"
          className="crud-data-table-selection-column"
          bodyClassName="crud-data-table-selection-column"
          headerClassName="crud-data-table-selection-column"
          headerStyle={{ width: '3rem' }}
          bodyStyle={{ width: '3rem' }}
        />
      ) : null}
      {columns.map((column) => (
        isActionsColumn(column) ? (
          <Column
            key={getColumnKey(column)}
            header={column.header}
            body={(item: Record<string, unknown>) => actionsTemplate(item as TItem)}
            headerClassName={column.headerClassName ?? 'text-left'}
            className={cn('align-middle', column.className)}
            style={{ width: '7rem' }}
          />
        ) : (
          <Column
            key={getColumnKey(column)}
            field={getSortField(column)}
            header={column.header}
            sortable={column.sortable ?? Boolean(column.field || column.sortField)}
            filter={Boolean(column.filter)}
            filterField={getFilterField(column)}
            filterPlaceholder={column.filter?.placeholder}
            showFilterMenu
            filterMatchMode={getDefaultMatchMode(column)}
            filterMatchModeOptions={getFilterMatchModeOptions(column)}
            showFilterMatchModes
            showFilterOperator={false}
            showAddButton={false}
            maxConstraints={1}
            filterElement={renderFilterElement(column)}
            body={(item: Record<string, unknown>) =>
              column.render
                ? column.render(item as TItem)
                : column.cell
                  ? column.cell(getRawColumnValue(item as TItem, column), item as TItem)
                  : getColumnValue(item as TItem, column)
            }
            className={cn('align-middle', column.className)}
            headerClassName={column.headerClassName}
          />
        )
      ))}
      {showActions && !hasInlineActionsColumn && (actions.length > 0 || Boolean(getActions)) ? (
        <Column
          key={`actions-${actionRenderKey}`}
          header="Action"
          body={(item: Record<string, unknown>) => actionsTemplate(item as TItem)}
          headerClassName="text-left"
          style={{ width: '7rem' }}
        />
      ) : null}
    </DataTable>
  )
}
