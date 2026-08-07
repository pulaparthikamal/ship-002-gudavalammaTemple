import type { ReactNode } from 'react'
import type { FieldPath, FieldValues, UseFormGetValues, UseFormReset, UseFormSetValue } from 'react-hook-form'
import type { CalendarProps, CalendarSelectionMode } from 'primereact/calendar'
import type { ZodType } from 'zod'
import type { EntityId } from './common'
import type { ScreenHelpContent } from '@/components/ui/ScreenHelpButton'
import type { DocumentCreatePayload } from './document'

export type CrudFormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'time'
  | 'textarea'
  | 'select'
  | 'autocomplete'
  | 'permissions'
  | 'date'
  | 'upload'
  | 'localFile'
  | 'multiUpload'
  | 'mediaUpload'
  | 'videoUpload'
  | 'checkbox'
  | 'switch'
  | 'hidden'
  | 'chips'
  | 'toneSelector'
  | 'platformSelector'
  | 'emergencyContacts'
  | 'attachments'
  | 'tags'
  | 'editableStringList'
  | 'multiSelect'

  | 'chargeLines'
  | 'claimLines'
  | 'action'
  | 'info'

export interface CrudSelectOption {
  label: string
  value: string | number | boolean
}

export type CrudPermissionLevel = 'NoView' | 'View' | 'Edit'
export type CrudViewMode = 'list' | 'grid'
export type CrudFormMode = 'create' | 'edit'

export type CrudPermissionAction =
  | 'View'
  | 'Add'
  | 'Create'
  | 'Update'
  | 'Delete'

export interface CrudPermissionEntry {
  key: string
  title: string
  route: string
  parentTitle?: string
  type: CrudPermissionLevel
  actions: CrudPermissionAction[]
}

export type CrudPermissionsValue = Record<string, CrudPermissionEntry>

export type CrudSortDirection = 'asc' | 'desc'

export type CrudFilterMatchMode =
  | 'startsWith'
  | 'contains'
  | 'notContains'
  | 'endsWith'
  | 'equals'
  | 'notEquals'
  | 'in'
  | 'notIn'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'dateIs'
  | 'dateIsNot'
  | 'dateBefore'
  | 'dateAfter'

export type CrudCriteriaType = 'regexOr' | 'eq' | 'ne' | 'equals' | 'notEquals' | 'sw' | 'ew' | 'contains' | 'notContains' | 'in' | 'nin' | 'lt' | 'lte' | 'gt' | 'gte' | 'dateis' | 'dateIsNot' | 'datelt' | 'dategt' | 'dategte' | 'datelte'

export type CrudCriteriaValue =
  | string
  | number
  | boolean
  | Date
  | Array<string | number | boolean>

export interface CrudListCriteria {
  key: string
  value: CrudCriteriaValue
  type: CrudCriteriaType
}

export interface CrudListQuery {
  page: number
  limit: number
  sortfield?: string
  direction?: CrudSortDirection
  globalSearch?: { type: string; value: string }
  criteria: CrudListCriteria[]
  dashboardFilter?: string
  dashboardQueue?: string
  dashboardEntityId?: string
}

export interface CrudListResponse<TItem> {
  data: TItem[]
  total: number
  page: number
  limit: number
}

export interface CrudFormField<TValues extends FieldValues> {
  name: FieldPath<TValues>
  label: string
  type: CrudFormFieldType
  section?: string
  placeholder?: string
  helperText?: string
  options?: CrudSelectOption[] | ((values: TValues) => CrudSelectOption[])
  disabled?: boolean
  disableOnAddForm?: boolean
  disableOnEditForm?: boolean
  hideOnAddForm?: boolean
  hideOnEditForm?: boolean
  fullWidth?: boolean
  min?: number
  max?: number
  required?: boolean
  defaultValue?: unknown
  step?: number
  rows?: number
  autocomplete?: {
    dropdown?: boolean
    emptyMessage?: string
    forceSelection?: boolean
    minLength?: number
    showEmptyMessage?: boolean
  }
  date?: {
    dateFormat?: CalendarProps['dateFormat']
    hourFormat?: CalendarProps['hourFormat']
    maxDate?: Date
    minDate?: Date
    /** Dynamic minDate derived from current form values — takes precedence over static minDate when defined. */
    minDateFn?: (values: FieldValues) => Date | undefined
    readOnlyInput?: CalendarProps['readOnlyInput']
    selectionMode?: CalendarSelectionMode
    showButtonBar?: CalendarProps['showButtonBar']
    showIcon?: boolean
    showTime?: CalendarProps['showTime']
    touchUI?: CalendarProps['touchUI']
  }
  time?: {
    hourFormat?: CalendarProps['hourFormat']
    readOnlyInput?: CalendarProps['readOnlyInput']
    showButtonBar?: CalendarProps['showButtonBar']
    showIcon?: boolean
    stepHour?: number
    stepMinute?: number
    touchUI?: CalendarProps['touchUI']
  }
  upload?: {
    accept?: string
    chooseLabel?: string
    clearLabel?: string
    emptyMessage?: string
    folder?: string
    multiple?: boolean
    maxFiles?: number
  }
  switch?: {
    checkedLabel?: string
    uncheckedLabel?: string
  }
  emergencyContacts?: {
    maxItems?: number
    relationshipOptions?: CrudSelectOption[]
  }
  attachments?: {
    maxItems?: number
    accept?: string
    documentTypeOptions?: CrudSelectOption[]
    uploadFolder?: string
    documentMetadata?: Partial<DocumentCreatePayload> | ((values: TValues) => Partial<DocumentCreatePayload> | undefined)
  }
  chargeLines?: {
    providerOptions?: CrudSelectOption[]
    codeOptions?: CrudSelectOption[]
  }
  claimLines?: {
    providerOptions?: CrudSelectOption[]
    placeOfServiceOptions?: CrudSelectOption[]
  }
  permissions?: {
    actions?: CrudPermissionAction[]
  }
  tags?: {
    maxItems?: number
    maxLength?: number
    showCharacterCount?: boolean
    commitOnBlur?: boolean
    removeButtonPosition?: 'start' | 'end'
    valueMode?: 'array' | 'string'
    singleValueEditor?: 'chip' | 'textarea'
    rows?: number
    onDeleteOption?: (value: string, values: TValues) => void | Promise<void>
  }
  editableStringList?: {
    variant?: 'prompt' | 'audience'
    itemLabel?: string
    addLabel?: string
    emptyMessage?: string
    maxItems?: number
    maxLength?: number
    rows?: number
  }
  visibleIf?: (values: TValues) => boolean
  action?: {
    label: string
    icon?: ReactNode
    severity?: 'secondary' | 'success' | 'info' | 'warning' | 'danger' | 'help' | 'contrast'
    outlined?: boolean
    loading?: boolean
    className?: string
    helperText?: string
    hiddenWhen?: (context: CrudFormActionContext<TValues>) => boolean
    disabledWhen?: (context: CrudFormActionContext<TValues>) => boolean
    onClick: (context: CrudFormActionContext<TValues>) => void | Promise<void>
  }
  info?: {
    title?: string
    description?: string
    scenarios?: Array<{ label: string; text: string }>
    /** Number of columns for the scenario card grid. Defaults to 1. */
    columns?: 1 | 2 | 3
  }
}


export interface CrudFormConfig<TValues extends FieldValues> {
  schema: ZodType<TValues>
  defaultValues: TValues
  fields: Array<CrudFormField<TValues>>
  columns?: 1 | 2 | 3
  /** Called whenever any form value changes. Use to implement reactive field side-effects (e.g. clearing dependent fields). */
  onValuesChange?: (
    values: TValues,
    prevValues: Partial<TValues>,
    setValue: UseFormSetValue<TValues>,
    getValues: UseFormGetValues<TValues>,
  ) => void
}

export interface CrudFormActionContext<TValues extends FieldValues> {
  values: TValues
  mode: CrudFormMode
  initialValues?: TValues | null
  setValue: UseFormSetValue<TValues>
  getValues: UseFormGetValues<TValues>
  reset: UseFormReset<TValues>
}

export interface CrudTableColumn<TItem> {
  key?: string
  tableViewId?: string
  header: string
  accessorKey?: keyof TItem
  field?: keyof TItem
  filterable?: boolean
  sortable?: boolean
  sortField?: string
  exportable?: boolean
  exportValue?: (item: TItem) => string | number | boolean | null | undefined
  filter?: {
    key?: string
    type?: CrudCriteriaType
    input?: 'text' | 'number' | 'select' | 'multiSelect' | 'date'
    matchModes?: CrudFilterMatchMode[]
    placeholder?: string
    options?: CrudSelectOption[]
  }
  render?: (item: TItem) => ReactNode
  cell?: (value: TItem[keyof TItem] | undefined, item: TItem) => ReactNode
  className?: string
  headerClassName?: string
  defaultVisible?: boolean
  hideable?: boolean
  reorderable?: boolean
}

export interface CrudTableAction<TItem> {
  label: string | ((item: TItem) => string)
  /** Optional tooltip shown on hover. Supports disabled buttons via wrapper span. */
  tooltip?: string | ((item: TItem) => string)
  icon?: ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean | ((item: TItem) => boolean)
  loading?: boolean
  onClick: (item: TItem) => void
}

export type CrudMutationTrigger<TArg, TResult> = (arg: TArg) => {
  unwrap: () => Promise<TResult>
}

export interface CrudMutationState {
  isLoading: boolean
  error?: unknown
}

export interface CrudBulkDeleteConfig<TItem, TPayload = unknown> {
  buttonLabel?: string
  confirmTitle?: string
  confirmMessage?: (items: TItem[]) => string
  confirmLabel?: string
  successMessage?: (items: TItem[]) => string
  mapSelectedItemsToPayload: (items: TItem[]) => TPayload
}

export interface CrudListResult<TItem> {
  data?: CrudListResponse<TItem>
  error?: unknown
  isFetching: boolean
  isLoading: boolean
  refetch: () => unknown
}

export interface CrudApiHooks<
  TItem,
  TCreatePayload,
  TUpdatePayload,
  TBulkDeletePayload = unknown,
  TBulkDeleteResult = unknown,
> {
  useListQuery: (query: CrudListQuery, options?: { skip?: boolean }) => CrudListResult<TItem>
  useCreateMutation?: () => readonly [
    CrudMutationTrigger<TCreatePayload, TItem>,
    CrudMutationState,
  ]
  useUpdateMutation?: () => readonly [
    CrudMutationTrigger<{ id: EntityId; data: TUpdatePayload }, TItem>,
    CrudMutationState,
  ]
  useDeleteMutation?: () => readonly [CrudMutationTrigger<EntityId, EntityId>, CrudMutationState]
  useBulkDeleteMutation?: () => readonly [CrudMutationTrigger<TBulkDeletePayload, TBulkDeleteResult>, CrudMutationState]
}

export interface CrudPageState<TItem> {
  items: TItem[]
  totalRecords: number
  query: CrudListQuery
  setQuery: (query: CrudListQuery) => void
  selectedItems: TItem[]
  setSelectedItems: (items: TItem[]) => void
  openCreateDialog: () => void
  openViewDialog: (item: TItem) => void
  openEditDialog: (item: TItem) => void
  openDeleteDialog: (item: TItem) => void
  refetch: () => unknown
}

export interface CrudPageSlots<TItem> {
  beforeContent?: (state: CrudPageState<TItem>) => ReactNode
  afterContent?: (state: CrudPageState<TItem>) => ReactNode
  toolbarLeft?: (state: CrudPageState<TItem>) => ReactNode
  toolbarRight?: (state: CrudPageState<TItem>) => ReactNode
  rowActions?: (item: TItem, defaultActions: Array<CrudTableAction<TItem>>) => Array<CrudTableAction<TItem>>
  viewContent?: (item: TItem) => ReactNode
  gridItem?: (item: TItem) => ReactNode
}

export interface CrudPageConfig<
  TItem,
  TFormValues extends FieldValues,
  TCreatePayload,
  TUpdatePayload,
  TBulkDeletePayload = unknown,
  TBulkDeleteResult = unknown,
> {
  title: string
  resourceName?: string
  eyebrow?: string
  description?: string
  help?: ScreenHelpContent
  helpChildren?: ReactNode
  showCreateButton?: boolean
  createButtonLabel?: string
  createDialogTitle?: string
  editDialogTitle?: string
  viewDialogTitle?: string
  deleteDialogTitle?: string
  deleteDialogMessage?: (item: TItem) => string
  emptyMessage?: string
  exportFileName?: string
  pageSizeOptions?: number[]
  defaultViewMode?: CrudViewMode
  defaultQuery?: Partial<CrudListQuery>
  permissions?: {
    module: string
  }
  getRowId: (item: TItem) => EntityId
  getRowLabel: (item: TItem) => string
  table: {
    columns: Array<CrudTableColumn<TItem>>
    tableId?: string
    enableSavedViews?: boolean
  }
  form: CrudFormConfig<TFormValues>
  api: CrudApiHooks<TItem, TCreatePayload, TUpdatePayload, TBulkDeletePayload, TBulkDeleteResult>
  mapItemToFormValues: (item: TItem) => TFormValues
  mapFormValuesToCreatePayload: (values: TFormValues) => TCreatePayload
  mapFormValuesToUpdatePayload: (values: TFormValues, item: TItem) => TUpdatePayload
  bulkDelete?: CrudBulkDeleteConfig<TItem, TBulkDeletePayload>
  slots?: CrudPageSlots<TItem>
  rowClassName?: (item: TItem) => string
  style?: {
    viewDialogWidth?: string
    viewDialogMinHeight?: string
    formDialogWidth?: string
  }
}
