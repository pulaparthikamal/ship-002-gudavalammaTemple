import { useMemo, useState, useEffect, useCallback } from 'react'
import { GeneratingPostsContext, PostingPostsContext, EmailFailedPostsContext } from '@/context/GeneratingPostsContext'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createSocialPostTableColumns,
  createSocialPostFormConfig,
} from '@/models/socialModel'
import {
  useGetSocialPostsQuery,
  useCreateSocialPostMutation,
  useUpdateSocialPostMutation,
  useDeleteSocialPostMutation,
  useBulkDeleteSocialPostsMutation,
  useSendSocialPostNowMutation,
  useSendSocialPostApprovalEmailMutation,
  useGeneratePostContentMutation,
  useGetFacebookPagesQuery,
  useGetSocialCategoriesQuery,
  useUpdateSocialCategoryMutation,
  useDeleteSocialAudienceSuggestionMutation,
  useBulkApprovePostsMutation,
  useBulkRejectPostsMutation,
} from '@/services/api/endpoints/socialApi'
import { useGetPlatformsQuery } from '@/services/api/endpoints/platformsApi'
import { useGetTonesQuery } from '@/services/api/endpoints/tonesApi'
import type { SocialPost } from '@/types/social'
import { TabView, TabPanel } from 'primereact/tabview'
import { Sparkles, Send, Check, Briefcase, LayoutGrid, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { Dropdown } from 'primereact/dropdown'
import { useAppSelector, useAppDispatch } from '@/hooks/redux'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { apiSlice } from '@/services/api/apiSlice'
import { toast } from 'react-toastify'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { cn } from '@/utils/classNames'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { ShortFormVideoContent } from '@/components/social/ShortFormVideoContent'
import { CreatorResearchInformation } from '@/components/social/CreatorResearchInformation'
import { OpenAiWebSearchMainBlock, OpenAiWebSearchMasterArticle, isOpenAiWebSearchInformation } from '@/components/social/OpenAiWebSearchReport'

function renderTextBlock(label: string, value?: string) {
  if (!value?.trim()) return null

  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg">
      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">{label}</span>
      <div className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{value}</div>
    </div>
  )
}

function renderListBlock(label: string, values?: string[]) {
  if (!values?.length) return null

  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg">
      <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">{label}</span>
      <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
        {values.map((value, index) => <li key={`${label}-${index}`}>{value}</li>)}
      </ul>
    </div>
  )
}

function renderChapterBlock(chapters?: Array<{ timestamp?: string; title?: string }>) {
  if (!chapters?.length) return null

  return (
    <div className="p-3 bg-white border border-slate-200 rounded-lg">
      <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">Chapters</span>
      <div className="space-y-1 text-sm text-slate-700">
        {chapters.map((chapter, index) => (
          <div key={`chapter-${index}`} className="flex gap-2">
            <span className="font-semibold text-slate-500">{chapter.timestamp || '-'}</span>
            <span>{chapter.title || 'Untitled chapter'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function hasMarkdownSection(text: string | undefined, section: string) {
  if (!text?.trim()) return false
  return new RegExp(`^\\s*#+\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(text)
}

function renderDescriptionExtra(description: string | undefined, label: string, value?: string) {
  if (hasMarkdownSection(description, label)) return null
  return renderTextBlock(label, value)
}

function renderDescriptionListExtra(description: string | undefined, label: string, values?: string[]) {
  if (hasMarkdownSection(description, label)) return null
  return renderListBlock(label, values)
}

function renderYoutubeContent(youtube: NonNullable<SocialPost['platformSpecificContent']>['youtube']) {
  if (!youtube) return null

  const description = youtube.description

  return (
    <div className="space-y-3 p-4">
      <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
        <span className="text-[10px] font-black uppercase text-red-500 block mb-1">SEO Title</span>
        <div className="font-bold text-slate-800">{youtube.title}</div>
      </div>
      {renderTextBlock('Description', description)}
      {renderDescriptionExtra(description, 'Video Angle', youtube.video_angle)}
      {renderDescriptionExtra(description, 'Target Audience', youtube.target_audience)}
      {renderDescriptionExtra(description, 'Business Summary', youtube.business_summary)}
      {renderDescriptionExtra(description, 'Why Watch Now', youtube.why_watch_now)}
      {renderDescriptionExtra(description, 'Business Impact & Opportunities', youtube.business_impact_opportunities)}
      {renderDescriptionListExtra(description, 'Key Talking Points', youtube.key_talking_points)}
      {renderDescriptionListExtra(description, 'Actionable Recommendations', youtube.actionable_recommendations)}
      {renderDescriptionListExtra(description, 'Proof Points Or Examples', youtube.proof_points_or_examples)}
      {renderDescriptionListExtra(description, 'Viewer Takeaways', youtube.viewer_takeaways)}
      {renderDescriptionExtra(description, 'Discussion Question', youtube.discussion_question)}
      {!hasMarkdownSection(description, 'Chapter-By-Chapter Content') && renderChapterBlock(youtube.chapters)}
      {renderListBlock('Tags', youtube.tags)}
      {renderTextBlock('Thumbnail Text', youtube.thumbnail_text)}
      {renderTextBlock('Thumbnail Concept', youtube.thumbnail_concept)}
      {renderTextBlock('Pinned Comment', youtube.pinned_comment)}
      {renderTextBlock('Community Post', youtube.community_post)}
      {renderDescriptionListExtra(description, 'Shorts Ideas', youtube.shorts_ideas)}
      {renderTextBlock('Script', youtube.script)}
      <ShortFormVideoContent content={youtube} accentClassName="text-red-600" />
    </div>
  )
}

const KNOWN_PLATFORM_KEYS = new Set(['instagram', 'linkedin', 'facebook', 'youtube'])

function platformLabel(platform: string) {
  return platform.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function renderGenericPlatformContent(platform: string, content: Record<string, any>) {
  const video = content.shortFormVideo || content.short_form_video
  const hiddenKeys = new Set(['shortFormVideo', 'short_form_video'])

  return (
    <div className="space-y-3 p-4">
      {Object.entries(content).map(([key, value]) => {
        if (hiddenKeys.has(key) || value == null || value === '') return null
        const label = platformLabel(key)
        if (typeof value === 'string') return renderTextBlock(label, value)
        if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
          return renderListBlock(label, value)
        }
        return renderTextBlock(label, JSON.stringify(value, null, 2))
      })}
      <ShortFormVideoContent content={{ shortFormVideo: video }} accentClassName="text-violet-600" />
      {!Object.keys(content).length && renderTextBlock(platformLabel(platform), 'No platform content returned.')}
    </div>
  )
}

function GenerationBriefSummary({ brief }: { brief?: SocialPost['generationBrief'] }) {
  if (!brief || brief.mode !== 'custom_brief') return null

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-violet-700">Custom Brief Applied</div>
      {brief.resolved_summary && <div className="mt-2 text-sm font-semibold text-slate-800">{brief.resolved_summary}</div>}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        {(brief.requested_platforms?.length ? brief.requested_platforms : brief.resolved_platforms)?.map((platform) => (
          <span key={platform} className="rounded-full bg-white px-2 py-1 font-semibold">{platformLabel(platform)}</span>
        ))}
        {brief.duration_seconds ? <span className="rounded-full bg-white px-2 py-1 font-semibold">{brief.duration_seconds} seconds</span> : null}
        {brief.explicit_dimensions?.map((dimension) => (
          <span key={dimension} className="rounded-full bg-white px-2 py-1">{platformLabel(dimension)}</span>
        ))}
      </div>
    </div>
  )
}

function getCategoryIdValue(category: unknown) {
  if (!category) return ''
  if (typeof category === 'string') return category
  if (typeof category === 'object') {
    const maybeCategory = category as { _id?: unknown; id?: unknown; name?: unknown; toString?: () => string }
    if (maybeCategory._id) return String(maybeCategory._id)
    if (maybeCategory.id) return String(maybeCategory.id)
    if (typeof maybeCategory.toString === 'function') return maybeCategory.toString()
  }
  return String(category)
}

function resolveCategoryIdForForm(post: SocialPost, categories: Array<{ _id: unknown; name?: string }>) {
  const directCategoryId = getCategoryIdValue(post.categoryId)
  if (directCategoryId && categories.some((category) => String(category._id) === directCategoryId)) {
    return directCategoryId
  }

  if (post.categoryId && typeof post.categoryId === 'object' && 'name' in post.categoryId) {
    const categoryName = String(post.categoryId.name || '').trim().toLowerCase()
    const matchedCategory = categories.find((category) => category.name?.trim().toLowerCase() === categoryName)
    if (matchedCategory) return String(matchedCategory._id)
  }

  const automationCategory = post.automationId && typeof post.automationId === 'object' ? post.automationId.categoryId : undefined
  const automationCategoryId = getCategoryIdValue(automationCategory)
  if (automationCategoryId && categories.some((category) => String(category._id) === automationCategoryId)) {
    return automationCategoryId
  }

  if (automationCategory && typeof automationCategory === 'object' && 'name' in automationCategory) {
    const categoryName = String(automationCategory.name || '').trim().toLowerCase()
    const matchedCategory = categories.find((category) => category.name?.trim().toLowerCase() === categoryName)
    if (matchedCategory) return String(matchedCategory._id)
  }

  return directCategoryId
}

function getCategoryDisplayName(category: unknown, fallback = '—') {
  if (!category) return fallback
  if (typeof category === 'object') {
    const maybeCategory = category as { name?: unknown; _id?: unknown; toString?: () => string }
    if (maybeCategory.name) return String(maybeCategory.name)
    if (maybeCategory._id) return String(maybeCategory._id)
    if (typeof maybeCategory.toString === 'function') return maybeCategory.toString()
  }
  return String(category)
}


// ---------------------------------------------------------------------------
// Industry-standard: always send UTC ISO strings to the backend.
// The browser's .toISOString() converts the user's local time to UTC
// automatically (e.g. 7:00 AM IST → "2026-06-07T01:30:00.000Z").
// The server stores and compares in UTC.
// The UI displays in user local time via new Date(utcStr).toLocaleString().
// ---------------------------------------------------------------------------

export function SocialPostsPage() {
  const dispatch = useAppDispatch()
  const { data: categoriesData } = useGetSocialCategoriesQuery({ page: 1, limit: 100, criteria: [] })
  const { data: platformsList = [] } = useGetPlatformsQuery()
  const { data: tones = [] } = useGetTonesQuery()
  const defaultTone = tones[0]?.name || ''
  
  const getPlatformData = (name: string) => {
    return platformsList.find(p => p.name.toLowerCase().includes(name.toLowerCase()))
  }
  const [generateContent] = useGeneratePostContentMutation()
  const [updatePost] = useUpdateSocialPostMutation()
  const [sendPostNow] = useSendSocialPostNowMutation()
  const [sendApprovalEmail] = useSendSocialPostApprovalEmailMutation()
  const [updateSocialCategory] = useUpdateSocialCategoryMutation()
  const [deleteGlobalAudienceSuggestion] = useDeleteSocialAudienceSuggestionMutation()

  // Tracks which post IDs are currently generating AI content.
  const [generatingPostIds, setGeneratingPostIds] = useState<Set<string>>(new Set())

  // Tracks which post IDs are currently being published via send-now.
  const [postingPostIds, setPostingPostIds] = useState<Set<string>>(new Set())

  // Tracks which post IDs had their approval email fail to send.
  const [emailFailedPostIds, setEmailFailedPostIds] = useState<Set<string>>(new Set())

  const [sendDialogVisible, setSendDialogVisible] = useState(false)
  const [errorDialogVisible, setErrorDialogVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [postToSend, setPostToSend] = useState<SocialPost | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [targetPageId, setTargetPageId] = useState<string>('')

  const user = useAppSelector(selectCurrentUser)
  const { data: fbPagesResponse } = useGetFacebookPagesQuery(user?.id || '', { skip: !user?.id })
  const fbPages = fbPagesResponse?.data || []

  const [selectedPosts, setSelectedPosts] = useState<SocialPost[]>([])
  const [bulkApprove] = useBulkApprovePostsMutation()
  const [bulkReject] = useBulkRejectPostsMutation()

  const handleBulkApprove = async () => {
    const ids = selectedPosts.map(p => String(p._id))
    try {
      const result = await bulkApprove({ ids }).unwrap()
      toast.success(`Approved ${result.data?.updated ?? ids.length} post(s)`)
      setSelectedPosts([])
    } catch { toast.error('Bulk approve failed') }
  }

  const handleBulkReject = async () => {
    const ids = selectedPosts.map(p => String(p._id))
    try {
      const result = await bulkReject({ ids, reason: 'Rejected from dashboard' }).unwrap()
      toast.success(`Rejected ${result.data?.updated ?? ids.length} post(s)`)
      setSelectedPosts([])
    } catch { toast.error('Bulk reject failed') }
  }

  useEffect(() => {
    if (fbPages.length > 0) {
      const active = fbPages.find((p: any) => p.isActive)
      setTargetPageId(active?.pageId || fbPages[0].pageId)
    }
  }, [fbPages])

  const activePlatforms = platformsList.filter(p => p.active)
  const socialCategories = categoriesData?.data || []

  const resolvePostCategoryName = useCallback((post: SocialPost) => {
    if (post.categoryId) {
      if (typeof post.categoryId === 'object' && 'name' in post.categoryId && post.categoryId.name) return post.categoryId.name
      const categoryId = getCategoryIdValue(post.categoryId)
      return socialCategories.find(category => String(category._id) === categoryId)?.name || 'Social Media'
    }

    const automationCategory = post.automationId && typeof post.automationId === 'object' ? post.automationId.categoryId : undefined
    if (automationCategory && typeof automationCategory === 'object') return automationCategory.name

    return 'Social Media'
  }, [socialCategories])

  const deleteTopicSuggestion = useCallback(async (value: string, values: any) => {
    const categoryId = values.categoryId
    const category = socialCategories.find((item) => item._id === categoryId)
    if (!category) return

    const nextInterests = (category.interests || []).filter((item) => item !== value)
    await updateSocialCategory({ id: category._id, data: { interests: nextInterests } }).unwrap()
    toast.success('Topic removed from suggestions')
  }, [socialCategories, updateSocialCategory])

  const deleteAudienceSuggestion = useCallback(async (value: string) => {
    await deleteGlobalAudienceSuggestion(value).unwrap()
    toast.success('Target audience removed from suggestions')
  }, [deleteGlobalAudienceSuggestion])


  const handleGenerateAI = useCallback(async (post: SocialPost) => {
    if (!post.topic) {
      toast.warning('Please set a topic for this post first')
      return
    }

    const postId = String(post._id)

    // Add this post ID to the generating set — StatusBadge reads from context and shows spinner
    setGeneratingPostIds(prev => new Set(prev).add(postId))

    try {
      const sourceTopic = post.sourceTopic || post.topic
      toast.info(`Generating content for: ${sourceTopic}...`)
      const result = await generateContent({
        category: resolvePostCategoryName(post),
        interests: [sourceTopic],
        tone: post.tone || 'professional',
        targetAudience: post.targetAudience || undefined,
        userId: user?.id || undefined,
      }).unwrap()

      if (result.success) {
        await updatePost({
          id: postId,
          data: {
            content: result.data.content,
            mediaUrl: result.data.mediaUrl,
            mediaUrls: result.data.mediaUrls,
            platformSpecificContent: result.data.platformSpecificContent,
            additionalInformation: result.data.additionalInformation,
            generationBrief: result.data.generationBrief,
            instagramHtml: result.data.instagramHtml
          }
        }).unwrap()

        if (post.postType === 'ai') {
          try {
            await sendApprovalEmail(postId).unwrap()
            // Clear any previous email failure for this post
            setEmailFailedPostIds(prev => { const next = new Set(prev); next.delete(postId); return next })
            toast.success('AI Content generated and approval email sent!')
          } catch (e) {
            // Mark this post as email-failed so ApprovalBadge shows the correct state
            setEmailFailedPostIds(prev => new Set(prev).add(postId))
            toast.error('Content generated, but failed to send approval email.')
          }
        } else {
          toast.success('Content generated successfully!')
        }
      }

    } catch (error) {
      toast.error('Failed to generate content')
    } finally {
      // Remove spinner
      setGeneratingPostIds(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
      // Force a final refetch AFTER the entire chain (generate → update → approval email)
      // so the Approval column reflects the latest server state (e.g. "email_sent").
      // The intermediate updatePost invalidation may have refetched too early.
      dispatch(apiSlice.util.invalidateTags(['SocialPost']))
    }
  }, [generateContent, updatePost, sendApprovalEmail, dispatch, user?.id])

  const handleSendPostNow = (post: SocialPost) => {
    const pType = (post.postType || '').toLowerCase();
    const status = pType === 'ai' ? (post.approvalStatus || 'content_generation_pending') : (post.approvalStatus || 'not_required');
    
    if (status !== 'approved' && status !== 'not_required') {
      const msg = status === 'rejected' 
        ? 'This post has been rejected and cannot be published.' 
        : 'This post is not approved. Current status: ' + status.replace(/_/g, ' ');
      setErrorMessage(msg);
      setErrorDialogVisible(true);
      return
    }

    setPostToSend(post)
    // Use platforms array if available, otherwise fallback to singular platform
    const initialPlatforms = post.platforms?.length 
      ? post.platforms 
      : (post as any).platform ? [(post as any).platform] : []
    setSelectedPlatforms(initialPlatforms)
    setSendDialogVisible(true)
  }

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }

  const confirmSend = async () => {
    if (!postToSend || selectedPlatforms.length === 0) {
      toast.warning('Please select at least one platform')
      return
    }

    // Platforms with a working send-now backend dispatcher
    const supportedPlatforms = ['facebook', 'linkedin', 'instagram', 'youtube']
    
    const pType = (postToSend.postType || '').toLowerCase();
    const status = pType === 'ai' ? (postToSend.approvalStatus || 'content_generation_pending') : (postToSend.approvalStatus || 'not_required');
    if (status !== 'approved' && status !== 'not_required') {
      const msg = status === 'rejected' 
        ? 'This post has been rejected and cannot be published.' 
        : 'This post is not approved. Current status: ' + status.replace(/_/g, ' ');
      setErrorMessage(msg);
      setErrorDialogVisible(true);
      return
    }

    if (postToSend.status === 'posted') {
      toast.info('This post has already been published')
      return
    }

    // Video guard only applies to Facebook (LinkedIn video is handled backend-side)
    if (selectedPlatforms.includes('facebook') && postToSend.videoUrl) {
      toast.warning('Facebook video posting is not supported from this screen yet')
      return
    }

    if (!postToSend.content?.trim() && !postToSend.topic?.trim()) {
      toast.warning('Please add content or a topic before sending this post')
      return
    }

    try {
      // YouTube specific validation
      if (selectedPlatforms.includes('youtube') && !postToSend.videoUrl && !postToSend.mediaUrl) {
        toast.error('YouTube requires a video file. Please upload a video in the "Video" field.')
        return
      }

      setSendDialogVisible(false)

      const postId = String(postToSend._id)

      // Mark as posting so StatusBadge shows the blue "Posting..." spinner
      setPostingPostIds(prev => new Set(prev).add(postId))

      const sendPromises = selectedPlatforms.map(async (platform) => {
        if (!supportedPlatforms.includes(platform)) {
          toast.warning(`${platform.charAt(0).toUpperCase() + platform.slice(1)} posting is coming soon!`)
          return
        }

        toast.info(`Publishing post to ${platform}...`)

        try {
          // Use platform override in the API call to target a specific platform from the selection
          await sendPostNow({
            id: postId,
            pageId: platform === 'facebook' ? targetPageId : undefined,
            platform
          }).unwrap()
          toast.success(`Post published to ${platform} successfully`)
        } catch (err: any) {
          toast.error(`Failed to publish to ${platform}: ${err?.data?.respMessage || err?.message}`)
        }
      })

      await Promise.all(sendPromises)

      // Remove spinner and force a final refetch so status column shows posted/failed
      setPostingPostIds(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
      dispatch(apiSlice.util.invalidateTags(['SocialPost']))

    } catch (error: any) {
      toast.error(error?.data?.respMessage || error?.message || 'Failed to publish post')
      // Ensure spinner is cleared even on unexpected outer error
      if (postToSend) {
        const postId = String(postToSend._id)
        setPostingPostIds(prev => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      }
    }
  }

  const config: CrudPageConfig<SocialPost, any, any, any, any> = useMemo(() => ({
    title: 'Social Posts',
    resourceName: 'Post',
    showCreateButton: true,
    createButtonLabel: 'New Post',
    createDialogTitle: 'Manually Create Post',
    editDialogTitle: 'Edit Post',
    viewDialogTitle: 'Post Details',
    emptyMessage: 'No posts found.',
    pageSizeOptions: [10, 20, 50],
    defaultQuery: {
      page: 1,
      limit: 20,
      sortfield: 'createdAt',
      direction: 'desc',
      criteria: [],
    },
    permissions: {
      module: 'SocialAutomationPosts',
    },

    getRowId: (item) => item._id,
    getRowLabel: (item) => `Post ${item._id}`,
    table: {
      columns: createSocialPostTableColumns(platformsList),
    },
    form: createSocialPostFormConfig(socialCategories, {
      onDeleteTopicSuggestion: deleteTopicSuggestion,
      onDeleteAudienceSuggestion: deleteAudienceSuggestion,
    }, {
      defaultTone,
    }),
    api: {
      useListQuery: useGetSocialPostsQuery,
      useCreateMutation: useCreateSocialPostMutation,
      useUpdateMutation: useUpdateSocialPostMutation,
      useDeleteMutation: useDeleteSocialPostMutation,
      useBulkDeleteMutation: useBulkDeleteSocialPostsMutation,
    },
    rowClassName: (item) => item.status === 'paused' ? 'bg-slate-50 [&>td:not(:last-child)]:opacity-50 [&>td:not(:last-child)]:grayscale [&_.p-disabled]:grayscale' : '',
    bulkDelete: {
      mapSelectedItemsToPayload: (items) => ({ ids: items.map((item) => item._id) }),
      buttonLabel: 'Delete Selected',
      confirmTitle: 'Delete Selected Posts?',
      confirmMessage: (items) => `Are you sure you want to delete ${items.length} selected post(s)?`,
    },
    slots: {
      rowActions: (_item, defaultActions) => {
        const modifiedDefaultActions = defaultActions.map(action => {
          if (typeof action.label === 'string' && action.label.includes('Edit')) {
            return {
              ...action,
              disabled: (item: SocialPost) => item.status === 'paused' || (typeof action.disabled === 'function' ? action.disabled(item) : !!action.disabled),
              tooltip: (item: SocialPost) => item.status === 'paused' ? 'Action disabled while paused' : (typeof action.tooltip === 'function' ? action.tooltip(item) : action.tooltip ?? '')
            }
          }
          return action;
        });

        return [
        ...modifiedDefaultActions,
        {
          label: 'Generate AI Content',
          icon: <Sparkles className="h-4 w-4" />,
          disabled: (item: SocialPost) => item.status === 'paused',
          tooltip: (item: SocialPost) => item.status === 'paused' ? 'Action disabled while paused' : '',
          onClick: handleGenerateAI,
        },
        // Approve/Reject — only for AI posts (manual posts skip approval workflow)
        ...((_item.postType === 'ai') ? [
          {
            label: (_item.status === 'paused' ? 'Paused' : _item.approvalStatus === 'approved' ? 'Already Approved' : 'Approve') as string,
            icon: <CheckCircle className="h-4 w-4" />,
            tooltip: (item: SocialPost) => item.status === 'paused' ? 'Action disabled while paused' : '',
            disabled: (item: SocialPost) => item.approvalStatus === 'approved' || item.status === 'paused',
            onClick: async (item: SocialPost) => {
              try {
                await bulkApprove({ ids: [String(item._id)] }).unwrap()
                toast.success('Post approved')
              } catch { toast.error('Failed to approve post') }
            },
          },
          {
            label: (_item.status === 'paused' ? 'Paused' : _item.approvalStatus === 'rejected' ? 'Already Rejected' : 'Reject') as string,
            icon: <XCircle className="h-4 w-4" />,
            tone: 'danger' as const,
            tooltip: (item: SocialPost) => item.status === 'paused' ? 'Action disabled while paused' : '',
            disabled: (item: SocialPost) => item.approvalStatus === 'rejected' || item.status === 'paused',
            onClick: async (item: SocialPost) => {
              try {
                await bulkReject({ ids: [String(item._id)], reason: 'Rejected from dashboard' }).unwrap()
                toast.success('Post rejected')
              } catch { toast.error('Failed to reject post') }
            },
          },
        ] : []),
        {
          label: (item: SocialPost) => {
            const isAi = item.postType === 'ai';
            const approved = !isAi || item.approvalStatus === 'approved';
            return approved ? 'Send Post Now' : 'Awaiting Approval';
          },
          tooltip: (item: SocialPost) =>
            item.status === 'paused' ? 'Post is paused' :
            (item.postType === 'ai' && item.approvalStatus !== 'approved'
              ? 'Approve the Post to Send'
              : 'Send Post Now'),
          icon: <Send className="h-4 w-4" />,
          onClick: handleSendPostNow,
          disabled: (item: SocialPost) =>
            item.status === 'paused' || (item.postType === 'ai' && item.approvalStatus !== 'approved'),
        }
      ];
    },

      viewContent: (item) => {
        return (
          <div className="space-y-6">
            <GenerationBriefSummary brief={item.generationBrief} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Platform</span>
                <div className="text-sm font-semibold capitalize flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", item.status === 'posted' ? 'bg-green-500' : 'bg-amber-500')}></span>
                  {item.platforms?.join(', ')}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Status</span>
                <div className="text-sm font-semibold capitalize">{item.status}</div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Post Type</span>
                <div className="text-sm font-semibold capitalize flex items-center gap-2">
                  {item.postType === 'ai' ? <Sparkles className="h-3 w-3 text-[var(--color-primary)]" /> : null}
                  {item.postType}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Category</span>
                <div className="text-sm font-semibold">
                  {item.categoryId
                    ? getCategoryDisplayName(item.categoryId)
                    : item.automationId && typeof item.automationId === 'object' && typeof item.automationId.categoryId === 'object'
                      ? item.automationId.categoryId.name
                      : '—'}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Scheduled At</span>
                <div className="text-sm font-semibold">{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : 'Now'}</div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Topic</span>
              <div className="text-base font-bold text-[var(--color-primary)]">{item.topic}</div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Content Explorer</span>
              <TabView className="premium-tabs border rounded-xl overflow-hidden">
                {isOpenAiWebSearchInformation(item.additionalInformation) && (
                  <TabPanel header={<span>Main</span>}>
                    <OpenAiWebSearchMainBlock report={item.additionalInformation} />
                  </TabPanel>
                )}
                <TabPanel header={<span><Briefcase className="inline h-3 w-3 mr-1" /> Master Article</span>}>
                  <OpenAiWebSearchMasterArticle report={item.additionalInformation} fallbackContent={item.content} />
                </TabPanel>
                
                {item.platformSpecificContent?.instagram && (
                  <TabPanel header={
                    <span>
                      <PlatformIcon 
                        icon={getPlatformData('instagram')?.icon} 
                        svg={getPlatformData('instagram')?.svg} 
                        color={getPlatformData('instagram')?.color} 
                        size={14} 
                        className="inline mr-1" 
                      /> 
                      Instagram
                    </span>
                  }>
                    <div className="p-4 bg-gradient-to-br from-[#fdf2f8] to-[#fff1f2] text-sm leading-relaxed whitespace-pre-wrap">
                      {item.platformSpecificContent.instagram.caption}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {item.platformSpecificContent.instagram.hashtags?.map((h, idx) => (
                          <span key={idx} className="text-[#db2777] font-medium hover:underline cursor-pointer">{h}</span>
                        ))}
                      </div>
                      <ShortFormVideoContent content={item.platformSpecificContent.instagram} accentClassName="text-[#db2777]" />
                    </div>
                  </TabPanel>
                )}

                {item.platformSpecificContent?.linkedin && (
                  <TabPanel header={
                    <span>
                      <PlatformIcon 
                        icon={getPlatformData('linkedin')?.icon} 
                        svg={getPlatformData('linkedin')?.svg} 
                        color={getPlatformData('linkedin')?.color} 
                        size={14} 
                        className="inline mr-1" 
                      /> 
                      LinkedIn
                    </span>
                  }>
                    <div className="p-4 bg-gradient-to-br from-[#f0f9ff] to-[#ecfeff] text-sm leading-relaxed whitespace-pre-wrap">
                      {item.platformSpecificContent.linkedin.content}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {item.platformSpecificContent.linkedin.hashtags?.map((h, idx) => (
                          <span key={idx} className="text-[#0369a1] font-medium hover:underline cursor-pointer">{h}</span>
                        ))}
                      </div>
                      <ShortFormVideoContent content={item.platformSpecificContent.linkedin} accentClassName="text-[#0369a1]" />
                    </div>
                  </TabPanel>
                )}

                {item.platformSpecificContent?.facebook && (
                  <TabPanel header={
                    <span>
                      <PlatformIcon 
                        icon={getPlatformData('facebook')?.icon} 
                        svg={getPlatformData('facebook')?.svg} 
                        color={getPlatformData('facebook')?.color} 
                        size={14} 
                        className="inline mr-1" 
                      /> 
                      Facebook
                    </span>
                  }>
                    <div className="p-4 bg-gradient-to-br from-[#eff6ff] to-[#f0f9ff] text-sm leading-relaxed whitespace-pre-wrap">
                      {item.platformSpecificContent.facebook.caption}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {item.platformSpecificContent.facebook.hashtags?.map((h, idx) => (
                          <span key={idx} className="text-[#2563eb] font-medium hover:underline cursor-pointer">{h}</span>
                        ))}
                      </div>
                      <ShortFormVideoContent content={item.platformSpecificContent.facebook} accentClassName="text-[#2563eb]" />
                    </div>
                  </TabPanel>
                )}

                {item.platformSpecificContent?.youtube && (
                  <TabPanel header={
                    <span>
                      <PlatformIcon 
                        icon={getPlatformData('youtube')?.icon} 
                        svg={getPlatformData('youtube')?.svg} 
                        color={getPlatformData('youtube')?.color} 
                        size={14} 
                        className="inline mr-1" 
                      /> 
                      YouTube
                    </span>
                  }>
                    {renderYoutubeContent(item.platformSpecificContent.youtube)}
                  </TabPanel>
                )}

                {Object.entries(item.platformSpecificContent || {})
                  .filter(([platform, content]) => !KNOWN_PLATFORM_KEYS.has(platform) && content && typeof content === 'object')
                  .map(([platform, content]) => (
                    <TabPanel key={platform} header={<span>{platformLabel(platform)}</span>}>
                      {renderGenericPlatformContent(platform, content as Record<string, any>)}
                    </TabPanel>
                  ))}
              </TabView>
            </div>

            <CreatorResearchInformation report={item.additionalInformation} />


            {/* ── Media Gallery ── */}
            {(() => {
              const allImages = item.mediaUrls?.length
                ? item.mediaUrls
                : item.mediaUrl ? [item.mediaUrl] : []
              const hasVideo = Boolean(item.videoUrl)
              if (!allImages.length && !hasVideo) return null

              return (
                <div className="space-y-4">
                  {/* Images */}
                  {allImages.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">
                        Images ({allImages.length})
                      </span>
                      <div className={`grid gap-3 ${allImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {allImages.map((url, i) => (
                          <div key={i} className="relative rounded-xl overflow-hidden bg-black border border-[var(--color-border)] group">
                            <img
                              src={resolveApiAssetUrl(url)}
                              alt={`Image ${i + 1}`}
                              className="w-full object-contain max-h-[280px]"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-white text-xs font-medium">{i + 1}/{allImages.length}</span>
                              <a
                                href={resolveApiAssetUrl(url)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-white/80 hover:text-white text-xs underline"
                              >↗ Open full</a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video */}
                  {hasVideo && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Video</span>
                      <div className="rounded-xl overflow-hidden border-2 border-[var(--color-border)] bg-black shadow-lg">
                        <video
                          src={resolveApiAssetUrl(item.videoUrl)}
                          controls
                          className="w-full max-h-[360px] object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

          </div>
        );
      }
    },

    // Populate form values — convert scheduledAt string → Date so the picker
    // uses .getHours()/.getMinutes() (always local time), not a raw UTC string
    mapItemToFormValues: (item: any) => {
      const scheduledAt = item.scheduledAt
        ? (() => { const d = new Date(item.scheduledAt!); return isNaN(d.getTime()) ? undefined : d })()
        : undefined
      
      // Ensure platforms is an array (handle migration from singular platform)
      const platforms = Array.isArray(item.platforms) 
        ? item.platforms 
        : item.platform ? [item.platform] : ['facebook']

      return {
        ...item,
        categoryId: resolveCategoryIdForForm(item, socialCategories),
        platforms,
        scheduledAt,
        mediaUrls: item.mediaUrls?.length
          ? item.mediaUrls
          : item.mediaUrl ? [item.mediaUrl] : [],
      }
    },

    mapFormValuesToCreatePayload: (values) => {
      const payload: any = { ...values }
      if (!payload.categoryId) delete payload.categoryId
      // Always send UTC ISO string — browser toISOString() converts local → UTC
      // e.g. user picks 7:00 AM IST → stored as "...T01:30:00.000Z" (UTC)
      if (payload.scheduledAt instanceof Date) payload.scheduledAt = payload.scheduledAt.toISOString()
      else if (typeof payload.scheduledAt === 'string' && payload.scheduledAt) {
        const d = new Date(payload.scheduledAt)
        if (!isNaN(d.getTime())) payload.scheduledAt = d.toISOString()
      }
      
      // Sync mediaUrl from mediaUrls[0]
      if (Array.isArray(payload.mediaUrls)) {
        const imgs: string[] = payload.mediaUrls
        payload.mediaUrl = imgs[0] ?? ''
      }
      
      return payload
    },

    mapFormValuesToUpdatePayload: (values) => {
      const { _id, ...rest } = values as any
      const payload: any = { ...rest }
      if (!payload.categoryId) payload.categoryId = null
      // Always send UTC ISO string — browser toISOString() converts local → UTC
      if (payload.scheduledAt instanceof Date) payload.scheduledAt = payload.scheduledAt.toISOString()
      else if (typeof payload.scheduledAt === 'string' && payload.scheduledAt) {
        const d = new Date(payload.scheduledAt)
        if (!isNaN(d.getTime())) payload.scheduledAt = d.toISOString()
      }
      
      // Sync mediaUrl from mediaUrls[0] ONLY if mediaUrls is provided in the form
      // This prevents wiping out existing media if the field is hidden or not updated
      if (Array.isArray(payload.mediaUrls)) {
        const imgs: string[] = payload.mediaUrls
        payload.mediaUrl = imgs[0] ?? ''
      }
      
      return payload
    },
  }), [categoriesData, tones, defaultTone, deleteTopicSuggestion, deleteAudienceSuggestion, generateContent, platformsList, resolvePostCategoryName, sendPostNow, updatePost])

  // ── Pending Approval config — same as base config but filtered to pending_approval / waiting_for_approval
  const pendingConfig = useMemo(() => ({
    ...config,
    showCreateButton: false,
    defaultQuery: {
      page: 1,
      limit: 20,
      sortfield: 'scheduledAt',
      direction: 'asc' as const,
      criteria: [{ key: 'status', value: 'waiting_for_approval' }],
    },
    slots: {
      rowActions: (_item: SocialPost, defaultActions: any[]) => [
        ...defaultActions,
        {
          label: 'Resend Approval Email',
          icon: <Send className="h-4 w-4" />,
          onClick: async (post: SocialPost) => {
            try {
              await sendApprovalEmail(String(post._id)).unwrap()
              toast.success('Approval email resent successfully')
            } catch {
              toast.error('Failed to resend approval email')
            }
          },
        },
      ],
    },
  }), [config, sendApprovalEmail])

  const pausedConfig = useMemo(() => ({
    ...config,
    showCreateButton: false,
    defaultQuery: {
      page: 1,
      limit: 20,
      sortfield: 'createdAt',
      direction: 'desc' as const,
      criteria: [{ key: 'status', value: 'paused' }],
    },
  }), [config])

  const [activeIndex, setActiveIndex] = useState(0)

  const activeConfig = useMemo(() => {
    const statusBase = {
      ...config,
      showCreateButton: false,
    }

    switch (activeIndex) {
      case 1: // Posted
        return {
          ...statusBase,
          defaultQuery: { ...config.defaultQuery, criteria: [{ key: 'status', value: 'posted' }] },
        }
      case 2: // Scheduled
        return {
          ...statusBase,
          defaultQuery: { ...config.defaultQuery, criteria: [{ key: 'status', value: 'scheduled' }] },
        }
      case 3: // Pending Approval
        return pendingConfig
      case 4: // Paused
        return pausedConfig
      case 5: // Failed
        return {
          ...statusBase,
          defaultQuery: { ...config.defaultQuery, criteria: [{ key: 'status', value: 'failed' }] },
        }
      default:
        return config
    }
  }, [activeIndex, config, pendingConfig, pausedConfig])

  return (
    <GeneratingPostsContext.Provider value={generatingPostIds}>
    <PostingPostsContext.Provider value={postingPostIds}>
    <EmailFailedPostsContext.Provider value={emailFailedPostIds}>
    <div className="p-6  mx-auto">

      {/* Bulk Action Bar — appears when rows are selected */}
      {selectedPosts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white border border-slate-200 shadow-2xl rounded-2xl px-5 py-3">
          <span className="text-sm font-semibold text-slate-600">
            {selectedPosts.length} post{selectedPosts.length > 1 ? 's' : ''} selected
          </span>
          <div className="h-5 w-px bg-slate-200" />
          <button
            onClick={handleBulkApprove}
            disabled={selectedPosts.some(p => p.status === 'paused')}
            className={cn("flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl transition-colors", 
              selectedPosts.some(p => p.status === 'paused') && "opacity-50 cursor-not-allowed"
            )}
          >
            <CheckCircle className="h-4 w-4" />
            Approve All
          </button>
          <button
            onClick={handleBulkReject}
            disabled={selectedPosts.some(p => p.status === 'paused')}
            className={cn("flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors",
              selectedPosts.some(p => p.status === 'paused') && "opacity-50 cursor-not-allowed"
            )}
          >
            <XCircle className="h-4 w-4" />
            Reject All
          </button>
          <button
            onClick={() => setSelectedPosts([])}
            className="text-slate-400 hover:text-slate-600 text-xs font-medium px-2"
          >
            Clear
          </button>
        </div>
      )}

      <TabView 
        activeIndex={activeIndex} 
        onTabChange={(e) => setActiveIndex(e.index)}
        className="main-tabs premium-tabs"
      >
        <TabPanel header={<span><LayoutGrid className="inline h-4 w-4 mr-2" /> All Posts</span>} />
        <TabPanel header={<span><Check className="inline h-4 w-4 mr-2 text-green-500" /> Posted</span>} />
        <TabPanel header={<span><Sparkles className="inline h-4 w-4 mr-2 text-amber-500" /> Scheduled</span>} />
        <TabPanel header={<span><AlertCircle className="inline h-4 w-4 mr-2 text-orange-500" /> Pending Approval</span>} />
        <TabPanel header={<span><Clock className="inline h-4 w-4 mr-2 text-slate-500" /> Paused</span>} />
        <TabPanel header={<span><Send className="inline h-4 w-4 mr-2 text-red-500 rotate-45" /> Failed</span>} />
      </TabView>

      <div className="mt-4">
        <CrudPage 
          key={activeIndex} 
          config={activeConfig as any} 
        />
      </div>


      <Dialog
        header={
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span>Action Blocked</span>
          </div>
        }
        visible={errorDialogVisible}
        style={{ width: '400px' }}
        onHide={() => setErrorDialogVisible(false)}
        draggable={false}
        resizable={false}
        className="premium-dialog border-t-4 border-t-red-500"
        footer={
          <div className="flex justify-end mt-4">
            <Button label="Okay, Got It" onClick={() => setErrorDialogVisible(false)} className="bg-red-500 hover:bg-red-600 text-white border-none" />
          </div>
        }
      >
        <div className="py-4 text-center">
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 font-medium mb-2">
            {errorMessage}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            AI-generated posts must be fully approved before they can be manually or automatically published to platforms.
          </p>
        </div>
      </Dialog>

      <Dialog
        header={
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-[var(--color-primary)]" />
            <span>Send Post Now</span>
          </div>
        }
        visible={sendDialogVisible}
        style={{ width: '450px' }}
        onHide={() => setSendDialogVisible(false)}
        draggable={false}
        resizable={false}
        className="premium-dialog"
        footer={
          <div className="flex justify-end gap-2 mt-4">
            <Button label="Cancel" className="p-button-text" onClick={() => setSendDialogVisible(false)} />
            <Button
              label={postToSend?.status === 'scheduled' ? 'Yes, Publish Now (Override Schedule)' : 'Send Now'}
              icon={<Send className="h-4 w-4 mr-2" />}
              onClick={confirmSend}
              disabled={selectedPlatforms.length === 0}
              className={postToSend?.status === 'scheduled' ? 'bg-amber-600 hover:bg-amber-700 border-none text-white' : 'bg-[var(--color-primary)] border-none'}
            />
          </div>
        }
      >
        <div className="py-4">
          {/* ── Early-publish warning for already-scheduled posts ── */}
          {postToSend?.status === 'scheduled' && (
            <div className="mb-5 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-800 text-sm">This post is already scheduled</p>
                <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                  This post is set to auto-publish on{' '}
                  <span className="font-semibold">
                    {postToSend.scheduledAt ? new Date(postToSend.scheduledAt).toLocaleString() : 'a future date'}
                  </span>.
                  Clicking <strong>"Yes, Publish Now"</strong> will post it immediately — <strong>before</strong> the scheduled time.
                </p>
              </div>
            </div>
          )}

          <p className="text-[var(--color-text-muted)] mb-6">
            Select the platforms where you want to publish this post immediately.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {activePlatforms.map((p) => {
              const platformId = p.name.toLowerCase().replace(/\s+/g, '').replace('(x)', '')
              const isSelected = selectedPlatforms.includes(platformId)
              return (
                <button
                  key={p._id}
                  onClick={() => togglePlatform(platformId)}
                  className={cn(
                    "platform-card relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-200 group",
                    isSelected
                      ? "selected border-[var(--color-primary)] bg-[var(--color-primary-soft)] shadow-lg scale-[1.02]"
                      : "border-[var(--color-border)] hover:border-[var(--color-primary-soft)] hover:bg-[var(--color-surface-alt)]"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-[var(--color-primary)] text-white rounded-full p-1 z-10 shadow-sm animate-in zoom-in duration-300">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}

                  <div 
                    className="platform-icon-container p-4 rounded-xl text-white mb-3 shadow-md transition-transform"
                    style={{ backgroundColor: p.color || 'var(--color-primary)' }}
                  >
                    <PlatformIcon icon={p.icon} svg={p.svg} size="1.5rem" />
                  </div>

                  <span className={cn(
                    "font-bold text-sm tracking-tight",
                    isSelected ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]"
                  )}>
                    {p.name}
                  </span>
                </button>
              )
            })}
          </div>

          {selectedPlatforms.includes('facebook') && fbPages.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
              <label className="text-xs font-bold text-blue-600 uppercase tracking-wider block">
                Target Facebook Page
              </label>
              <Dropdown
                value={targetPageId}
                options={fbPages}
                onChange={(e) => setTargetPageId(e.value)}
                optionLabel="pageName"
                optionValue="pageId"
                placeholder="Select a Page"
                className="w-full premium-dropdown border-blue-200"
              />
              <p className="text-[10px] text-blue-400 italic">
                * This post will be published to the selected page.
              </p>
            </div>
          )}
          {selectedPlatforms.length > 1 && (
            <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <div className="text-amber-600 mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-xs text-amber-800">
                Multiple platforms selected. Posts will be processed sequentially.
                <span className="font-semibold"> Currently, Facebook, Instagram, LinkedIn and YouTube are fully operational.</span>
              </p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
    </EmailFailedPostsContext.Provider>
    </PostingPostsContext.Provider>
    </GeneratingPostsContext.Provider>
  )
}
