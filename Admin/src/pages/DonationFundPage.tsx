import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getDonationFundFormConfig,
  getDonationFundTableColumns,
  mapDonationFundFormToCreatePayload,
  mapDonationFundFormToUpdatePayload,
  mapDonationFundToFormValues,
  type DonationFundFormValues,
} from '@/models/donationFundModel'
import {
  useCreateDonationFundMutation,
  useDeleteDonationFundMutation,
  useGetDonationFundsQuery,
  useUpdateDonationFundMutation,
  type DonationFund,
  type DonationFundPayload,
} from '@/services/api/endpoints/donationApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'

function useDonationFundListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetDonationFundsQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function DonationFundPage() {
  const { t } = useStaffTranslation()

  const donationFundCrudConfig: CrudPageConfig<
    DonationFund,
    DonationFundFormValues,
    DonationFundPayload,
    Partial<DonationFundPayload>
  > = useMemo(
    () => ({
      title: t('Donation Funds'),
      resourceName: t('Donation Fund'),
      createButtonLabel: t('Add Fund'),
      createDialogTitle: t('Add Donation Fund'),
      editDialogTitle: t('Edit donation fund'),
      viewDialogTitle: t('Donation fund details'),
      emptyMessage: t('No donation funds found.'),
      exportFileName: 'donation-funds',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'name',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'donationFund',
      },
      getRowId: (fund: DonationFund) => fund._id,
      getRowLabel: (fund: DonationFund) => fund.name,
      table: {
        columns: getDonationFundTableColumns(t),
      },
      form: getDonationFundFormConfig(t),
      api: {
        useListQuery: useDonationFundListQuery,
        useCreateMutation: useCreateDonationFundMutation,
        useUpdateMutation: useUpdateDonationFundMutation,
        useDeleteMutation: useDeleteDonationFundMutation,
      },
      mapItemToFormValues: mapDonationFundToFormValues,
      mapFormValuesToCreatePayload: mapDonationFundFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: DonationFundFormValues) => mapDonationFundFormToUpdatePayload(values),
      deleteDialogMessage: (fund: DonationFund) => t('This will permanently delete {{name}}.', { name: fund.name }),
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={donationFundCrudConfig} />
    </div>
  )
}
