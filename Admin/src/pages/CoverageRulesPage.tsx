import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createCoverageRuleFormConfig,
  createCoverageRuleTableColumns,
  getCoverageRuleRowLabel,
  mapCoverageRuleFormToPayload,
  mapCoverageRuleToFormValues,
  renderCoverageRuleDetails,
} from '@/models/coverageRuleModel'
import { useGetChargeMastersQuery } from '@/services/api/endpoints/chargeMastersApi'
import {
  useCreateCoverageRuleMutation,
  useDeleteCoverageRuleMutation,
  useGetCoverageRulesQuery,
  useUpdateCoverageRuleMutation,
} from '@/services/api/endpoints/coverageRulesApi'
import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilitiesApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type {
  CoverageRule,
  CoverageRuleCreatePayload,
  CoverageRuleFormValues,
  CoverageRuleUpdatePayload,
} from '@/types/coverageRule'

const lookupQuery = {
  page: 1,
  limit: 200,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

export function CoverageRulesPage() {
  const payersQuery = useGetPayersQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)
  const facilitiesQuery = useGetFacilitiesQuery(lookupQuery)
  const chargeMastersQuery = useGetChargeMastersQuery(lookupQuery)

  const payerOptions = useMemo(
    () =>
      (payersQuery.data?.data ?? [])
        .filter((item) => item.payerId)
        .map((item) => ({
          label: [item.payerName, item.payerId, item.ediPayerId ? `EDI ${item.ediPayerId}` : undefined]
            .filter(Boolean)
            .join(' - '),
          value: item.payerId ?? item._id,
        })),
    [payersQuery.data],
  )

  const providerOptions = useMemo(
    () =>
      (providersQuery.data?.data ?? []).map((item) => ({
        label: [
          [item.firstName, item.lastName, item.credentials].filter(Boolean).join(' '),
          item.npi ? `NPI ${item.npi}` : undefined,
        ]
          .filter(Boolean)
          .join(' - ') || item._id,
        value: item._id,
      })),
    [providersQuery.data],
  )

  const facilityOptions = useMemo(
    () =>
      (facilitiesQuery.data?.data ?? []).map((item) => ({
        label: [
          item.facilityName || item.facilityCode || item._id,
          item.state,
          item.placeOfServiceCode ? `POS ${item.placeOfServiceCode}` : undefined,
        ]
          .filter(Boolean)
          .join(' - '),
        value: item._id,
      })),
    [facilitiesQuery.data],
  )

  const chargeMasterCodeOptions = useMemo(
    () => {
      const codeMap = new Map<
        string,
        {
          code: string
          description?: string
          placeOfServices: Set<string>
          defaultChargeAmount?: number
        }
      >()

      for (const item of chargeMastersQuery.data?.data ?? []) {
        const code = item.cptCode?.trim().toUpperCase()

        if (!code || item.active === false || item.isDeleted) {
          continue
        }

        const current = codeMap.get(code) ?? {
          code,
          description: item.description,
          placeOfServices: new Set<string>(),
          defaultChargeAmount: item.defaultChargeAmount,
        }

        if (!current.description && item.description) {
          current.description = item.description
        }

        if (item.placeOfService) {
          current.placeOfServices.add(item.placeOfService)
        }

        if (current.defaultChargeAmount === undefined && item.defaultChargeAmount !== undefined) {
          current.defaultChargeAmount = item.defaultChargeAmount
        }

        codeMap.set(code, current)
      }

      return Array.from(codeMap.values())
        .sort((left, right) => left.code.localeCompare(right.code))
        .map((item) => {
          const posValues = Array.from(item.placeOfServices).sort()
          const parts = [
            item.code,
            item.description,
            posValues.length ? `POS ${posValues.join(', ')}` : undefined,
            item.defaultChargeAmount !== undefined ? `Billed $${item.defaultChargeAmount.toFixed(2)}` : undefined,
          ].filter(Boolean)

          return {
            label: parts.join(' - '),
            value: item.code,
          }
        })
    },
    [chargeMastersQuery.data],
  )

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      chargeMasterCodes: chargeMasterCodeOptions,
      facilities: facilityOptions,
      payers: payerOptions,
      providers: providerOptions,
    }),
    [chargeMasterCodeOptions, facilityOptions, payerOptions, providerOptions],
  )

  const crudConfig: CrudPageConfig<
    CoverageRule,
    CoverageRuleFormValues,
    CoverageRuleCreatePayload,
    CoverageRuleUpdatePayload
  > = useMemo(
    () => ({
      title: 'Coverage Rules',
      resourceName: 'Coverage Rule',
      createButtonLabel: 'Add Coverage Rule',
      createDialogTitle: 'Add coverage rule',
      editDialogTitle: 'Edit coverage rule',
      viewDialogTitle: 'Coverage rule details',
      deleteDialogTitle: 'Delete coverage rule?',
      emptyMessage: 'No coverage rules found.',
      exportFileName: 'coverage_rules',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'created',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'coverage-rules',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => getCoverageRuleRowLabel(item, referenceOptions),
      table: {
        columns: createCoverageRuleTableColumns(referenceOptions),
      },
      form: createCoverageRuleFormConfig(referenceOptions),
      api: {
        useListQuery: useGetCoverageRulesQuery,
        useCreateMutation: useCreateCoverageRuleMutation,
        useUpdateMutation: useUpdateCoverageRuleMutation,
        useDeleteMutation: useDeleteCoverageRuleMutation,
      },
      mapItemToFormValues: mapCoverageRuleToFormValues,
      mapFormValuesToCreatePayload: mapCoverageRuleFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapCoverageRuleFormToPayload(values),
      slots: {
        viewContent: (item) => renderCoverageRuleDetails(item, referenceOptions),
      },
      style: {
        formDialogWidth: 'min(96vw, 64rem)',
        viewDialogWidth: 'min(96vw, 64rem)',
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}

export default CoverageRulesPage
