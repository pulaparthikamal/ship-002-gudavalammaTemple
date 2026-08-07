import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import {
  createMediaCategoryFormConfig,
  createMediaCategoryTableColumns,
  mapCategoryFormToCreatePayload,
  mapCategoryFormToUpdatePayload,
  mapCategoryToFormValues,
  renderCategoryDetails,
  renderCategoryGridItem,
} from '@/models/mediaCategoryModel'
import {
  useBulkDeleteMediaCategoriesMutation,
  useCreateMediaCategoryMutation,
  useDeleteMediaCategoryMutation,
  useGetMediaCategoriesQuery,
  useUpdateMediaCategoryMutation,
  useGenerateMediaCategoryContentMutation,
} from '@/services/api/endpoints/mediaCategoriesApi'
import type { EntityId } from '@/types/common'
import type {
  MediaCategory,
  MediaCategoryCreatePayload,
  MediaCategoryFormValues,
  MediaCategoryUpdatePayload
} from '@/types/mediaCategory'

import { useGetInterestedTopicsQuery } from '@/services/api/endpoints/interestedTopicsApi'
import { useGetPublishingFrequenciesQuery } from '@/services/api/endpoints/publishingFrequencyApi'

export function MediaCategoriesPage() {
  const { showToast } = useToast()
  const [generateContent] = useGenerateMediaCategoryContentMutation()
  
  // Fetch dynamic options
  const { data: interestTopics = [] } = useGetInterestedTopicsQuery()
  const { data: frequencyOptions = [] } = useGetPublishingFrequenciesQuery()

  type CategoryBulkDeletePayload = {
    selectedIds: EntityId[]
  }

  const categoriesCrudConfig: CrudPageConfig<
    MediaCategory,
    MediaCategoryFormValues,
    MediaCategoryCreatePayload,
    MediaCategoryUpdatePayload,
    CategoryBulkDeletePayload
  > =
    useMemo(
      () => ({
        title: 'Media Categories',
        resourceName: 'Category',
        createButtonLabel: 'Add Category',
        createDialogTitle: 'Add Media Category',
        editDialogTitle: 'Edit Category',
        viewDialogTitle: 'Category Details',
        emptyMessage: 'No categories found.',
        pageSizeOptions: [10, 20, 50],
        defaultQuery: {
          page: 1,
          limit: 20,
          sortfield: 'updatedAt',
          direction: 'desc',
          criteria: [],
        },
        permissions: {
          module: 'mediaCategories',
        },
        getRowId: (category) => category._id,
        getRowLabel: (category) => category.name,
        table: {
          columns: createMediaCategoryTableColumns(),
        },
        form: createMediaCategoryFormConfig(interestTopics, frequencyOptions),
        api: {
          useBulkDeleteMutation: useBulkDeleteMediaCategoriesMutation,
          useListQuery: useGetMediaCategoriesQuery,
          useCreateMutation: useCreateMediaCategoryMutation,
          useUpdateMutation: useUpdateMediaCategoryMutation,
          useDeleteMutation: useDeleteMediaCategoryMutation,
        },
        mapItemToFormValues: (category) => mapCategoryToFormValues(category),
        mapFormValuesToCreatePayload: mapCategoryFormToCreatePayload,
        mapFormValuesToUpdatePayload: mapCategoryFormToUpdatePayload,
        bulkDelete: {
          buttonLabel: 'Delete Selected',
          confirmTitle: 'Delete selected categories?',
          confirmLabel: 'Delete Selected',
          confirmMessage: (categories) =>
            `This will permanently delete ${categories.length} selected ${categories.length === 1 ? 'category' : 'categories'
            }.`,
          successMessage: (categories) =>
            `${categories.length} ${categories.length === 1 ? 'category' : 'categories'} deleted successfully.`,
          mapSelectedItemsToPayload: (categories) => ({
            selectedIds: categories.map((category) => category._id),
          }),
        },
        deleteDialogMessage: (category) =>
          `This will permanently delete the category "${category.name}".`,
        slots: {
          viewContent: (category) => renderCategoryDetails(category),
          gridItem: (category) => renderCategoryGridItem(category),
          rowActions: (_category, defaultActions) => {
            const generateAction = {
              label: 'Generate Content',
              icon: <Sparkles className="h-4 w-4" />,
              onClick: async (item: MediaCategory) => {
                try {
                  showToast({
                    severity: 'info',
                    summary: 'Generating Content',
                    detail: `Generating content for "${item.name}"...`,
                    life: 3000,
                  })
                  await generateContent(item._id).unwrap()
                  showToast({
                    severity: 'success',
                    summary: 'Success',
                    detail: `Content generated successfully for "${item.name}"`,
                    life: 3000,
                  })
                } catch (error: any) {
                  showToast({
                    severity: 'error',
                    summary: 'Error',
                    detail: error.data?.message || error.message || 'Failed to generate content',
                    life: 5000,
                  })
                }
              },
            }

            const actions = [...defaultActions]
            actions.splice(1, 0, generateAction)
            return actions
          },
        },
        style: {
          viewDialogWidth: '70%',
          viewDialogMinHeight: '70%',
        }
      }),
      [generateContent, showToast, interestTopics, frequencyOptions],
    )

  return <CrudPage config={categoriesCrudConfig} />
}
