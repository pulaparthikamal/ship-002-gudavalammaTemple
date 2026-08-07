import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Columns3,
  GripVertical,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { Button } from 'primereact/button'
import { Checkbox } from 'primereact/checkbox'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import type { CrudTableViewManagerColumn } from '@/features/tableViews/useCrudTableViews'

interface CrudTableViewManagerProps<TItem> {
  activeViewId: string | null
  activeViewName: string
  managerColumns: Array<CrudTableViewManagerColumn<TItem>>
  viewOptions: Array<{ label: string; value: string }>
  hasSavedViews: boolean
  isLoading: boolean
  isSaving: boolean
  isDirty: boolean
  isUsingDefaultView: boolean
  saveState: 'idle' | 'saving' | 'error'
  onSelectView: (viewId: string) => void
  onSetColumnVisibility: (columnId: string, visible: boolean) => void
  onReorderColumns: (columnIds: string[]) => void
  onSaveChanges: () => void
  onCreateView: (name: string) => void
  onRenameActiveView: (name: string) => void
  onDeleteActiveView: () => void
  onResetActiveView: () => void
}

type NameEditorMode = 'create' | 'rename' | null

// ── Sortable row ──────────────────────────────────────────────────────────────

interface SortableColumnRowProps<TItem> {
  column: CrudTableViewManagerColumn<TItem>
  isSaving: boolean
  onVisibilityChange: (columnId: string, visible: boolean) => void
  isOverlay?: boolean
}

function SortableColumnRow<TItem>({
  column,
  isSaving,
  onVisibilityChange,
  isOverlay = false,
}: SortableColumnRowProps<TItem>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.columnId, disabled: isSaving })

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        // Only animate position changes, not the drag itself
        transition: isDragging ? undefined : transition,
      }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      className={[
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        isDragging && !isOverlay
          ? 'border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] opacity-25'
          : isOverlay
            ? 'border-[var(--color-primary)] bg-[var(--color-surface)] shadow-lg ring-1 ring-[var(--color-primary)]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]',
      ].join(' ')}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...(isOverlay ? {} : { ...attributes, ...listeners })}
        disabled={isSaving}
        aria-label={`Drag to reorder ${column.header}`}
        className={[
          'inline-flex h-6 w-5 shrink-0 touch-none select-none items-center justify-center rounded text-[var(--color-text-muted)] outline-none',
          isSaving
            ? 'cursor-not-allowed opacity-40'
            : 'cursor-grab hover:text-[var(--color-primary)] active:cursor-grabbing',
        ].join(' ')}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Column name */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-strong)]">
        {column.header}
      </span>

      {/* Visibility toggle */}
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
        <span className="text-xs text-[var(--color-text-muted)]">
          {column.visible ? 'Visible' : 'Hidden'}
        </span>
        <Checkbox
          checked={column.visible}
          disabled={column.disableVisibilityToggle || isSaving}
          onChange={(e) => onVisibilityChange(column.columnId, Boolean(e.checked))}
        />
      </label>
    </div>
  )
}

// ── Main manager ──────────────────────────────────────────────────────────────

export function CrudTableViewManager<TItem>({
  activeViewId,
  activeViewName,
  managerColumns,
  viewOptions,
  hasSavedViews,
  isLoading,
  isSaving,
  isDirty,
  isUsingDefaultView,
  saveState,
  onSelectView,
  onSetColumnVisibility,
  onReorderColumns,
  onSaveChanges,
  onCreateView,
  onRenameActiveView,
  onDeleteActiveView,
  onResetActiveView,
}: CrudTableViewManagerProps<TItem>) {
  const [isOpen, setIsOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<NameEditorMode>(null)
  const [nameValue, setNameValue] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [viewPopoverOpen, setViewPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!viewPopoverOpen) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setViewPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [viewPopoverOpen])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const columnIds = managerColumns.map((c) => c.columnId)
  const activeColumn = activeId ? managerColumns.find((c) => c.columnId === activeId) : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const oldIndex = columnIds.indexOf(String(active.id))
    const newIndex = columnIds.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    onReorderColumns(arrayMove(columnIds, oldIndex, newIndex))
  }

  const openCreateEditor = () => { setEditorMode('create'); setNameValue('') }
  const openRenameEditor = () => { setEditorMode('rename'); setNameValue(activeViewName) }
  const closeEditor = () => { setEditorMode(null); setNameValue('') }

  const submitEditor = () => {
    if (!nameValue.trim()) return
    if (editorMode === 'create') onCreateView(nameValue.trim())
    else if (editorMode === 'rename') onRenameActiveView(nameValue.trim())
    closeEditor()
  }

  // Instant drop — no animation delay
  const dropAnimation = {
    duration: 0,
    easing: 'linear',
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } }),
  }

  const saveLabel = isSaving ? 'Saving…' : saveState === 'error' ? 'Retry Save' : 'Save Changes'

  return (
    <>
      {/* Trigger */}
      <Button
        type="button"
        label="Views"
        icon={<Columns3 className="h-3.5 w-3.5" />}
        severity="secondary"
        outlined
        className="flex items-center gap-1 h-8 px-3 text-xs font-semibold"
        onClick={() => setIsOpen(true)}
      />

      <Dialog
        visible={isOpen}
        header={
          /* ── Header: title + Save button ─────────────────────────── */
          <div className="flex items-center justify-between pr-2">
            <span className="text-base font-semibold text-[var(--color-text-strong)]">
              Table Views
            </span>
            <Button
              type="button"
              label={saveLabel}
              icon={<Save className="h-3.5 w-3.5" />}
              disabled={!isDirty || isSaving}
              className={[
                'h-8 px-4 text-xs font-semibold transition-opacity',
                isDirty ? '' : 'opacity-40',
              ].join(' ')}
              onClick={onSaveChanges}
            />
          </div>
        }
        modal
        draggable={false}
        resizable={false}
        style={{ width: 'min(92vw, 38rem)' }}
        className="crud-table-view-dialog"
        contentClassName="crud-table-view-dialog-content"
        onHide={() => {
          setIsOpen(false)
          closeEditor()
          setActiveId(null)
        }}
      >
        <div className="crud-table-view-shell space-y-3">

          {/* ── View selector bar ──────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">

            {/* Dropdown */}
            <div className="relative flex min-w-0 flex-1 items-center gap-1.5" ref={popoverRef}>
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                View
              </span>
              <button
                type="button"
                onClick={() => setViewPopoverOpen((o) => !o)}
                className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-strong)] outline-none transition-colors hover:border-[var(--color-primary)]"
              >
                <span className="truncate">{activeViewName}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform ${viewPopoverOpen ? 'rotate-180' : ''}`} />
              </button>

              {viewPopoverOpen && hasSavedViews && (
                <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[11rem] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-xl">
                  {viewOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { onSelectView(opt.value); setViewPopoverOpen(false) }}
                      className={[
                        'flex w-full items-center px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-muted)]',
                        opt.value === activeViewId
                          ? 'font-semibold text-[var(--color-primary)]'
                          : 'font-medium text-[var(--color-text-strong)]',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-1">
              <ActionChip icon={<Plus className="h-3 w-3" />} label="New" onClick={openCreateEditor} />
              <ActionChip icon={<Pencil className="h-3 w-3" />} label="Rename" disabled={!hasSavedViews || isUsingDefaultView} onClick={openRenameEditor} />
              <ActionChip icon={<RotateCcw className="h-3 w-3" />} label="Reset" disabled={!hasSavedViews || isUsingDefaultView || isSaving} onClick={onResetActiveView} />
              <ActionChip icon={<Trash2 className="h-3 w-3" />} label="Delete" disabled={!hasSavedViews || isUsingDefaultView} danger onClick={onDeleteActiveView} />
            </div>
          </div>

          {/* ── Name editor (create / rename) ──────────────────────── */}
          {editorMode ? (
            <div className="flex items-end gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
              <label className="flex-1 space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {editorMode === 'create' ? 'New view name' : 'Rename view'}
                </span>
                <InputText
                  value={nameValue}
                  autoFocus
                  className="w-full h-8 text-sm"
                  placeholder={editorMode === 'create' ? 'e.g. My custom view' : activeViewName}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitEditor()
                    if (e.key === 'Escape') closeEditor()
                  }}
                />
              </label>
              <div className="flex gap-1.5 pb-0.5">
                <Button type="button" label={editorMode === 'create' ? 'Save' : 'Rename'} className="h-8 px-3 text-xs font-semibold" disabled={!nameValue.trim()} onClick={submitEditor} />
                <Button type="button" label="Cancel" severity="secondary" outlined className="h-8 px-3 text-xs font-semibold" onClick={closeEditor} />
              </div>
            </div>
          ) : null}

          {/* ── Column list ────────────────────────────────────────── */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Columns · drag to reorder · toggle visibility
            </p>

            {isLoading ? (
              <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                Loading columns…
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
                  <div className="max-h-[24rem] space-y-1 overflow-y-auto">
                    {managerColumns.map((column) => (
                      <SortableColumnRow
                        key={column.columnId}
                        column={column}
                        isSaving={isSaving}
                        onVisibilityChange={onSetColumnVisibility}
                      />
                    ))}
                  </div>
                </SortableContext>

                <DragOverlay dropAnimation={dropAnimation}>
                  {activeColumn ? (
                    <SortableColumnRow
                      column={activeColumn}
                      isSaving={isSaving}
                      onVisibilityChange={onSetColumnVisibility}
                      isOverlay
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>

          {/* ── Unsaved changes hint ───────────────────────────────── */}
          {isDirty && (
            <p className="text-center text-xs text-[var(--color-text-muted)]">
              You have unsaved changes — click <strong>Save Changes</strong> to apply.
            </p>
          )}
        </div>
      </Dialog>
    </>
  )
}

// Small reusable action chip button
function ActionChip({
  icon,
  label,
  disabled,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
          : 'text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}
