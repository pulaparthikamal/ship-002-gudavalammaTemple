import type { ReactNode } from 'react'
import { Button } from 'primereact/button'
import { Checkbox } from 'primereact/checkbox'
import { cn } from '@/utils/classNames'
import type { CrudTableAction, CrudTableColumn } from '@/types/crud'

interface CommonGridProps<TItem> {
  data: TItem[]
  columns: Array<CrudTableColumn<TItem>>
  getRowId: (item: TItem) => string | number
  getRowLabel: (item: TItem) => string
  selectedItems?: TItem[]
  onSelectionChange?: (items: TItem[]) => void
  actions?: Array<CrudTableAction<TItem>>
  getActions?: (item: TItem) => Array<CrudTableAction<TItem>>
  actionRenderKey?: string | number
  emptyMessage?: string
  isLoading?: boolean
  renderItemContent?: (item: TItem) => ReactNode
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

function getColumnValue<TItem>(item: TItem, column: CrudTableColumn<TItem>) {
  if (column.render) {
    return column.render(item)
  }

  const field = column.field ?? column.accessorKey

  if (!field) {
    return '-'
  }

  const value = item[field]

  if (column.cell) {
    return column.cell(value, item)
  }

  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function renderDefaultCardContent<TItem>(
  item: TItem,
  columns: Array<CrudTableColumn<TItem>>,
) {
  const visibleColumns = columns.filter((column) => column.key !== 'actions')

  return (
    <div className="space-y-3">

      <dl className="space-y-2.5">
        {visibleColumns.map((column) => (
          <div key={String(column.key ?? column.field ?? column.accessorKey ?? column.header)} className="space-y-1">
            <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {column.header}
            </dt>
            <dd className="text-[13px] text-[var(--color-text)]">{getColumnValue(item, column)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function GridPlaceholder() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-5 rounded bg-[var(--color-border)]" />
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded bg-[var(--color-border)]" />
            <div className="h-8 w-8 rounded bg-[var(--color-border)]" />
          </div>
        </div>
        <div className="h-4 w-32 rounded bg-[var(--color-border)]" />
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded bg-[var(--color-surface-muted)]" />
          <div className="h-3.5 w-5/6 rounded bg-[var(--color-surface-muted)]" />
          <div className="h-3.5 w-2/3 rounded bg-[var(--color-surface-muted)]" />
        </div>
      </div>
    </div>
  )
}

export function CommonGrid<TItem>({
  data,
  columns,
  getRowId,
  selectedItems = [],
  onSelectionChange,
  actions = [],
  getActions,
  actionRenderKey = 0,
  emptyMessage = 'No records found.',
  isLoading = false,
  renderItemContent,
}: CommonGridProps<TItem>) {
  const selectedIdSet = new Set(selectedItems.map((item) => String(getRowId(item))))

  const toggleSelection = (item: TItem, checked: boolean) => {
    if (!onSelectionChange) {
      return
    }

    const itemId = String(getRowId(item))

    if (checked) {
      const alreadySelected = selectedItems.some(
        (selectedItem) => String(getRowId(selectedItem)) === itemId,
      )

      if (alreadySelected) {
        return
      }

      onSelectionChange([...selectedItems, item])
      return
    }

    onSelectionChange(
      selectedItems.filter((selectedItem) => String(getRowId(selectedItem)) !== itemId),
    )
  }

  if (isLoading) {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <GridPlaceholder key={index} />
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-7 text-center text-sm text-[var(--color-text-muted)]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {data.map((item) => {
        const itemId = String(getRowId(item))
        const itemActions = getActions?.(item) ?? actions
        const isSelected = selectedIdSet.has(itemId)

        return (
          <article
            key={`${itemId}-${actionRenderKey}`}
            className={cn(
              'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors sm:p-3.5',
              isSelected ? 'border-[var(--color-primary)] ring-1 ring-[var(--primary-color-soft)]' : '',
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              {onSelectionChange ? (
                <Checkbox
                  inputId={`grid-select-${itemId}`}
                  checked={isSelected}
                  onChange={(event) => toggleSelection(item, Boolean(event.checked))}
                />
              ) : (
                <span />
              )}

              {itemActions.length ? (
                <div className="flex flex-wrap justify-end gap-1">
                  {itemActions.map((action) => {
                    const resolvedLabel = typeof action.label === 'function' ? action.label(item) : action.label
                    const resolvedTooltip = action.tooltip
                      ? (typeof action.tooltip === 'function' ? action.tooltip(item) : action.tooltip)
                      : resolvedLabel
                    const isDisabled = typeof action.disabled === 'function' ? action.disabled(item) : (action.disabled ?? false)
                    const btn = (
                      <Button
                        key={resolvedLabel}
                        type="button"
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
                    return (
                      <span key={resolvedLabel} title={resolvedTooltip} style={{ display: 'inline-flex' }}>
                        {btn}
                      </span>
                    )
                  })}
                </div>
              ) : null}
            </div>

            {renderItemContent
              ? renderItemContent(item)
              : renderDefaultCardContent(item, columns)}
          </article>
        )
      })}
    </div>
  )
}
