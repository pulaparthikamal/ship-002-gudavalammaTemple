import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createSocialCategoryFormConfig,
  createSocialCategoryTableColumns,
} from '@/models/socialModel'
import {
  useGetSocialCategoriesQuery,
  useCreateSocialCategoryMutation,
  useUpdateSocialCategoryMutation,
  useDeleteSocialCategoryMutation,
} from '@/services/api/endpoints/socialApi'
import type { SocialCategory } from '@/types/social'

export function SocialCategoriesPage() {
  const config: CrudPageConfig<SocialCategory, any, any, any, any> = useMemo(() => ({
    title: 'Social Categories',
    resourceName: 'Category',
    createButtonLabel: 'Add Category',
    createDialogTitle: 'Add Category',
    editDialogTitle: 'Edit Category',
    viewDialogTitle: 'Category Details',
    emptyMessage: 'No categories found.',
    pageSizeOptions: [10, 20, 50],
    defaultQuery: {
      page: 1,
      limit: 20,
      sortfield: 'name',
      direction: 'asc',
      criteria: [],
    },
    permissions: {
      module: 'mediaCategories',
    },

    getRowId: (item) => item._id,
    getRowLabel: (item) => item.name,
    table: {
      columns: createSocialCategoryTableColumns(),
    },
    form: createSocialCategoryFormConfig(),
    api: {
      useListQuery: useGetSocialCategoriesQuery,
      useCreateMutation: useCreateSocialCategoryMutation,
      useUpdateMutation: useUpdateSocialCategoryMutation,
      useDeleteMutation: useDeleteSocialCategoryMutation,
    },
    mapItemToFormValues: (item) => ({
      _id: item._id,
      name: item.name,
      interests: item.interests,
      audienceSuggestions: item.audienceSuggestions ?? [],
      isActive: item.isActive,
    }),
    mapFormValuesToCreatePayload: (values) => values,
    mapFormValuesToUpdatePayload: (values) => values,
  }), [])

  return <CrudPage config={config} />
}
