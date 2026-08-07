import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createRuleFormConfig,
  createRuleTableColumns,
  mapRuleFormToPayload,
  mapRuleToFormValues,
  renderRuleDetails,
} from '@/models/ruleModel'
import {
  useCreateRuleMutation,
  useDeleteRuleMutation,
  useGetRulesQuery,
  useUpdateRuleMutation,
} from '@/services/api/endpoints/rulesApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Rule, RuleCreatePayload, RuleFormValues, RuleUpdatePayload } from '@/types/rule'

export function RulesPage() {
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({}), [])

  const crudConfig: CrudPageConfig<
    Rule,
    RuleFormValues,
    RuleCreatePayload,
    RuleUpdatePayload
  > = useMemo(
    () => ({
      title: 'Validation Rules',
      resourceName: 'Rule',
      createButtonLabel: 'Add Rule',
      createDialogTitle: 'Add rule',
      editDialogTitle: 'Edit rule',
      viewDialogTitle: 'Rule details',
      deleteDialogTitle: 'Delete rule?',
      emptyMessage: 'No rules found.',
      exportFileName: 'validation_rules',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'created',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'rules',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => `${item.ruleId} - ${item.type}`,
      table: {
        columns: createRuleTableColumns(referenceOptions),
      },
      form: createRuleFormConfig(referenceOptions),
      api: {
        useListQuery: useGetRulesQuery,
        useCreateMutation: useCreateRuleMutation,
        useUpdateMutation: useUpdateRuleMutation,
        useDeleteMutation: useDeleteRuleMutation,
      },
      mapItemToFormValues: mapRuleToFormValues,
      mapFormValuesToCreatePayload: mapRuleFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapRuleFormToPayload(values),
      slots: {
        viewContent: (item) => renderRuleDetails(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}

export default RulesPage
