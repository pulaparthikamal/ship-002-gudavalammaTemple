import type { ProcedureCode, ProcedureCodeFormValues, ProcedureCodeCreatePayload } from '@/types/procedureCode'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from './rcmReferenceOptions'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/utils/format'
import { z } from 'zod'

export const procedureCodeApiDetails = {
  endpoint: 'rcm/procedure-codes',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
  filterQueryParam: 'filter',
}

export const procedureCodeFormSchema = z.object({
  code: z.string().trim().min(1, 'Code is required.'),
  description: z.string().trim().min(1, 'Description is required.'),
  chargeFee: z.number(),
  category: z.string().trim().min(1, 'Category is required.'),
  requiresAuth: z.boolean(),
  frequencyLimit: z.string().optional(),
  active: z.boolean(),
}) as z.ZodType<ProcedureCodeFormValues>

export const procedureCodeDefaultValues: ProcedureCodeFormValues = {
  code: '',
  description: '',
  chargeFee: 0,
  category: '',
  requiresAuth: false,
  frequencyLimit: '',
  active: true,
}

export function createProcedureCodeTableColumns(
  _options: RcmReferenceOptions,
): CrudTableColumn<ProcedureCode>[] {
  return [
    {
      header: 'Code',
      accessorKey: 'code',
      sortable: true,
      filterable: true,
    },
    {
      header: 'Description',
      accessorKey: 'description',
      sortable: true,
      filterable: true,
    },
    {
      header: 'Category',
      accessorKey: 'category',
      sortable: true,
      filterable: true,
    },
    {
      header: 'Charge Fee',
      accessorKey: 'chargeFee',
      sortable: true,
      cell: (value) => formatCurrency(Number(value)),
    },
    {
      header: 'Auth Required',
      accessorKey: 'requiresAuth',
      cell: (value) => (
        <Badge variant={value ? 'destructive' : 'secondary'}>
          {value ? 'Yes' : 'No'}
        </Badge>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'active',
      cell: (value) => (
        <Badge variant={value ? 'success' : 'secondary'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]
}

export function createProcedureCodeFormConfig(
  _options: RcmReferenceOptions,
): CrudFormConfig<ProcedureCodeFormValues> {
  return {
    schema: procedureCodeFormSchema,
    defaultValues: procedureCodeDefaultValues,
    fields: [
      {
        name: 'code',
        label: 'Code',
        type: 'text',
        placeholder: 'Enter Procedure Code',
        required: true,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'text',
        placeholder: 'Enter Description',
        required: true,
      },
      {
        name: 'category',
        label: 'Category',
        type: 'text',
        placeholder: 'Enter Category',
        required: true,
      },
      {
        name: 'chargeFee',
        label: 'Charge Fee',
        type: 'number',
        placeholder: '0.00',
        required: true,
      },
      {
        name: 'frequencyLimit',
        label: 'Frequency Limit',
        type: 'text',
        placeholder: 'Enter Frequency Limit',
      },
      {
        name: 'requiresAuth',
        label: 'Requires Authorization',
        type: 'checkbox',
        defaultValue: false,
      },
      {
        name: 'active',
        label: 'Active',
        type: 'checkbox',
        defaultValue: true,
      },
    ],
  }
}

export function mapProcedureCodeToFormValues(item: ProcedureCode): ProcedureCodeFormValues {
  return {
    code: item.code,
    description: item.description,
    category: item.category,
    chargeFee: item.chargeFee,
    frequencyLimit: item.frequencyLimit,
    requiresAuth: item.requiresAuth,
    active: item.active,
  }
}

export function mapProcedureCodeFormToPayload(values: ProcedureCodeFormValues): ProcedureCodeCreatePayload {
  return values
}

export function renderProcedureCodeDetails(item: ProcedureCode, _options: RcmReferenceOptions) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Code</label>
          <p className="text-base font-semibold">{item.code}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Category</label>
          <p className="text-base font-semibold">{item.category}</p>
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium text-muted-foreground">Description</label>
          <p className="text-base">{item.description}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Charge Fee</label>
          <p className="text-base font-semibold">{formatCurrency(item.chargeFee)}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Frequency Limit</label>
          <p className="text-base">{item.frequencyLimit || '-'}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Auth Required</label>
          <p>
            <Badge variant={item.requiresAuth ? 'destructive' : 'secondary'}>
              {item.requiresAuth ? 'Yes' : 'No'}
            </Badge>
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <p>
            <Badge variant={item.active ? 'success' : 'secondary'}>
              {item.active ? 'Active' : 'Inactive'}
            </Badge>
          </p>
        </div>
      </div>
    </div>
  )
}
