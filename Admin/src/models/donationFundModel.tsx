import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { DonationFund, DonationFundPayload } from '@/services/api/endpoints/donationApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface DonationFundFormValues {
  _id?: string
  slug: string
  name: string
  description: string
  active: boolean
}

export const donationFundFormSchema = z.object({
  _id: z.string().optional(),
  slug: z.string().trim().min(2, 'Slug must be at least 2 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().trim().min(2, 'Description is required'),
  active: z.boolean(),
}) as z.ZodType<DonationFundFormValues>

export const donationFundDefaultValues: DonationFundFormValues = {
  _id: '',
  slug: '',
  name: '',
  description: '',
  active: true,
}

export function getDonationFundFormConfig(t: TFn): CrudFormConfig<DonationFundFormValues> {
  return {
    schema: donationFundFormSchema,
    defaultValues: donationFundDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'name',
        label: t('Fund name'),
        type: 'text',
        placeholder: t('Enter fund name'),
      },
      {
        name: 'slug',
        label: t('Slug'),
        type: 'text',
        placeholder: 'e.g. annadanam',
        helperText: t('Unique identifier used by the system, e.g. annadanam.'),
      },
      {
        name: 'description',
        label: t('Description'),
        type: 'textarea',
        placeholder: t('Enter fund description'),
        fullWidth: true,
        rows: 4,
      },
      {
        name: 'active',
        label: t('Active'),
        type: 'switch',
        helperText: t('Disable to hide this fund from devotee donations.'),
      },
    ],
  }
}

export function getDonationFundTableColumns(t: TFn): Array<CrudTableColumn<DonationFund>> {
  return [
    {
      key: 'name',
      header: t('Name'),
      field: 'name',
      sortField: 'name',
      filter: {
        key: 'name',
        type: 'regexOr',
        placeholder: t('Search name'),
        matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
    },
    {
      key: 'slug',
      header: t('Slug'),
      field: 'slug',
      filter: {
        key: 'slug',
        type: 'regexOr',
        placeholder: t('Search slug'),
        matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
    },
    {
      key: 'description',
      header: t('Description'),
      field: 'description',
    },
    {
      key: 'active',
      header: t('Active'),
      field: 'active',
      render: (fund) => (fund.active ? t('Active') : t('Inactive')),
    },
  ]
}

export function mapDonationFundToFormValues(fund: DonationFund): DonationFundFormValues {
  return {
    _id: fund._id,
    slug: fund.slug,
    name: fund.name,
    description: fund.description,
    active: fund.active,
  }
}

export function mapDonationFundFormToCreatePayload(values: DonationFundFormValues): DonationFundPayload {
  return {
    slug: values.slug.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    active: values.active,
  }
}

export function mapDonationFundFormToUpdatePayload(
  values: DonationFundFormValues,
): Partial<DonationFundPayload> {
  return mapDonationFundFormToCreatePayload(values)
}
