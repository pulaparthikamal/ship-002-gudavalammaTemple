import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SocialAutomationPostsGrid } from '@/components/social/SocialAutomationPostsGrid'
import { ArrowLeft, LayoutGrid, CheckCircle2, Clock, AlertCircle, Sparkles, Camera, Share2, Briefcase, Play, PauseCircle, Check, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from 'primereact/button'
import { cn } from '@/utils/classNames'
import { Dialog } from 'primereact/dialog'
import { TabView, TabPanel } from 'primereact/tabview'
import { Paginator } from 'primereact/paginator'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { Dropdown } from 'primereact/dropdown'
import { useAppSelector, useAppDispatch } from '@/hooks/redux'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { apiSlice } from '@/services/api/apiSlice'
import { toast } from 'react-toastify'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { GeneratingPostsContext, PostingPostsContext, EmailFailedPostsContext } from '@/context/GeneratingPostsContext'
import { getEffectiveStatusKey, statusLabels } from '@/utils/socialStatusUtils'
import { useGetPlatformsQuery } from '@/services/api/endpoints/platformsApi'
import { ShortFormVideoContent } from '@/components/social/ShortFormVideoContent'
import { CreatorResearchInformation } from '@/components/social/CreatorResearchInformation'
import { OpenAiWebSearchMainBlock, OpenAiWebSearchMasterArticle, isOpenAiWebSearchInformation } from '@/components/social/OpenAiWebSearchReport'
import {
  useSendSocialPostNowMutation,
  useSendSocialPostApprovalEmailMutation,
  useGeneratePostContentMutation,
  useUpdateSocialPostMutation,
  useBulkApprovePostsMutation,
  useBulkRejectPostsMutation,
  useGetFacebookPagesQuery,
} from '@/services/api/endpoints/socialApi'

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

function renderYoutubeContent(youtube: any) {
  if (!youtube) return null

  const description = youtube.description

  return (
    <div className="space-y-3">
      <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
        <span className="text-[10px] font-black uppercase text-red-500 block mb-1">Video Title</span>
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

const KNOWN_PLATFORM_KEYS = new Set(['instagram', 'facebook', 'linkedin', 'youtube'])

function platformLabel(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function renderGenericPlatformContent(content: Record<string, any>) {
  const video = content.shortFormVideo || content.short_form_video
  return (
    <div className="space-y-3 p-4">
      {Object.entries(content).map(([key, value]) => {
        if (key === 'shortFormVideo' || key === 'short_form_video' || value == null || value === '') return null
        if (typeof value === 'string') return renderTextBlock(platformLabel(key), value)
        if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return renderListBlock(platformLabel(key), value)
        return renderTextBlock(platformLabel(key), JSON.stringify(value, null, 2))
      })}
      <ShortFormVideoContent content={{ shortFormVideo: video }} accentClassName="text-violet-600" />
    </div>
  )
}

export function SocialAutomationPostsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  
  const { data: platformsList = [] } = useGetPlatformsQuery()
  const [generateContent] = useGeneratePostContentMutation()
  const [updatePost] = useUpdateSocialPostMutation()
  const [sendApprovalEmail] = useSendSocialPostApprovalEmailMutation()
  const [sendPostNow] = useSendSocialPostNowMutation()
  const [bulkApprove] = useBulkApprovePostsMutation()
  const [bulkReject] = useBulkRejectPostsMutation()

  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'posted' | 'failed' | 'paused' | 'waiting_for_approval'>('all')
  const [selectedPost, setSelectedPost] = useState<any>(null)

  const [generatingPostIds, setGeneratingPostIds] = useState<Set<string>>(new Set())
  const [postingPostIds, setPostingPostIds] = useState<Set<string>>(new Set())
  const [emailFailedPostIds, setEmailFailedPostIds] = useState<Set<string>>(new Set())

  const [sendDialogVisible, setSendDialogVisible] = useState(false)
  const [postToSend, setPostToSend] = useState<any>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [targetPageId, setTargetPageId] = useState<string>('')

  const user = useAppSelector(selectCurrentUser)
  const { data: fbPages = [] } = useGetFacebookPagesQuery(user?.id || '', { skip: !user?.id })

  // Action handlers
  const handleGenerateAI = useCallback(async (post: any) => {
    if (!post.topic) {
      toast.warning('Please set a topic for this post first')
      return
    }

    const postId = String(post._id)

    setGeneratingPostIds(prev => new Set(prev).add(postId))

    try {
      toast.info(`Generating content for: ${post.topic}...`)
      const result = await generateContent({
        category: post.category?._id || post.category,
        interests: [post.sourceTopic || post.topic],
        tone: post.tone || 'humanic',
        targetAudience: post.targetAudience || undefined,
        userId: user?.id || undefined,
      }).unwrap()

      if (result.success) {
        const updatedData = {
          content: result.data.content,
          mediaUrl: result.data.mediaUrl,
          mediaUrls: result.data.mediaUrls || (result.data.mediaUrl ? [result.data.mediaUrl] : []),
          videoUrl: result.data.videoUrl,
          platformSpecificContent: result.data.platformSpecificContent,
          additionalInformation: result.data.additionalInformation,
          generationBrief: result.data.generationBrief,
          approvalStatus: 'email_sent' as const,
        }

        await updatePost({
          id: postId,
          data: updatedData,
        }).unwrap()

        // Sync local selectedPost preview state
        setSelectedPost((prev: any) => prev && String(prev._id) === postId ? { ...prev, ...updatedData } : prev)

        if (post.postType === 'ai') {
          try {
            await sendApprovalEmail(postId).unwrap()
            setEmailFailedPostIds(prev => { const next = new Set(prev); next.delete(postId); return next })
            toast.success('AI Content generated and approval email sent!')
          } catch (e) {
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
      setGeneratingPostIds(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
      dispatch(apiSlice.util.invalidateTags(['SocialPost']))
    }
  }, [generateContent, updatePost, sendApprovalEmail, dispatch, user?.id])

  const handleSendPostNow = useCallback((post: any) => {
    setPostToSend(post)
    const pList = Array.isArray(post.platforms) ? post.platforms : [post.platform].filter(Boolean)
    setSelectedPlatforms(pList.map((p: string) => p.toLowerCase()))
    setSendDialogVisible(true)
  }, [])

  const togglePlatform = useCallback((platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }, [])

  const confirmSend = useCallback(async () => {
    if (!postToSend) return

    try {
      const supportedPlatforms = ['facebook', 'instagram', 'linkedin', 'youtube', 'twitter']
      const activePlatforms = selectedPlatforms.filter(p => supportedPlatforms.includes(p))

      if (activePlatforms.length === 0) {
        toast.warning('No supported platforms selected')
        return
      }

      setSendDialogVisible(false)

      const postId = String(postToSend._id)

      setPostingPostIds(prev => new Set(prev).add(postId))

      const sendPromises = activePlatforms.map(async (platform) => {
        toast.info(`Publishing post to ${platform}...`)
        try {
          await sendPostNow({
            id: postId,
            pageId: platform === 'facebook' ? targetPageId : undefined,
            platform
          }).unwrap()
        } catch (err) {
          throw err
        }
      })

      await Promise.all(sendPromises)
      
      // Update selectedPost in dialog (if it was the one sent)
      setSelectedPost((prev: any) => prev && String(prev._id) === postId ? { ...prev, status: 'posted' } : prev)

      setPostingPostIds(prev => {
        const next = new Set(prev)
        next.delete(postId)
        return next
      })
      dispatch(apiSlice.util.invalidateTags(['SocialPost']))

    } catch (error: any) {
      toast.error(error?.data?.respMessage || error?.message || 'Failed to publish post')
      if (postToSend) {
        const postId = String(postToSend._id)
        setPostingPostIds(prev => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      }
    }
  }, [postToSend, selectedPlatforms, targetPageId, sendPostNow, dispatch])

  const handleApprove = useCallback(async (post: any) => {
    try {
      await bulkApprove({ ids: [String(post._id)] }).unwrap()
      setSelectedPost((prev: any) => prev && String(prev._id) === String(post._id) ? { ...prev, approvalStatus: 'approved' } : prev)
      toast.success('Post approved')
    } catch {
      toast.error('Failed to approve post')
    }
  }, [bulkApprove])

  const handleReject = useCallback(async (post: any) => {
    try {
      await bulkReject({ ids: [String(post._id)], reason: 'Rejected from dashboard' }).unwrap()
      setSelectedPost((prev: any) => prev && String(prev._id) === String(post._id) ? { ...prev, approvalStatus: 'rejected' } : prev)
      toast.success('Post rejected')
    } catch {
      toast.error('Failed to reject post')
    }
  }, [bulkReject])

  // Pagination state
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState(12)
  const [totalRecords, setTotalRecords] = useState(0)

  useEffect(() => {
    setPage(1)
  }, [statusFilter])

  const onPageChange = (event: any) => {
    setPage(event.page + 1)
    setRows(event.rows)
  }

  const filters = [
    { id: 'all', label: 'All Posts', icon: <LayoutGrid className="h-4 w-4" /> },
    { id: 'scheduled', label: 'Scheduled', icon: <Clock className="h-4 w-4" /> },
    { id: 'posted', label: 'Posted', icon: <CheckCircle2 className="h-4 w-4" /> },
    { id: 'waiting_for_approval', label: 'Pending Approval', icon: <Sparkles className="h-4 w-4 text-amber-500" /> },
    { id: 'failed', label: 'Failed', icon: <AlertCircle className="h-4 w-4" /> },
    { id: 'paused', label: 'Paused', icon: <PauseCircle className="h-4 w-4 text-slate-500" /> },
  ]

  const isGenerating = selectedPost ? generatingPostIds.has(String(selectedPost._id)) : false
  const isPosting = selectedPost ? postingPostIds.has(String(selectedPost._id)) : false
  const isEmailFailed = selectedPost ? emailFailedPostIds.has(String(selectedPost._id)) : false

  const displayStatus = selectedPost
    ? (isEmailFailed ? 'email_failed' : getEffectiveStatusKey(selectedPost))
    : ''

  const activePlatforms = platformsList.filter((p: any) => p.active)

  return (
    <GeneratingPostsContext.Provider value={generatingPostIds}>
    <PostingPostsContext.Provider value={postingPostIds}>
    <EmailFailedPostsContext.Provider value={emailFailedPostIds}>
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowLeft className="h-4 w-4" />}
            className="p-button-rounded p-button-text p-button-secondary bg-white shadow-sm border border-slate-200 !w-9 !h-9"
            onClick={() => navigate('/socialMedia/automation')}
          />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Automation Posts</h1>
            <p className="text-xs text-slate-400 mt-0.5">ID: {id?.slice(-8)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150",
                statusFilter === f.id
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 min-h-[600px] flex flex-col">
        <div className="flex-1">
          {id && (
            <SocialAutomationPostsGrid 
              automationId={id} 
              statusFilter={statusFilter} 
              page={page}
              limit={rows}
              onPostClick={setSelectedPost}
              onTotalChange={setTotalRecords}
            />
          )}
        </div>

        {totalRecords > rows && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <Paginator 
              first={(page - 1) * rows} 
              rows={rows} 
              totalRecords={totalRecords} 
              rowsPerPageOptions={[12, 24, 48]} 
              onPageChange={onPageChange}
              className="premium-paginator !bg-transparent !border-none"
            />
          </div>
        )}
      </div>

      {/* Post Preview Dialog */}
      <Dialog
        header={
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Post Preview</h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Comprehensive view of generated content</p>
            </div>
          </div>
        }
        visible={!!selectedPost}
        onHide={() => setSelectedPost(null)}
        style={{ width: 'min(94vw, 54rem)' }}
        modal
        blockScroll
        draggable={false}
        resizable={false}
        className="premium-dialog"
        footer={
          selectedPost && (
            <div className="flex flex-wrap items-center justify-between gap-3 w-full pt-4 border-t border-slate-100">
              <Button
                label="Close"
                icon="pi pi-times"
                className="p-button-text p-button-secondary !font-bold"
                onClick={() => setSelectedPost(null)}
              />
              <div className="flex items-center gap-2">
                {/* Approve / Reject buttons for AI posts */}
                {selectedPost.postType === 'ai' && (
                  <>
                    <Button
                      label={selectedPost.approvalStatus === 'approved' ? 'Approved' : 'Approve'}
                      icon={<CheckCircle className="h-4 w-4 mr-2" />}
                      className="p-button-success p-button-outlined !rounded-xl !text-xs !py-2 !px-3"
                      disabled={selectedPost.approvalStatus === 'approved' || selectedPost.status === 'paused' || isGenerating || isPosting}
                      onClick={() => handleApprove(selectedPost)}
                    />
                    <Button
                      label={selectedPost.approvalStatus === 'rejected' ? 'Rejected' : 'Reject'}
                      icon={<XCircle className="h-4 w-4 mr-2" />}
                      className="p-button-danger p-button-outlined !rounded-xl !text-xs !py-2 !px-3"
                      disabled={selectedPost.approvalStatus === 'rejected' || selectedPost.status === 'paused' || isGenerating || isPosting}
                      onClick={() => handleReject(selectedPost)}
                    />
                  </>
                )}

                {/* Generate AI Content Button */}
                {selectedPost.postType === 'ai' && (
                  <Button
                    label={isGenerating ? 'Generating AI...' : 'Generate AI Content'}
                    icon={isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    className="p-button-warning !font-bold !rounded-xl !text-xs !py-2 !px-3"
                    disabled={selectedPost.status === 'paused' || isGenerating || isPosting}
                    onClick={() => handleGenerateAI(selectedPost)}
                  />
                )}

                {/* Send Now Button */}
                <Button
                  label={
                    isPosting ? 'Posting...' :
                    selectedPost.postType === 'ai' && selectedPost.approvalStatus !== 'approved'
                      ? 'Awaiting Approval'
                      : 'Send Post Now'
                  }
                  icon={isPosting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  className="p-button-primary !font-black !rounded-xl !text-xs !py-2 !px-3 bg-[var(--color-primary)] border-none text-white"
                  disabled={
                    selectedPost.status === 'paused' ||
                    selectedPost.status === 'posted' ||
                    isGenerating ||
                    isPosting ||
                    (selectedPost.postType === 'ai' && selectedPost.approvalStatus !== 'approved')
                  }
                  onClick={() => handleSendPostNow(selectedPost)}
                />
              </div>
            </div>
          )
        }
      >
        {selectedPost && (
          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Platforms</span>
                <div className="flex items-center gap-2">
                  {(Array.isArray(selectedPost.platforms) ? selectedPost.platforms : (selectedPost.platform ? [selectedPost.platform] : [])).map((p: string) => (
                    <span key={p} className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold uppercase text-slate-600">{p}</span>
                  ))}
                </div>
              </div>
              <div className="space-y-1 text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Status</span>
                <div className={cn(
                  "text-xs font-black uppercase",
                  displayStatus === 'posted' || displayStatus === 'approved' ? 'text-green-600' : 
                  displayStatus === 'failed' || displayStatus === 'email_failed' || displayStatus === 'rejected' ? 'text-red-600' : 
                  displayStatus === 'content_generation_pending' ? 'text-amber-600' : 'text-blue-600'
                )}>
                  {statusLabels[displayStatus] || displayStatus.replace(/_/g, ' ')}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled For</span>
                <div className="text-sm font-bold text-slate-700">{new Date(selectedPost.scheduledAt).toLocaleString()}</div>
              </div>
              <div className="space-y-1 text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Post Origin</span>
                <div className="text-sm font-bold text-slate-700 capitalize">{selectedPost.postType} Generation</div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Campaign Topic</span>
              <div className="text-lg font-black text-indigo-600 px-1">{selectedPost.topic || 'Untitled Automation'}</div>
            </div>

            {selectedPost.platformSpecificContent ? (
              <div className="space-y-3">
                {selectedPost.generationBrief?.mode === 'custom_brief' && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
                    <div className="font-bold">Custom brief applied</div>
                    <div className="mt-1">
                      {[...(selectedPost.generationBrief.requested_platforms?.length
                        ? selectedPost.generationBrief.requested_platforms
                        : selectedPost.generationBrief.resolved_platforms || []), selectedPost.generationBrief.duration_seconds ? `${selectedPost.generationBrief.duration_seconds} seconds` : null]
                        .filter(Boolean).map(String).join(' · ')}
                    </div>
                  </div>
                )}
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Optimized Content</span>
                <TabView className="premium-tabs">
                  {isOpenAiWebSearchInformation(selectedPost.additionalInformation) && (
                    <TabPanel header={<span>Main</span>}>
                      <OpenAiWebSearchMainBlock report={selectedPost.additionalInformation} />
                    </TabPanel>
                  )}
                  <TabPanel header={<span><Briefcase className="inline h-4 w-4 mr-2" /> Master Article</span>}>
                    <OpenAiWebSearchMasterArticle report={selectedPost.additionalInformation} fallbackContent={selectedPost.content} />
                  </TabPanel>
                  {selectedPost.platformSpecificContent.instagram && (
                    <TabPanel header={<span><Camera className="inline h-4 w-4 mr-2" /> Instagram</span>}>
                      <div className="p-4 bg-gradient-to-br from-[#fdf2f8] to-[#fff1f2] rounded-xl border border-[#fbcfe8] text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedPost.platformSpecificContent.instagram.caption}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {selectedPost.platformSpecificContent.instagram.hashtags?.map((h: string, idx: number) => (
                            <span key={idx} className="text-[#db2777] font-medium">{h}</span>
                          ))}
                        </div>
                        <ShortFormVideoContent content={selectedPost.platformSpecificContent.instagram} accentClassName="text-[#db2777]" />
                      </div>
                    </TabPanel>
                  )}
                  {selectedPost.platformSpecificContent.facebook && (
                    <TabPanel header={<span><Share2 className="inline h-4 w-4 mr-2" /> Facebook</span>}>
                      <div className="p-4 bg-gradient-to-br from-[#eff6ff] to-[#f0f9ff] rounded-xl border border-[#bfdbfe] text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedPost.platformSpecificContent.facebook.caption}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {selectedPost.platformSpecificContent.facebook.hashtags?.map((h: string, idx: number) => (
                            <span key={idx} className="text-[#2563eb] font-medium">{h}</span>
                          ))}
                        </div>
                        <ShortFormVideoContent content={selectedPost.platformSpecificContent.facebook} accentClassName="text-[#2563eb]" />
                      </div>
                    </TabPanel>
                  )}
                  {selectedPost.platformSpecificContent.linkedin && (
                    <TabPanel header={<span><Briefcase className="inline h-4 w-4 mr-2" /> LinkedIn</span>}>
                      <div className="p-4 bg-gradient-to-br from-[#f0f9ff] to-[#ecfeff] rounded-xl border border-[#bae6fd] text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedPost.platformSpecificContent.linkedin.content}
                        <div className="mt-3 flex flex-wrap gap-1">
                          {selectedPost.platformSpecificContent.linkedin.hashtags?.map((h: string, idx: number) => (
                            <span key={idx} className="text-[#0369a1] font-medium">{h}</span>
                          ))}
                        </div>
                        <ShortFormVideoContent content={selectedPost.platformSpecificContent.linkedin} accentClassName="text-[#0369a1]" />
                      </div>
                    </TabPanel>
                  )}
                  {selectedPost.platformSpecificContent.youtube && (
                    <TabPanel header={<span><Play className="inline h-4 w-4 mr-2" /> YouTube</span>}>
                      {renderYoutubeContent(selectedPost.platformSpecificContent.youtube)}
                    </TabPanel>
                  )}
                  {Object.entries(selectedPost.platformSpecificContent)
                    .filter(([platform, content]) => !KNOWN_PLATFORM_KEYS.has(platform) && content && typeof content === 'object')
                    .map(([platform, content]) => (
                      <TabPanel key={platform} header={<span>{platformLabel(platform)}</span>}>
                        {renderGenericPlatformContent(content as Record<string, any>)}
                      </TabPanel>
                    ))}
                </TabView>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Raw Content</span>
                <div className="text-sm p-4 bg-slate-50 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedPost.content || 'No content available'}
                </div>
              </div>
            )}
            <CreatorResearchInformation report={selectedPost.additionalInformation} />

            {/* Media Gallery */}
            {(() => {
              const allImages = selectedPost.mediaUrls?.length
                ? selectedPost.mediaUrls
                : selectedPost.mediaUrl ? [selectedPost.mediaUrl] : []
              const hasVideo = Boolean(selectedPost.videoUrl)
              
              if (!allImages.length && !hasVideo) return null

              return (
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Attachments</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allImages.map((url: string, i: number) => (
                      <div key={i} className="rounded-xl overflow-hidden border border-slate-200 bg-black">
                        <img src={resolveApiAssetUrl(url)} alt="Attachment" className="w-full object-contain max-h-[300px]" />
                      </div>
                    ))}
                    {hasVideo && (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-black col-span-full">
                        <video src={resolveApiAssetUrl(selectedPost.videoUrl)} controls className="w-full max-h-[400px] object-contain" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </Dialog>

      {/* Send Post Now confirmation/selection dialog */}
      <Dialog
        header={
          <div className="flex items-center gap-2 font-black uppercase text-sm tracking-wide text-slate-700">
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
              className={postToSend?.status === 'scheduled' ? 'bg-amber-600 hover:bg-amber-700 border-none text-white' : 'bg-[var(--color-primary)] border-none text-white'}
            />
          </div>
        }
      >
        <div className="py-4">
          {/* Early-publish warning for already-scheduled posts */}
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

          <p className="text-[var(--color-text-muted)] mb-6 text-sm">
            Select the platforms where you want to publish this post immediately.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {activePlatforms.map((p: any) => {
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
                    <div className="absolute top-2 right-2 bg-[var(--color-primary)] text-white rounded-full p-1 z-10 shadow-sm">
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
