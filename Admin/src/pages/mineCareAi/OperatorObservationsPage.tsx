import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import {
  createMineCareObservationFormConfig,
  createMineCareObservationTableColumns,
  mapMineCareObservationFormToPayload,
  mapMineCareObservationToFormValues,
  renderMineCareObservationDetails,
  useCreateMineCareObservationCrudMutation,
  useMineCareObservationCrudListQuery,
  type MineCareObservationFormValues,
} from '@/models/mineCareObservationModel'
import { useGetMineCareEquipmentQuery } from '@/services/api/endpoints/mineCareAiApi'
import type { CrudPageConfig } from '@/types/crud'
import type { MineCareObservation } from '@/types/mineCareAi'

export function MineCareOperatorObservationsPage() {
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const equipmentOptions = useMemo(
    () => equipment.map((item) => ({ label: `${item.type} ${item.equipmentId}`, value: item.equipmentId })),
    [equipment],
  )

  const crudConfig: CrudPageConfig<
    MineCareObservation,
    MineCareObservationFormValues,
    ReturnType<typeof mapMineCareObservationFormToPayload>,
    ReturnType<typeof mapMineCareObservationFormToPayload>
  > = useMemo(
    () => ({
      title: 'Operator Observations',
      resourceName: 'Observation',
      eyebrow: 'MineCare AI',
      description: 'Capture field observations that feed service risk and alerts.',
      createButtonLabel: 'Add Observation',
      createDialogTitle: 'Add observation',
      viewDialogTitle: 'Observation details',
      emptyMessage: 'No operator observations found.',
      exportFileName: 'minecare-operator-observations',
      pageSizeOptions: [10, 20, 50],
      defaultViewMode: 'list',
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'observationDate',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'minecare-ai',
      },
      getRowId: (item) => item._id || `${item.equipmentId}-${item.observationDate}-${item.observationType}`,
      getRowLabel: (item) => `${item.equipmentId} observation`,
      table: {
        columns: createMineCareObservationTableColumns(),
      },
      form: createMineCareObservationFormConfig(equipmentOptions),
      api: {
        useListQuery: useMineCareObservationCrudListQuery,
        useCreateMutation: useCreateMineCareObservationCrudMutation,
      },
      mapItemToFormValues: mapMineCareObservationToFormValues,
      mapFormValuesToCreatePayload: mapMineCareObservationFormToPayload,
      mapFormValuesToUpdatePayload: mapMineCareObservationFormToPayload,
      slots: {
        viewContent: renderMineCareObservationDetails,
      },
      style: {
        formDialogWidth: 'min(760px, 95vw)',
        viewDialogWidth: 'min(760px, 95vw)',
      },
    }),
    [equipmentOptions],
  )

  return <CrudPage config={crudConfig} />
}
