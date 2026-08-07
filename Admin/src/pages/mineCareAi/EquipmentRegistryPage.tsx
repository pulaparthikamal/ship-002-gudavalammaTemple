import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import { Button } from 'primereact/button'
import { CrudPage } from '@/components/crud/CrudPage'
import {
  createMineCareEquipmentFormConfig,
  createMineCareEquipmentTableColumns,
  mapMineCareEquipmentFormToPayload,
  mapMineCareEquipmentToFormValues,
  renderMineCareEquipmentDetails,
  renderMineCareEquipmentGridItem,
  useBulkDeleteMineCareEquipmentCrudMutation,
  useCreateMineCareEquipmentCrudMutation,
  useDeleteMineCareEquipmentCrudMutation,
  useMineCareEquipmentCrudListQuery,
  useUpdateMineCareEquipmentCrudMutation,
  type MineCareBulkDeletePayload,
  type MineCareEquipmentFormValues,
} from '@/models/mineCareEquipmentModel'
import type { CrudPageConfig } from '@/types/crud'
import type { MineCareEquipment } from '@/types/mineCareAi'

export function MineCareEquipmentRegistryPage() {
  const navigate = useNavigate()
  const crudConfig: CrudPageConfig<
    MineCareEquipment,
    MineCareEquipmentFormValues,
    ReturnType<typeof mapMineCareEquipmentFormToPayload>,
    ReturnType<typeof mapMineCareEquipmentFormToPayload>,
    MineCareBulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Equipment Registry',
      resourceName: 'Equipment',
      eyebrow: 'MineCare AI',
      description: 'Register mine equipment, warranty details, current hours, criticality, and OEM service schedules.',
      showCreateButton: false,
      createButtonLabel: 'Add Equipment',
      createDialogTitle: 'Add equipment',
      editDialogTitle: 'Edit equipment',
      viewDialogTitle: 'Equipment details',
      deleteDialogTitle: 'Delete equipment?',
      emptyMessage: 'No equipment found.',
      exportFileName: 'minecare-equipment',
      pageSizeOptions: [10, 20, 50],
      defaultViewMode: 'list',
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'equipmentId',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'minecare-ai',
      },
      getRowId: (item) => item.equipmentId,
      getRowLabel: (item) => item.name,
      table: {
        columns: createMineCareEquipmentTableColumns(),
      },
      form: createMineCareEquipmentFormConfig(),
      api: {
        useListQuery: useMineCareEquipmentCrudListQuery,
        useCreateMutation: useCreateMineCareEquipmentCrudMutation,
        useUpdateMutation: useUpdateMineCareEquipmentCrudMutation,
        useDeleteMutation: useDeleteMineCareEquipmentCrudMutation,
        useBulkDeleteMutation: useBulkDeleteMineCareEquipmentCrudMutation,
      },
      mapItemToFormValues: mapMineCareEquipmentToFormValues,
      mapFormValuesToCreatePayload: mapMineCareEquipmentFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapMineCareEquipmentFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected equipment?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'asset' : 'assets'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'asset' : 'assets'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          selectedIds: items.map((item) => item.equipmentId),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete "${item.name}" (${item.equipmentId}).`,
      slots: {
        toolbarRight: () => (
          <Button
            type="button"
            label="Onboard Equipment"
            icon={<UploadCloud className="h-4 w-4" />}
            className="flex items-center gap-1 h-8 px-4 text-xs font-bold"
            onClick={() => navigate('/minecare-ai/equipment/new')}
          />
        ),
        viewContent: renderMineCareEquipmentDetails,
        gridItem: renderMineCareEquipmentGridItem,
      },
      style: {
        formDialogWidth: 'min(1100px, 95vw)',
        viewDialogWidth: 'min(900px, 95vw)',
      },
    }),
    [navigate],
  )

  return <CrudPage config={crudConfig} />
}
