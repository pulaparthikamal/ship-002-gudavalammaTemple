import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createSocialAutomationFormConfig,
  createSocialAutomationTableColumns,
} from '@/models/socialModel'
import {
  useGetSocialAutomationsQuery,
  useCreateSocialAutomationMutation,
  useUpdateSocialAutomationMutation,
  useDeleteSocialAutomationMutation,
  useToggleSocialAutomationPauseMutation,
  useGetSocialCategoriesQuery,
  useUpdateSocialCategoryMutation,
  useDeleteSocialAudienceSuggestionMutation,
} from '@/services/api/endpoints/socialApi'
import { useGetPlatformsQuery } from '@/services/api/endpoints/platformsApi'
import { useGetTonesQuery } from '@/services/api/endpoints/tonesApi'
import { normalizePlatformValue } from '@/utils/platformValue'
import type { SocialAutomation } from '@/types/social'
import { LayoutGrid, PauseCircle, PlayCircle } from 'lucide-react'
import { toast } from 'react-toastify'

export function SocialAutomationPage() {
  const navigate = useNavigate()

  const { data: categoriesResult } = useGetSocialCategoriesQuery({
    page: 1,
    limit: 100,
    sortfield: 'name',
    direction: 'asc',
    criteria: [],
  })
  const categories = categoriesResult?.data || []
  const { data: platformsList = [] } = useGetPlatformsQuery()
  const { data: tones = [] } = useGetTonesQuery()
  const defaultTone = tones[0]?.name || ''
  const defaultPlatform = platformsList.find(platform => platform.active)?.name
  const defaultPlatformValue = defaultPlatform ? normalizePlatformValue(defaultPlatform) : ''
  const [togglePause] = useToggleSocialAutomationPauseMutation()
  const [updateSocialCategory] = useUpdateSocialCategoryMutation()
  const [deleteGlobalAudienceSuggestion] = useDeleteSocialAudienceSuggestionMutation()

  const handleViewPosts = (automation: SocialAutomation) => {
    navigate(`/socialMedia/automation/${automation._id}/posts`)
  }

  const deleteTopicSuggestion = useCallback(async (value: string, values: any) => {
    const categoryId = values.categoryId
    const category = categories.find((item) => item._id === categoryId)
    if (!category) return

    const nextInterests = (category.interests || []).filter((item) => item !== value)
    await updateSocialCategory({ id: category._id, data: { interests: nextInterests } }).unwrap()
    toast.success('Topic removed from suggestions')
  }, [categories, updateSocialCategory])

  const deleteAudienceSuggestion = useCallback(async (value: string) => {
    await deleteGlobalAudienceSuggestion(value).unwrap()
    toast.success('Target audience removed from suggestions')
  }, [deleteGlobalAudienceSuggestion])

  const config: CrudPageConfig<SocialAutomation, any, any, any, any> = useMemo(() => ({
    title: 'Social Automation',
    resourceName: 'Automation',
    createButtonLabel: 'Add Automation',
    createDialogTitle: 'Add Automation Rule',
    editDialogTitle: 'Edit Automation Rule',
    viewDialogTitle: 'Automation Details',
    emptyMessage: 'No automation rules found.',
    pageSizeOptions: [10, 20, 50],
    defaultQuery: {
      page: 1,
      limit: 20,
      sortfield: 'createdAt',
      direction: 'desc',
      criteria: [],
    },
    permissions: {
      module: 'Automation',
    },

    getRowId: (item) => item._id,
    getRowLabel: (item) => `Automation ${item._id}`,
    table: {
      columns: createSocialAutomationTableColumns(platformsList),
    },
    form: createSocialAutomationFormConfig(categories, {
      onDeleteTopicSuggestion: deleteTopicSuggestion,
      onDeleteAudienceSuggestion: deleteAudienceSuggestion,
    }, {
      defaultTone,
      defaultPlatforms: defaultPlatformValue ? [defaultPlatformValue] : [],
    }),
    api: {
      useListQuery: useGetSocialAutomationsQuery,
      useCreateMutation: useCreateSocialAutomationMutation,
      useUpdateMutation: useUpdateSocialAutomationMutation,
      useDeleteMutation: useDeleteSocialAutomationMutation,
    },
    slots: {
      rowActions: (item, defaultActions) => [
        ...defaultActions,
        {
          label: item.isActive ? 'Pause Automation' : 'Resume Automation',
          icon: item.isActive ? <PauseCircle className="h-4 w-4 text-amber-500" /> : <PlayCircle className="h-4 w-4 text-emerald-500" />,
          onClick: async (clickedItem) => {
            await togglePause(clickedItem._id).unwrap()
          }
        },
        {
          label: 'View Posts',
          icon: <LayoutGrid className="h-4 w-4" />,
          onClick: handleViewPosts,
        }
      ]
    },
    rowClassName: (item) => !item.isActive ? 'bg-slate-50 [&>td:not(:last-child)]:opacity-50 [&>td:not(:last-child)]:grayscale' : '',
    mapItemToFormValues: (item) => ({
      ...item,
      categoryId: item.categoryId && typeof item.categoryId === 'object' ? item.categoryId._id : item.categoryId,
      // Convert null → undefined/'' so Zod doesn't see null for optional date fields
      fixedDate: item.fixedDate ?? '',
      startDate: item.startDate ?? '',
      hasEndDate: !!item.endDate,
      endDate: item.endDate ?? '',
      time: item.time ?? '',
      targetAudience: item.targetAudience ?? '',
      customDays: item.customDays ?? [],
      approvalEmail: item.approvalEmail ?? '',
    }),
    mapFormValuesToCreatePayload: (values) => {
      const payload = { ...values }
      if (payload.fixedDate instanceof Date) payload.fixedDate = payload.fixedDate.toISOString()
      if (payload.startDate instanceof Date) payload.startDate = payload.startDate.toISOString()
      if (!payload.hasEndDate) {
        payload.endDate = null
      } else if (payload.endDate instanceof Date) {
        payload.endDate = payload.endDate.toISOString()
      }
      if (payload.time instanceof Date) {
        const hours = String(payload.time.getHours()).padStart(2, '0')
        const minutes = String(payload.time.getMinutes()).padStart(2, '0')
        payload.time = `${hours}:${minutes}`
      }
      return payload
    },
    mapFormValuesToUpdatePayload: (values) => {
      const payload = { ...values }
      if (payload.fixedDate instanceof Date) payload.fixedDate = payload.fixedDate.toISOString()
      if (payload.startDate instanceof Date) payload.startDate = payload.startDate.toISOString()
      if (!payload.hasEndDate) {
        payload.endDate = null
      } else if (payload.endDate instanceof Date) {
        payload.endDate = payload.endDate.toISOString()
      }
      if (payload.time instanceof Date) {
        const hours = String(payload.time.getHours()).padStart(2, '0')
        const minutes = String(payload.time.getMinutes()).padStart(2, '0')
        payload.time = `${hours}:${minutes}`
      }
      return payload
    },


  }), [categories, platformsList, tones, defaultTone, defaultPlatformValue, navigate, deleteTopicSuggestion, deleteAudienceSuggestion])

  return (
    <div className="w-full">
      <CrudPage config={config} />
    </div>
  )
}
