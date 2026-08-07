import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createClaimAiReviewFormConfig, createClaimAiReviewTableColumns, mapClaimAiReviewFormToPayload, mapClaimAiReviewToFormValues, renderClaimAiReviewDetails, renderClaimAiReviewGridItem } from '@/models/claimAiReviewModel'
import { useGetClaimAiReviewsQuery } from '@/services/api/endpoints/claimAiReviewsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ClaimAiReview, ClaimAiReviewCreatePayload, ClaimAiReviewFormValues, ClaimAiReviewUpdatePayload } from '@/types/claimAiReview'

type BulkDeletePayload = {
  ids: EntityId[]
}

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'created',
  direction: 'desc' as const,
  criteria: [],
}

export function ClaimAiReviewsPage() {
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const claimsOptions = useMemo(
    () =>
      (claimsQuery.data?.data ?? []).map((item) => ({
        label: [item.claimDate, item.claimStatus, item.batchId].filter(Boolean).join(' / ') || item._id,
        value: item._id,
      })),
    [claimsQuery.data],
  )
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({
    claims: claimsOptions,
  }), [claimsOptions])

  const crudConfig: CrudPageConfig<
    ClaimAiReview,
    ClaimAiReviewFormValues,
    ClaimAiReviewCreatePayload,
    ClaimAiReviewUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Claim AI Reviews',
      resourceName: 'Claim AI Review',
      showCreateButton: false,
      createButtonLabel: 'Add Claim AI Review',
      createDialogTitle: 'Add claim ai review',
      editDialogTitle: 'Edit claim ai review',
      viewDialogTitle: 'Claim AI Review details',
      deleteDialogTitle: 'Delete claim ai review?',
      emptyMessage: 'No claim ai reviews found.',
      exportFileName: 'claim-ai-reviews',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'claim-ai-reviews',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => [item.reviewStatus, item.denialPrediction.riskLevel].filter(Boolean).join(' / ') || String(item._id),
      table: {
        columns: createClaimAiReviewTableColumns(referenceOptions),
      },
      form: createClaimAiReviewFormConfig(referenceOptions),
      api: {
        useListQuery: useGetClaimAiReviewsQuery,
      },
      mapItemToFormValues: mapClaimAiReviewToFormValues,
      mapFormValuesToCreatePayload: mapClaimAiReviewFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapClaimAiReviewFormToPayload(values),
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        viewContent: (item) => renderClaimAiReviewDetails(item, referenceOptions),
        gridItem: (item) => renderClaimAiReviewGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}
