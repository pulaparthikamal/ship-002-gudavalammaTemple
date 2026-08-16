import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getAssetFormConfig,
  getAssetTableColumns,
  mapAssetFormToCreatePayload,
  mapAssetFormToUpdatePayload,
  mapAssetToFormValues,
  getRenderAssetDetails,
  getRenderAssetGridItem,
} from '@/models/assetModel'
import {
  useBulkDeleteAssetsMutation,
  useCreateAssetMutation,
  useDeleteAssetMutation,
  useGetAssetsQuery,
  useUpdateAssetMutation,
} from '@/services/api/endpoints/assetsApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { Asset, AssetCreatePayload, AssetFormValues, AssetUpdatePayload } from '@/types/asset'

type AssetBulkDeletePayload = {
  ids: EntityId[]
}

export function AssetsPage() {
  const { t } = useStaffTranslation()

  const assetsCrudConfig: CrudPageConfig<
    Asset,
    AssetFormValues,
    AssetCreatePayload,
    AssetUpdatePayload,
    AssetBulkDeletePayload
  > = useMemo(
    () => ({
      title: t('Assets'),
      resourceName: t('Asset'),
      createButtonLabel: t('Add Asset'),
      createDialogTitle: t('Add Asset'),
      editDialogTitle: t('Edit asset'),
      viewDialogTitle: t('Asset details'),
      emptyMessage: t('No assets found.'),
      exportFileName: 'assets',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'asset',
      },
      getRowId: (asset: Asset) => asset._id,
      getRowLabel: (asset: Asset) => asset.name,
      table: {
        columns: getAssetTableColumns(t),
      },
      form: getAssetFormConfig(t),
      api: {
        useBulkDeleteMutation: useBulkDeleteAssetsMutation,
        useListQuery: useGetAssetsQuery,
        useCreateMutation: useCreateAssetMutation,
        useUpdateMutation: useUpdateAssetMutation,
        useDeleteMutation: useDeleteAssetMutation,
      },
      mapItemToFormValues: mapAssetToFormValues,
      mapFormValuesToCreatePayload: mapAssetFormToCreatePayload,
      mapFormValuesToUpdatePayload: mapAssetFormToUpdatePayload,
      bulkDelete: {
        buttonLabel: t('staff.crud.deleteSelected'),
        confirmTitle: t('Delete selected assets?'),
        confirmLabel: t('staff.crud.deleteSelected'),
        confirmMessage: (assets: Asset[]) =>
          t('staff.crud.deleteSelectedMessage', {
            count: assets.length,
            resource: assets.length === 1 ? t('Asset') : t('Assets'),
          }),
        successMessage: (assets: Asset[]) =>
          t('staff.crud.bulkDeletedSuccess', {
            count: assets.length,
            resource: assets.length === 1 ? t('Asset') : t('Assets'),
          }),
        mapSelectedItemsToPayload: (assets: Asset[]) => ({
          ids: assets.map((asset) => asset._id),
        }),
      },
      deleteDialogMessage: (asset: Asset) => t('This will permanently delete {{name}}.', { name: asset.name }),
      slots: {
        viewContent: getRenderAssetDetails(t),
        gridItem: getRenderAssetGridItem(t),
      },
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={assetsCrudConfig} />
    </div>
  )
}
