import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createProcedureCodeFormConfig,
  createProcedureCodeTableColumns,
  mapProcedureCodeFormToPayload,
  mapProcedureCodeToFormValues,
  renderProcedureCodeDetails,
} from '@/models/procedureCodeModel'
import {
  useCreateProcedureCodeMutation,
  useDeleteProcedureCodeMutation,
  useGetProcedureCodesQuery,
  useUpdateProcedureCodeMutation,
} from '@/services/api/endpoints/procedureCodesApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ProcedureCode, ProcedureCodeCreatePayload, ProcedureCodeFormValues, ProcedureCodeUpdatePayload } from '@/types/procedureCode'

export function ProcedureCodesPage() {
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({}), [])

  const crudConfig: CrudPageConfig<
    ProcedureCode,
    ProcedureCodeFormValues,
    ProcedureCodeCreatePayload,
    ProcedureCodeUpdatePayload
  > = useMemo(
    () => ({
      title: 'Procedure Codes',
      resourceName: 'Procedure Code',
      createButtonLabel: 'Add Procedure Code',
      createDialogTitle: 'Add procedure code',
      editDialogTitle: 'Edit procedure code',
      viewDialogTitle: 'Procedure code details',
      deleteDialogTitle: 'Delete procedure code?',
      emptyMessage: 'No procedure codes found.',
      exportFileName: 'procedure_codes',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'created',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'procedure-codes',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => `${item.code} - ${item.description}`,
      table: {
        columns: createProcedureCodeTableColumns(referenceOptions),
      },
      form: createProcedureCodeFormConfig(referenceOptions),
      api: {
        useListQuery: useGetProcedureCodesQuery,
        useCreateMutation: useCreateProcedureCodeMutation,
        useUpdateMutation: useUpdateProcedureCodeMutation,
        useDeleteMutation: useDeleteProcedureCodeMutation,
      },
      mapItemToFormValues: mapProcedureCodeToFormValues,
      mapFormValuesToCreatePayload: mapProcedureCodeFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapProcedureCodeFormToPayload(values),
      slots: {
        viewContent: (item) => renderProcedureCodeDetails(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}

export default ProcedureCodesPage
