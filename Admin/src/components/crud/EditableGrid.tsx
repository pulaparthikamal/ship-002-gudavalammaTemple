import { useState } from 'react'
import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { Column } from 'primereact/column'
import type { ColumnEvent } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { Trash2 } from 'lucide-react'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { cn } from '@/utils/classNames'
import type { CrudSelectOption } from '@/types/crud'

export type EditableGridColumnType = 'text' | 'number' | 'date' | 'select'

export interface EditableGridColumn<TItem> {
  field: keyof TItem & string
  header: string
  type: EditableGridColumnType
  options?: CrudSelectOption[]
  editable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
  /** Custom read-only render. Falls back to raw value if omitted. */
  render?: (item: TItem) => React.ReactNode
  /** Parse the raw editor value into the value stored on the row/patch. */
  parseValue?: (value: unknown) => unknown
}

export interface EditableGridProps<TItem extends object> {
  columns: Array<EditableGridColumn<TItem>>
  rows: TItem[]
  getRowId: (item: TItem) => string
  onRowUpdate: (id: string, patch: Partial<TItem>) => void
  onRowDelete?: (id: string) => void
  onRowAdd?: () => void
  loading?: boolean
  emptyMessage?: string
  addButtonLabel?: string
  className?: string
  scrollHeight?: string
}

function renderEditor<TItem>(
  column: EditableGridColumn<TItem>,
  options: { value: unknown; editorCallback?: (value: unknown) => void },
) {
  const { value, editorCallback } = options

  if (column.type === 'number') {
    return (
      <InputNumber
        value={typeof value === 'number' ? value : value ? Number(value) : null}
        onValueChange={(e) => editorCallback?.(e.value ?? null)}
        className="w-full"
        inputClassName="w-full"
        mode="decimal"
        minFractionDigits={0}
        maxFractionDigits={2}
        autoFocus
      />
    )
  }

  if (column.type === 'date') {
    const dateValue = value ? new Date(value as string | Date) : null
    return (
      <Calendar
        value={dateValue}
        onChange={(e) => editorCallback?.(e.value ?? null)}
        dateFormat="dd-mm-yy"
        showIcon
        className="w-full"
        autoFocus
      />
    )
  }

  if (column.type === 'select') {
    return (
      <Dropdown
        value={value ?? null}
        options={column.options ?? []}
        onChange={(e) => editorCallback?.(e.value)}
        className="w-full"
        autoFocus
      />
    )
  }

  return (
    <InputText
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => editorCallback?.(e.target.value)}
      className="w-full"
      autoFocus
    />
  )
}

function renderDisplayValue<TItem>(column: EditableGridColumn<TItem>, value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (column.type === 'date') {
    try {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(new Date(value as string | Date))
    } catch {
      return String(value)
    }
  }

  if (column.type === 'select') {
    const match = column.options?.find((option) => option.value === value)
    return match?.label ?? String(value)
  }

  if (column.type === 'number') {
    return typeof value === 'number' ? value.toLocaleString() : String(value)
  }

  return String(value)
}

/**
 * Generic Excel-like editable DataTable with per-cell inline editing.
 * Not tied to any specific entity — pass columns/rows for any resource.
 */
export function EditableGrid<TItem extends object>({
  columns,
  rows,
  getRowId,
  onRowUpdate,
  onRowDelete,
  onRowAdd,
  loading = false,
  emptyMessage,
  addButtonLabel,
  className,
  scrollHeight,
}: EditableGridProps<TItem>) {
  const { t } = useStaffTranslation()
  const resolvedEmptyMessage = emptyMessage ?? t('No records found.')
  const resolvedAddButtonLabel = addButtonLabel ?? t('+ Add Row')
  const [renderKey, setRenderKey] = useState(0)

  const onCellEditComplete = (event: ColumnEvent) => {
    const { rowData, newValue, field } = event
    const column = columns.find((c) => c.field === field)
    if (!column) return

    const parsedValue = column.parseValue ? column.parseValue(newValue) : newValue
    const id = getRowId(rowData as TItem)
    onRowUpdate(id, { [field]: parsedValue } as Partial<TItem>)
    setRenderKey((key) => key + 1)
  }

  return (
    <div className={cn('editable-grid space-y-2', className)}>
      <DataTable
        key={renderKey}
        value={rows}
        dataKey={(item) => getRowId(item as TItem)}
        loading={loading}
        emptyMessage={resolvedEmptyMessage}
        editMode="cell"
        size="small"
        scrollable={Boolean(scrollHeight)}
        scrollHeight={scrollHeight}
        rowHover
        tableStyle={{ minWidth: '640px' }}
        className="editable-grid-table"
      >
        {columns.map((column) => (
          <Column
            key={column.field}
            field={column.field}
            header={column.header}
            style={column.width ? { width: column.width } : undefined}
            align={column.align}
            editor={
              column.editable === false
                ? undefined
                : (options) => renderEditor(column, options)
            }
            onCellEditComplete={onCellEditComplete}
            body={(item: TItem) =>
              column.render ? column.render(item) : renderDisplayValue(column, item[column.field])
            }
          />
        ))}
        {onRowDelete ? (
          <Column
            key="__actions"
            header=""
            style={{ width: '3rem' }}
            align="center"
            body={(item: TItem) => (
              <Button
                type="button"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                text
                rounded
                severity="danger"
                aria-label={t('Delete row')}
                onClick={() => onRowDelete(getRowId(item))}
              />
            )}
          />
        ) : null}
      </DataTable>

      {onRowAdd ? (
        <Button
          type="button"
          label={resolvedAddButtonLabel}
          text
          className="text-xs font-semibold"
          onClick={onRowAdd}
        />
      ) : null}
    </div>
  )
}
