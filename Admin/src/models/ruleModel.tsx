import type { Rule, RuleFormValues, RuleCreatePayload } from '@/types/rule'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from './rcmReferenceOptions'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/utils/date'
import { z } from 'zod'

export const ruleApiDetails = {
  endpoint: 'rcm/rules',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
  filterQueryParam: 'filter',
}

export const ruleFormSchema = z.object({
  ruleId: z.string().trim().min(1, 'Rule ID is required.'),
  type: z.string().trim().min(1, 'Type is required.'),
  message: z.string().trim().min(1, 'Message is required.'),
  severity: z.string().trim().min(1, 'Severity is required.'),
  payerId: z.string().optional(),
  providerId: z.string().optional(),
  facilityId: z.string().optional(),
  state: z.string().optional(),
  placeOfServiceCode: z.string().optional(),
  planName: z.string().optional(),
  groupNumber: z.string().optional(),
  network: z.string().optional(),
  coverageType: z.string().optional(),
  codes: z.array(z.string()).optional(),
  code: z.string().optional(),
  limit: z.string().optional(),
  requiredFields: z.array(z.string()).optional(),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
  active: z.boolean(),
}) as z.ZodType<RuleFormValues>

export const ruleDefaultValues: RuleFormValues = {
  ruleId: '',
  type: '',
  message: '',
  severity: 'warning',
  payerId: '',
  providerId: '',
  facilityId: '',
  state: '',
  placeOfServiceCode: '',
  planName: '',
  groupNumber: '',
  network: '',
  coverageType: '',
  codes: [],
  code: '',
  limit: '',
  requiredFields: [],
  effectiveDate: '',
  expiryDate: '',
  active: true,
}

export function createRuleTableColumns(
  _options: RcmReferenceOptions,
): CrudTableColumn<Rule>[] {
  return [
    {
      header: 'Rule ID',
      accessorKey: 'ruleId',
      sortable: true,
      filterable: true,
    },
    {
      header: 'Type',
      accessorKey: 'type',
      sortable: true,
      filterable: true,
    },
    {
      header: 'Payer',
      accessorKey: 'payerId',
      sortable: true,
      filterable: true,
      cell: (value) => value || 'Any',
    },
    {
      header: 'Code',
      accessorKey: 'code',
      sortable: true,
      filterable: true,
      cell: (value) => value || 'Any',
    },
    {
      header: 'Message',
      accessorKey: 'message',
      sortable: true,
      filterable: true,
    },
    {
      header: 'Severity',
      accessorKey: 'severity',
      cell: (value) => (
        <Badge variant={value === 'error' ? 'destructive' : 'warning'}>
          {String(value).toUpperCase()}
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

export function createRuleFormConfig(
  _options: RcmReferenceOptions,
): CrudFormConfig<RuleFormValues> {
  return {
    schema: ruleFormSchema,
    defaultValues: ruleDefaultValues,
    fields: [
      {
        name: 'ruleId',
        label: 'Rule ID',
        type: 'text',
        placeholder: 'R001',
        required: true,
      },
      {
        name: 'type',
        label: 'Type',
        type: 'select',
        placeholder: 'Select rule type',
        required: true,
        options: [
          { label: 'Invalid Combination', value: 'invalid_combination' },
          { label: 'Frequency Limit', value: 'frequency_limit' },
          { label: 'Missing Required', value: 'missing_required' },
          { label: 'Authorization Required', value: 'auth_required' },
        ],
      },
      {
        name: 'message',
        label: 'Message',
        type: 'text',
        placeholder: 'Enter rule message',
        required: true,
      },
      {
        name: 'severity',
        label: 'Severity',
        type: 'select',
        placeholder: 'Select severity',
        required: true,
        options: [
          { label: 'Error', value: 'error' },
          { label: 'Warning', value: 'warning' },
        ],
      },
      {
        name: 'payerId',
        label: 'Payer ID',
        type: 'autocomplete',
        placeholder: 'Any payer',
        helperText: 'Leave blank for a global rule.',
        options: _options.payers ?? [],
        autocomplete: { dropdown: true, forceSelection: false },
      },
      {
        name: 'code',
        label: 'CPT / HCPCS Code',
        type: 'text',
        placeholder: '99213',
        helperText: 'Leave blank when the rule applies to all codes.',
      },
      {
        name: 'codes',
        label: 'Code Set',
        type: 'chips',
        placeholder: 'Add codes',
        helperText: 'Use for invalid combinations or multi-code payer edits.',
      },
      {
        name: 'providerId',
        label: 'Provider ID',
        type: 'text',
        placeholder: 'Optional provider ID',
      },
      {
        name: 'facilityId',
        label: 'Facility ID',
        type: 'text',
        placeholder: 'Optional facility ID',
      },
      {
        name: 'state',
        label: 'State',
        type: 'text',
        placeholder: 'TX, CA, NY',
      },
      {
        name: 'placeOfServiceCode',
        label: 'Place of Service',
        type: 'text',
        placeholder: '11',
      },
      {
        name: 'planName',
        label: 'Plan Name',
        type: 'text',
        placeholder: 'Optional plan/product name',
      },
      {
        name: 'groupNumber',
        label: 'Group Number',
        type: 'text',
        placeholder: 'Optional employer/group number',
      },
      {
        name: 'network',
        label: 'Network',
        type: 'text',
        placeholder: 'In Network',
      },
      {
        name: 'coverageType',
        label: 'Coverage Type',
        type: 'text',
        placeholder: 'Commercial',
      },
      {
        name: 'limit',
        label: 'Limit',
        type: 'text',
        placeholder: '2 per 30 days',
      },
      {
        name: 'requiredFields',
        label: 'Required Fields',
        type: 'chips',
        placeholder: 'clinicalNotes, modifiers',
      },
      {
        name: 'effectiveDate',
        label: 'Effective Date',
        type: 'date',
      },
      {
        name: 'expiryDate',
        label: 'Expiry Date',
        type: 'date',
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

export function mapRuleToFormValues(item: Rule): RuleFormValues {
  return {
    ruleId: item.ruleId,
    type: item.type,
    message: item.message,
    severity: item.severity,
    payerId: item.payerId ?? '',
    providerId: item.providerId ?? '',
    facilityId: item.facilityId ?? '',
    state: item.state ?? '',
    placeOfServiceCode: item.placeOfServiceCode ?? '',
    planName: item.planName ?? '',
    groupNumber: item.groupNumber ?? '',
    network: item.network ?? '',
    coverageType: item.coverageType ?? '',
    codes: item.codes,
    code: item.code,
    limit: item.limit,
    requiredFields: item.requiredFields,
    effectiveDate: item.effectiveDate ?? '',
    expiryDate: item.expiryDate ?? '',
    active: item.active,
  }
}

export function mapRuleFormToPayload(values: RuleFormValues): RuleCreatePayload {
  return {
    ...values,
    payerId: values.payerId?.trim() || undefined,
    providerId: values.providerId?.trim() || undefined,
    facilityId: values.facilityId?.trim() || undefined,
    state: values.state?.trim().toUpperCase() || undefined,
    placeOfServiceCode: values.placeOfServiceCode?.trim() || undefined,
    planName: values.planName?.trim() || undefined,
    groupNumber: values.groupNumber?.trim() || undefined,
    network: values.network?.trim() || undefined,
    coverageType: values.coverageType?.trim() || undefined,
    code: values.code?.trim().toUpperCase() || undefined,
    codes: values.codes?.map((code) => code.trim().toUpperCase()).filter(Boolean),
    requiredFields: values.requiredFields?.map((field) => field.trim()).filter(Boolean),
    limit: values.limit?.trim() || undefined,
    effectiveDate: values.effectiveDate || undefined,
    expiryDate: values.expiryDate || undefined,
  }
}

export function renderRuleDetails(item: Rule, _options: RcmReferenceOptions) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Rule ID</label>
          <p className="text-base font-semibold">{item.ruleId}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Type</label>
          <p className="text-base font-semibold">{item.type}</p>
        </div>
        <div className="col-span-2">
          <label className="text-sm font-medium text-muted-foreground">Message</label>
          <p className="text-base">{item.message}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Payer</label>
          <p className="text-base font-semibold">{item.payerId || 'Any payer'}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Context</label>
          <p className="text-base font-semibold">{item.state || 'Any state'} / {item.placeOfServiceCode || 'Any POS'}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Plan / Group</label>
          <p className="text-base font-semibold">{item.planName || 'Any plan'} / {item.groupNumber || 'Any group'}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Network / Coverage</label>
          <p className="text-base font-semibold">{item.network || 'Any network'} / {item.coverageType || 'Any coverage'}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Severity</label>
          <p>
            <Badge variant={item.severity === 'error' ? 'destructive' : 'warning'}>
              {item.severity.toUpperCase()}
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
        {item.codes && (
          <div className="col-span-2">
            <label className="text-sm font-medium text-muted-foreground">Codes</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {item.codes.map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {item.code && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">Code</label>
            <p className="text-base">{item.code}</p>
          </div>
        )}
        {item.limit && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">Limit</label>
            <p className="text-base">{item.limit}</p>
          </div>
        )}
        {(item.effectiveDate || item.expiryDate) && (
          <div className="col-span-2">
            <label className="text-sm font-medium text-muted-foreground">Effective Window</label>
            <p className="text-base">
              {item.effectiveDate ? formatDate(item.effectiveDate) : 'No start'} - {item.expiryDate ? formatDate(item.expiryDate) : 'No end'}
            </p>
          </div>
        )}
        {item.requiredFields && (
          <div className="col-span-2">
            <label className="text-sm font-medium text-muted-foreground">Required Fields</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {item.requiredFields.map((f) => (
                <Badge key={f} variant="outline">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
