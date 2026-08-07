import { z } from 'zod'
import { useState } from 'react'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { SocialCategory, SocialAutomation, SocialPost } from '@/types/social'
import type { Platform } from '@/types/platform'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { PromptTopicCell } from '@/components/ui/PromptTopicCell'
import { Loader2 } from 'lucide-react'
import { useGeneratingPosts, usePostingPosts, useEmailFailedPosts } from '@/context/GeneratingPostsContext'
import { statusLabels, statusBadgeClasses, getEffectiveStatusKey } from '@/utils/socialStatusUtils'
import { formatDateTime } from '@/utils/date'

const TOPIC_MAX_LENGTH = 5000

const editableListItemSchema = z.string().trim().min(1, 'Value cannot be empty').max(
  TOPIC_MAX_LENGTH,
  `Value must be ${TOPIC_MAX_LENGTH} characters or less`,
)

const hasUniqueValues = (values: string[]) => {
  const normalizedValues = values.map(value => value.trim().toLowerCase())
  return new Set(normalizedValues).size === normalizedValues.length
}

type TopicSuggestionOptions = {
  onDeleteTopicSuggestion?: (value: string, values: any) => void | Promise<void>
  onDeleteAudienceSuggestion?: (value: string, values: any) => void | Promise<void>
}

type SocialFormDefaults = {
  defaultTone?: string
  defaultPlatforms?: string[]
}

const createGlobalAudienceOptions = (categories: SocialCategory[]) => {
  const seen = new Set<string>()
  return (categories || []).flatMap((category) =>
    (category.audienceSuggestions || []).flatMap((audience) => {
      const value = audience.trim()
      const key = value.toLowerCase()
      if (!value || seen.has(key)) return []
      seen.add(key)
      return [{ label: value, value, category: 'Common audiences' }]
    }),
  )
}

// Categories
export const socialCategoryFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  interests: z.array(editableListItemSchema)
    .min(1, 'At least one prompt/topic is required')
    .refine(hasUniqueValues, 'Duplicate prompts/topics are not allowed'),
  audienceSuggestions: z.array(editableListItemSchema)
    .refine(hasUniqueValues, 'Duplicate target audiences are not allowed')
    .optional(),
  isActive: z.boolean(),
})

export const createSocialCategoryTableColumns = (): Array<CrudTableColumn<SocialCategory>> => [
  { key: 'name', header: 'Name', field: 'name', sortField: 'name' },
  {
    key: 'interests',
    header: 'Prompt/Topic',
    field: 'interests',
    render: (row) => <PromptTopicCell value={row.interests} title="Prompts/Topics" variant="prompt" />,
  },
  {
    key: 'audienceSuggestions',
    header: 'Audience',
    render: (row) => <PromptTopicCell value={row.audienceSuggestions} title="Target Audiences" variant="audience" />,
  },
  {
    key: 'createdAt',
    header: 'Created At',
    field: 'createdAt',
    sortable: true,
    render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</span>,
  },
  { key: 'isActive', header: 'Status', field: 'isActive', render: (row) => row.isActive ? 'Active' : 'Inactive' },
]

export const createSocialCategoryFormConfig = (): CrudFormConfig<any> => ({
  schema: socialCategoryFormSchema,
  defaultValues: { name: '', interests: [], audienceSuggestions: [], isActive: true },
  fields: [
    { name: 'name', label: 'Name', type: 'text' },
    {
      name: 'interests',
      label: 'Prompt/Topic',
      type: 'editableStringList',
      fullWidth: true,
      helperText: 'Maintain reusable prompts/topics for this category.',
      editableStringList: {
        variant: 'prompt',
        itemLabel: 'Prompt/Topic',
        addLabel: 'Add Prompt/Topic',
        emptyMessage: 'No prompts/topics added yet.',
        maxLength: TOPIC_MAX_LENGTH,
        rows: 5,
      },
    },
    {
      name: 'audienceSuggestions',
      label: 'Target Audiences',
      type: 'editableStringList',
      fullWidth: true,
      helperText: 'Saved audience suggestions used by automation and post Target Audience fields.',
      editableStringList: {
        variant: 'audience',
        itemLabel: 'Target Audience',
        addLabel: 'Add Target Audience',
        emptyMessage: 'No target audiences added yet.',
        maxLength: TOPIC_MAX_LENGTH,
        rows: 3,
      },
    },
    { name: 'isActive', label: 'Active', type: 'switch' },

  ],
})

// Social Accounts
export const socialAccountFormSchema = z.object({
  _id: z.string().optional(),
  platform: z.enum(['facebook', 'instagram', 'youtube', 'linkedin']),
  platformAccountId: z.string().min(1, 'Account ID is required'),
  platformAccountName: z.string().min(1, 'Account Name is required'),
  status: z.enum(['connected', 'disconnected']).default('connected'),
})

export const createSocialAccountFormConfig = (): CrudFormConfig<any> => ({
  schema: socialAccountFormSchema,
  defaultValues: { platform: 'linkedin', platformAccountId: '', platformAccountName: '', status: 'connected' },
  fields: [
    { name: 'platform', label: 'Platform', type: 'select', options: [
      { label: 'Facebook', value: 'facebook' },
      { label: 'Instagram', value: 'instagram' },
      { label: 'LinkedIn', value: 'linkedin' },
      { label: 'YouTube', value: 'youtube' },
    ], disabled: true },
    { name: 'platformAccountId', label: 'Platform Account ID', type: 'text', disabled: true },
    { name: 'platformAccountName', label: 'Account Name', type: 'text' },
    { name: 'status', label: 'Status', type: 'select', options: [
      { label: 'Connected', value: 'connected' },
      { label: 'Disconnected', value: 'disconnected' },
    ] },
  ],
})

// Automations
export const socialAutomationFormSchema = z.object({
  _id: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  interests: z.array(z.string().trim().max(TOPIC_MAX_LENGTH, `Topic must be ${TOPIC_MAX_LENGTH} characters or less`)),
  targetAudience: z.string().trim().max(TOPIC_MAX_LENGTH, `Target audience must be ${TOPIC_MAX_LENGTH} characters or less`).optional(),
  tone: z.string().min(1, 'Tone is required'),
  mediaType: z.enum(['image', 'video', 'text']),
  platforms: z.array(z.string()).min(1, 'Select at least one platform'),
  frequency: z.enum(['daily', 'weekly', 'custom', 'fixed']),
  customDays: z.array(z.string()).optional(),
  fixedDate: z.union([z.string(), z.date()]).nullish().transform(v => v ?? undefined),
  startDate: z.union([z.string(), z.date()]).nullish().transform(v => v ?? undefined),
  hasEndDate: z.boolean().default(true),
  endDate: z.union([z.string(), z.date()]).nullish().transform(v => v ?? undefined),
  time: z.union([z.string(), z.date()]).nullish().transform(v => v ?? undefined),



  isActive: z.boolean(),
  approvalEmail: z.string().optional(),
})

export const createSocialAutomationTableColumns = (platforms: Platform[] = []): Array<CrudTableColumn<SocialAutomation>> => [
  { key: 'category', header: 'Category', render: (row) => (row.categoryId && typeof row.categoryId === 'object' ? row.categoryId.name : row.categoryId) },
  { key: 'topic', header: 'Prompt/Topic', render: (row) => <PromptTopicCell value={row.interests} /> },
  {
    key: 'targetAudience',
    header: 'Audience',
    render: (row) => (
      <span className="block max-w-[180px] truncate text-xs" title={row.targetAudience || ''}>
        {row.targetAudience || '—'}
      </span>
    ),
  },
  { key: 'platforms', header: 'Platforms', render: (row) => <PlatformCell values={row.platforms} platforms={platforms} /> },
  { key: 'tone', header: 'Tone', field: 'tone' },
  { key: 'frequency', header: 'Freq.', field: 'frequency' },
  { key: 'time', header: 'Time', field: 'time' },
  { key: 'startDate', header: 'Start', render: (row) => row.startDate ? new Date(row.startDate).toLocaleDateString() : '-' },
  { key: 'endDate', header: 'End', render: (row) => row.endDate ? new Date(row.endDate).toLocaleDateString() : '-' },
  {
    key: 'createdAt',
    header: 'Created At',
    field: 'createdAt',
    sortable: true,
    render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</span>,
  },
  { key: 'isActive', header: 'Status', render: (row) => row.isActive ? 'Active' : 'Inactive' },
]


export const createSocialAutomationFormConfig = (
  categories: SocialCategory[],
  topicSuggestionOptions: TopicSuggestionOptions = {},
  formDefaults: SocialFormDefaults = {},
): CrudFormConfig<any> => {

  return {
    schema: socialAutomationFormSchema,
    defaultValues: {
      categoryId: '',
      interests: [],
      targetAudience: '',
      tone: formDefaults.defaultTone || '',
      mediaType: 'text',
      platforms: formDefaults.defaultPlatforms || [],
      frequency: 'daily',
      customDays: [],
      fixedDate: '',
      startDate: new Date().toISOString().split('T')[0],
      hasEndDate: true,
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: new Date(new Date().setHours(10, 0, 0, 0)),
      isActive: true
    },
    fields: [
      { name: 'categoryId', label: 'Category', type: 'select', options: (categories || []).map(c => ({ label: c.name, value: c._id })) },
      {
        name: 'interests',
        label: 'Prompt/Topic',
        type: 'tags',
        tags: {
          maxItems: 1,
          maxLength: TOPIC_MAX_LENGTH,
          showCharacterCount: true,
          commitOnBlur: true,
          removeButtonPosition: 'start',
          singleValueEditor: 'textarea',
          rows: 6,
          onDeleteOption: topicSuggestionOptions.onDeleteTopicSuggestion,
        },
        options: (values) => {
          const categoryId = values.categoryId;
          if (!categoryId) return [];
          const category = categories.find(c => c._id === categoryId);
          if (!category) return [];
          return (category.interests || []).map(i => ({ label: i, value: i, category: category.name }));
        },
        placeholder: 'Type a topic or short prompt',
        helperText: `Use a short topic or a clear prompt up to ${TOPIC_MAX_LENGTH} characters.`
      },
      {
        name: 'targetAudience',
        label: 'Target Audience',
        type: 'tags',
        tags: {
          maxItems: 1,
          maxLength: TOPIC_MAX_LENGTH,
          showCharacterCount: true,
          commitOnBlur: true,
          removeButtonPosition: 'start',
          valueMode: 'string',
          onDeleteOption: topicSuggestionOptions.onDeleteAudienceSuggestion,
        },
        options: () => createGlobalAudienceOptions(categories),
        placeholder: 'Type the audience to impress',
        helperText: `Describe who this content should persuade or help, up to ${TOPIC_MAX_LENGTH} characters.`
      },
      { name: 'tone', label: 'Tone', type: 'toneSelector', placeholder: 'Select a tone' },
      {
        name: 'mediaType', label: 'Media Type', type: 'select', options: [
          { label: 'Text', value: 'text' },
          { label: 'Image', value: 'image' },
          { label: 'Video', value: 'video' },
        ]
      },
      {
        name: 'platforms', label: 'Platforms', type: 'platformSelector'
      },
      {
        name: 'frequency', label: 'Frequency', type: 'select', options: [
          { label: 'Daily', value: 'daily' },
          { label: 'Weekly', value: 'weekly' },
          { label: 'Custom Days', value: 'custom' },
          { label: 'Fixed Date', value: 'fixed' },
        ]
      },
      {
        name: 'customDays',
        label: 'Select Days',
        type: 'multiSelect',
        options: [
          { label: 'Monday', value: 'Monday' },
          { label: 'Tuesday', value: 'Tuesday' },
          { label: 'Wednesday', value: 'Wednesday' },
          { label: 'Thursday', value: 'Thursday' },
          { label: 'Friday', value: 'Friday' },
          { label: 'Saturday', value: 'Saturday' },
          { label: 'Sunday', value: 'Sunday' },
        ],
        visibleIf: (values) => values.frequency === 'custom'
      },
      {
        name: 'fixedDate',
        label: 'Schedule Date',
        type: 'date',
        visibleIf: (values) => values.frequency === 'fixed'
      },
      {
        name: 'startDate',
        label: 'Campaign Start Date',
        type: 'date',
        visibleIf: (values) => values.frequency !== 'fixed'
      },
      {
        name: 'hasEndDate',
        label: 'Set Campaign End Date?',
        type: 'switch',
        visibleIf: (values) => values.frequency !== 'fixed'
      },
      {
        name: 'endDate',
        label: 'Campaign End Date',
        type: 'date',
        visibleIf: (values) => values.frequency !== 'fixed' && values.hasEndDate
      },

      { name: 'time', label: 'Posting Time', type: 'time' },
      { name: 'approvalEmail', label: 'Approval Email (overrides default)', type: 'text', placeholder: 'Optional: leave blank to use system default' },
      { name: 'isActive', label: 'Active', type: 'switch' },
    ],
  }
}


// Posts
export const socialPostFormSchema = z.object({
  _id: z.string().optional(),
  postType: z.enum(['ai', 'manual']).default('manual'),
  postingMode: z.enum(['now', 'schedule']).default('now'),
  categoryId: z.string().optional(),
  topic: z.string().trim().min(1, 'Topic is required').max(TOPIC_MAX_LENGTH, `Topic must be ${TOPIC_MAX_LENGTH} characters or less`),
  targetAudience: z.string().trim().max(TOPIC_MAX_LENGTH, `Target audience must be ${TOPIC_MAX_LENGTH} characters or less`).optional(),
  content: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),   // multiple images
  videoUrl: z.string().optional(),
  tone: z.string().optional(),
  platforms: z.array(z.string()).min(1, 'At least one platform is required'),
  status: z.enum(['pending_approval', 'waiting_for_approval', 'scheduled', 'pending', 'posted', 'failed', 'paused']).default('scheduled'),
  approvalStatus: z.enum(['not_required', 'content_generation_pending', 'email_sent', 'email_failed', 'approved', 'rejected']).optional(),
  approvedByEmail: z.string().email('Must be a valid email').optional().or(z.literal('')),
  scheduledAt: z.preprocess((val) => (val === '' ? undefined : val), z.union([z.string(), z.date()]).optional()),
  platformSpecificContent: z.any().optional()
})


// ---------------------------------------------------------------------------
// Table preview helpers — compact badge in cell, modal on click
// ---------------------------------------------------------------------------

function resolveUrl(url: string) {
  return resolveApiAssetUrl(url)
}

function StatusBadge({ value, postId }: { value?: string; postId?: string }) {
  const generatingIds = useGeneratingPosts()
  const postingIds = usePostingPosts()
  const isGenerating = Boolean(postId && generatingIds.has(postId))
  const isPosting = Boolean(postId && postingIds.has(postId))

  if (isGenerating) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">
        <Loader2 className="h-3 w-3 animate-spin text-violet-600" />
        Generating AI...
      </span>
    )
  }

  if (isPosting) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
        Posting...
      </span>
    )
  }

  if (!value) return <span className="text-[10px] text-[var(--color-text-muted)]">-</span>

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold capitalize ${statusBadgeClasses[value] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {statusLabels[value] || value.replace(/_/g, ' ')}
    </span>
  )
}

/**
 * Approval-specific badge — reads the EmailFailedPostsContext so it can show
 * "Approval Mail Sending Failed" without needing a server-side status field.
 */
function ApprovalBadge({ postId, approvalStatus }: { postId: string; approvalStatus?: string }) {
  const emailFailedIds = useEmailFailedPosts()
  const effectiveStatus = emailFailedIds.has(postId) ? 'email_failed' : approvalStatus
  return <StatusBadge value={effectiveStatus} />
}

/**
 * Status-column badge.
 * Rules:
 *  - AI post, no content yet                     → "Content Generation Pending"
 *  - AI post, content generated (any state)       → show real server status ("Scheduled")
 *  - Manual post with status=scheduled            → "Pending to Publish"
 *  - "Mail Send Failed" belongs only in Approval column — Status stays clean.
 */
function StatusCellBadge({ row }: { row: { _id: unknown; postType?: string; status?: string; approvalStatus?: string } }) {
  const postId = String(row._id)
  const effectiveValue = getEffectiveStatusKey(row)
  return <StatusBadge value={effectiveValue} postId={postId} />
}


function ImageCell({ images }: { images: string[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* ── compact badge shown in cell ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/20 text-[var(--color-primary)] transition-colors"
        title="Preview images"
      >
        <span className="text-sm">🖼</span>
        <span className="text-xs font-semibold">{images.length}</span>
      </button>

      {/* ── modal lightbox ── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/80 backdrop-blur-sm p-6 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-bold">{images.length} Image{images.length > 1 ? 's' : ''}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white text-2xl leading-none font-light transition-colors"
              >✕</button>
            </div>

            {/* grid */}
            <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
              {images.map((url, i) => (
                <div key={i} className="relative rounded-2xl overflow-hidden bg-black/50 border border-white/10 group">
                  <img
                    src={resolveUrl(url)}
                    alt={`Image ${i + 1}`}
                    className="w-full object-contain max-h-[360px]"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 flex justify-between items-center">
                    <span className="text-white/80 text-xs font-medium">{i + 1} / {images.length}</span>
                    <a href={resolveUrl(url)} target="_blank" rel="noreferrer"
                      className="text-white/60 hover:text-white text-xs transition-colors">
                      ↗ Open
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function VideoCell({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  const resolved = resolveUrl(src)

  return (
    <>
      {/* ── compact badge shown in cell ── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-600 transition-colors"
        title="Play video"
      >
        <span className="text-sm">▶</span>
        <span className="text-xs font-semibold">Video</span>
      </button>

      {/* ── video modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white text-lg font-bold">Video Preview</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white text-2xl leading-none font-light transition-colors"
              >✕</button>
            </div>
            <video
              src={resolved}
              controls
              autoPlay
              className="w-full rounded-2xl shadow-2xl max-h-[75vh]"
            />
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Platform badge cell — shows platform icon + name from platforms collection
// ---------------------------------------------------------------------------

function PlatformCell({ values, platforms }: { values?: string[]; platforms: Platform[] }) {
  if (!values?.length) return <span className="text-[10px] text-[var(--color-text-muted)]">—</span>
  
  return (
    <div className="flex flex-wrap gap-1">
      {values.map(value => {
        const key = value.toLowerCase().replace(/\s+/g, '')
        const match = platforms.find(p => {
          const name = p.name.toLowerCase().replace(/\s+/g, '')
          return name === key || (key === 'twitter' && name === 'twitter(x)')
        })
        const label = match?.name ?? value
        const color = match?.color ?? 'var(--color-primary)'

        return (
          <span
            key={value}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold border"
            style={{ color, borderColor: `${color}30`, backgroundColor: `${color}10` }}
            title={label}
          >
            <PlatformIcon icon={match?.icon} svg={match?.svg} color={color} size={11} />
            {label}
          </span>
        )
      })}
    </div>
  )
}

function categoryLabel(value: unknown) {
  if (!value) return '—'
  if (typeof value === 'object') {
    const category = value as { name?: unknown; _id?: unknown; toString?: () => string }
    if (category.name) return String(category.name)
    if (category._id) return String(category._id)
    if (typeof category.toString === 'function') return category.toString()
  }
  return String(value)
}

export const createSocialPostTableColumns = (platforms: Platform[] = []): Array<CrudTableColumn<SocialPost>> => [
  { key: 'platforms', header: 'Platforms', render: (row) => <PlatformCell values={row.platforms} platforms={platforms} /> },
  { key: 'postType', header: 'Type', field: 'postType', sortable: true },
  {
    key: 'category',
    header: 'Category',
    render: (row) => {
      if (row.categoryId) {
        return categoryLabel(row.categoryId);
      }

      const auto = row.automationId;
      if (auto && typeof auto === 'object') {
        const cat = auto.categoryId;
        if (cat && typeof cat === 'object') {
          return cat.name || '—';
        }
        return cat || '—';
      }
      return '—';
    }
  },
  { key: 'topic', header: 'Prompt/Topic', field: 'topic', sortable: true, render: (row) => <PromptTopicCell value={row.topic} /> },
  {
    key: 'targetAudience',
    header: 'Audience',
    render: (row) => (
      <span className="block max-w-[180px] truncate text-xs" title={row.targetAudience || ''}>
        {row.targetAudience || '—'}
      </span>
    ),
  },
  {
    key: 'tone',
    header: 'Tone',
    field: 'tone',
    sortable: true,
    render: (row) => (
      <span className="text-xs capitalize">
        {row.tone?.replace(/[_-]+/g, ' ') || '—'}
      </span>
    ),
  },
  {
    key: 'content', header: 'Content', render: (row) => (
      <div className="max-w-[180px] truncate text-xs text-[var(--color-text-muted)]">
        {row.content || '—'}
      </div>
    )
  },
  {
    key: 'images', header: 'Images', render: (row) => {
      const imgs = row.mediaUrls?.length ? row.mediaUrls : row.mediaUrl ? [row.mediaUrl] : []
      if (!imgs.length) return <span className="text-[10px] text-[var(--color-text-muted)]">—</span>
      return <ImageCell images={imgs} />
    }
  },
  {
    key: 'video', header: 'Video', render: (row) => {
      if (!row.videoUrl) return <span className="text-[10px] text-[var(--color-text-muted)]">—</span>
      return <VideoCell src={row.videoUrl} />
    }
  },
  {
    key: 'status',
    header: 'Status',
    field: 'status',
    sortable: true,
    render: (row) => <StatusCellBadge row={row} />,
  },
  {
    key: 'approvalStatus',
    header: 'Approval',
    field: 'approvalStatus',
    sortable: true,
    render: (row) => {
      if (row.postType !== 'ai') return <StatusBadge value="not_required" />
      if (!row.approvalStatus || row.approvalStatus === 'content_generation_pending') {
        return <span className="text-[10px] text-[var(--color-text-muted)]">—</span>
      }
      return <ApprovalBadge postId={String(row._id)} approvalStatus={row.approvalStatus} />
    },
  },
  {
    key: 'approvedByEmail',
    header: 'Approver Email',
    render: (row) => (
      <span className="text-xs text-[var(--color-text-muted)] truncate max-w-[160px] block">
        {row.approvedByEmail || '—'}
      </span>
    ),
  },
  {
    key: 'scheduledAt', header: 'Scheduled',
    render: (row) => <span className="whitespace-nowrap text-xs">{row.scheduledAt ? new Date(row.scheduledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'Now'}</span>
  },
  {
    key: 'createdAt',
    header: 'Created At',
    field: 'createdAt',
    sortable: true,
    render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.createdAt)}</span>,
  },
]



export const createSocialPostFormConfig = (
  categories: SocialCategory[] = [],
  topicSuggestionOptions: TopicSuggestionOptions = {},
  formDefaults: SocialFormDefaults = {},
): CrudFormConfig<any> => ({
  schema: socialPostFormSchema,
  defaultValues: {
    postType: 'manual',
    postingMode: 'now',
    categoryId: '',
    topic: '',
    targetAudience: '',
    content: '',
    tone: formDefaults.defaultTone || '',
    platforms: ['facebook'],
    // Status is always 'scheduled' for new posts — set server-side
    status: 'scheduled',
    // approvalStatus is server-managed — not set by user
    approvedByEmail: '',
    scheduledAt: new Date(),
    platformSpecificContent: {
      facebook: {
        caption: '',
        hashtags: [],
        shortFormVideo: { title: '', hook: '', script: '', thumbnail_text: '', thumbnail_concept: '', hashtags: [] }
      },
      instagram: {
        caption: '',
        hashtags: [],
        shortFormVideo: { title: '', hook: '', script: '', thumbnail_text: '', thumbnail_concept: '', hashtags: [] }
      },
      linkedin: {
        content: '',
        hashtags: [],
        shortFormVideo: { title: '', hook: '', script: '', thumbnail_text: '', thumbnail_concept: '', hashtags: [] }
      },
      youtube: {
        title: '',
        description: '',
        video_angle: '',
        target_audience: '',
        business_summary: '',
        why_watch_now: '',
        business_impact_opportunities: '',
        key_talking_points: [],
        actionable_recommendations: [],
        proof_points_or_examples: [],
        viewer_takeaways: [],
        discussion_question: '',
        script: '',
        tags: [],
        thumbnail_text: '',
        thumbnail_concept: '',
        pinned_comment: '',
        community_post: '',
        shorts_ideas: []
      }
	    }
	  },
	  onValuesChange: (values, prevValues, setValue) => {
	    if (!prevValues || prevValues.categoryId === undefined) return
	    if (!prevValues.categoryId) return
	    if (values.categoryId === prevValues.categoryId) return

	    setValue('topic', '', { shouldDirty: true, shouldTouch: true, shouldValidate: false })
	  },
	  fields: [
    {
      name: 'postType', label: 'Post Type', type: 'select', options: [
        { label: 'Manual Posting', value: 'manual' },
        { label: 'AI Generation', value: 'ai' },
      ]
    },
    {
      name: 'postingMode', label: 'When to Post', type: 'select', options: [
        { label: 'Post Now', value: 'now' },
        { label: 'Schedule for Later', value: 'schedule' },
      ]
    },
    // Status is not shown — always 'scheduled', managed by the server
    {
      name: 'categoryId',
      label: 'Category',
      type: 'select',
      options: (categories || []).map(c => ({ label: c.name, value: c._id })),
      placeholder: 'Select category',
    },
    {
      name: 'topic',
      label: 'Prompt/Topic',
      type: 'tags',
      tags: {
        maxItems: 1,
        maxLength: TOPIC_MAX_LENGTH,
        showCharacterCount: true,
        commitOnBlur: true,
        removeButtonPosition: 'start',
        valueMode: 'string',
        singleValueEditor: 'textarea',
        rows: 6,
        onDeleteOption: topicSuggestionOptions.onDeleteTopicSuggestion,
      },
      options: (values) => {
        const categoryId = values.categoryId;
        if (!categoryId) return [];
        const category = categories.find(c => c._id === categoryId);
        if (!category) return [];
        return (category.interests || []).map(i => ({ label: i, value: i, category: category.name }));
      },
      placeholder: 'Type a topic or short prompt',
      helperText: `Use a short topic or a clear prompt up to ${TOPIC_MAX_LENGTH} characters.`
    },
    {
      name: 'targetAudience',
      label: 'Target Audience',
      type: 'tags',
      tags: {
        maxItems: 1,
        maxLength: TOPIC_MAX_LENGTH,
        showCharacterCount: true,
        commitOnBlur: true,
        removeButtonPosition: 'start',
        valueMode: 'string',
        onDeleteOption: topicSuggestionOptions.onDeleteAudienceSuggestion,
      },
      options: () => createGlobalAudienceOptions(categories),
      placeholder: 'Type the audience to impress',
      helperText: `Describe who this content should persuade or help, up to ${TOPIC_MAX_LENGTH} characters.`
    },
    {
      name: 'approvedByEmail',
      label: 'Approver Email',
      type: 'text',
      placeholder: 'approver@example.com',
      helperText: 'The approval request email will be sent to this address',
      visibleIf: (values) => values.postType === 'ai',
    },
    { name: 'platforms', label: 'Platforms', type: 'platformSelector' },

    { name: 'tone', label: 'Tone', type: 'toneSelector', placeholder: 'Select a tone' },
    {
      name: 'content',
      label: 'Main Content',
      type: 'textarea',
      rows: 5,
      helperText: 'Base content used as fallback for all platforms'
    },
    {
      name: 'platformSpecificContent.facebook.caption',
      label: 'Facebook Caption',
      type: 'textarea',
      rows: 5,
      visibleIf: (values) => values.platforms?.includes('facebook')
    },
    {
      name: 'platformSpecificContent.facebook.shortFormVideo.script',
      label: 'Facebook Video Script',
      type: 'textarea',
      rows: 8,
      visibleIf: (values) => values.platforms?.includes('facebook')
    },
    {
      name: 'platformSpecificContent.facebook.shortFormVideo.thumbnail_text',
      label: 'Facebook Video Thumbnail Text',
      type: 'text',
      visibleIf: (values) => values.platforms?.includes('facebook')
    },
    {
      name: 'platformSpecificContent.facebook.shortFormVideo.thumbnail_concept',
      label: 'Facebook Video Thumbnail Concept',
      type: 'textarea',
      rows: 3,
      visibleIf: (values) => values.platforms?.includes('facebook')
    },
    {
      name: 'platformSpecificContent.facebook.shortFormVideo.hashtags',
      label: 'Facebook Video Hashtags',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('facebook')
    },
    {
      name: 'platformSpecificContent.instagram.caption',
      label: 'Instagram Caption',
      type: 'textarea',
      rows: 5,
      visibleIf: (values) => values.platforms?.includes('instagram')
    },
    {
      name: 'platformSpecificContent.instagram.shortFormVideo.script',
      label: 'Instagram Video Script',
      type: 'textarea',
      rows: 8,
      visibleIf: (values) => values.platforms?.includes('instagram')
    },
    {
      name: 'platformSpecificContent.instagram.shortFormVideo.thumbnail_text',
      label: 'Instagram Video Thumbnail Text',
      type: 'text',
      visibleIf: (values) => values.platforms?.includes('instagram')
    },
    {
      name: 'platformSpecificContent.instagram.shortFormVideo.thumbnail_concept',
      label: 'Instagram Video Thumbnail Concept',
      type: 'textarea',
      rows: 3,
      visibleIf: (values) => values.platforms?.includes('instagram')
    },
    {
      name: 'platformSpecificContent.instagram.shortFormVideo.hashtags',
      label: 'Instagram Video Hashtags',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('instagram')
    },
    {
      name: 'platformSpecificContent.linkedin.content',
      label: 'LinkedIn Content',
      type: 'textarea',
      rows: 5,
      visibleIf: (values) => values.platforms?.includes('linkedin')
    },
    {
      name: 'platformSpecificContent.linkedin.hashtags',
      label: 'LinkedIn Hashtags',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('linkedin')
    },
    {
      name: 'platformSpecificContent.linkedin.shortFormVideo.script',
      label: 'LinkedIn Video Script',
      type: 'textarea',
      rows: 8,
      visibleIf: (values) => values.platforms?.includes('linkedin')
    },
    {
      name: 'platformSpecificContent.linkedin.shortFormVideo.thumbnail_text',
      label: 'LinkedIn Video Thumbnail Text',
      type: 'text',
      visibleIf: (values) => values.platforms?.includes('linkedin')
    },
    {
      name: 'platformSpecificContent.linkedin.shortFormVideo.thumbnail_concept',
      label: 'LinkedIn Video Thumbnail Concept',
      type: 'textarea',
      rows: 3,
      visibleIf: (values) => values.platforms?.includes('linkedin')
    },
    {
      name: 'platformSpecificContent.linkedin.shortFormVideo.hashtags',
      label: 'LinkedIn Video Hashtags',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('linkedin')
    },
    {
      name: 'platformSpecificContent.youtube.title',
      label: 'YouTube Video Title',
      type: 'text',
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.description',
      label: 'YouTube Description',
      type: 'textarea',
      rows: 5,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.video_angle',
      label: 'YouTube Video Angle',
      type: 'textarea',
      rows: 3,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.target_audience',
      label: 'YouTube Target Audience',
      type: 'textarea',
      rows: 3,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.business_summary',
      label: 'YouTube Business Summary',
      type: 'textarea',
      rows: 4,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.why_watch_now',
      label: 'YouTube Why Watch Now',
      type: 'textarea',
      rows: 3,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.business_impact_opportunities',
      label: 'YouTube Business Impact & Opportunities',
      type: 'textarea',
      rows: 4,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.key_talking_points',
      label: 'YouTube Key Talking Points',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.actionable_recommendations',
      label: 'YouTube Actionable Recommendations',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.proof_points_or_examples',
      label: 'YouTube Proof Points Or Examples',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.viewer_takeaways',
      label: 'YouTube Viewer Takeaways',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.discussion_question',
      label: 'YouTube Discussion Question',
      type: 'textarea',
      rows: 3,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.shorts_ideas',
      label: 'YouTube Shorts Ideas',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.tags',
      label: 'YouTube Tags',
      type: 'tags',
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.thumbnail_text',
      label: 'YouTube Thumbnail Text',
      type: 'text',
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.thumbnail_concept',
      label: 'YouTube Thumbnail Concept',
      type: 'textarea',
      rows: 3,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.pinned_comment',
      label: 'YouTube Pinned Comment',
      type: 'textarea',
      rows: 4,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },
    {
      name: 'platformSpecificContent.youtube.community_post',
      label: 'YouTube Community Post',
      type: 'textarea',
      rows: 4,
      visibleIf: (values) => values.platforms?.includes('youtube')
    },

    {
      name: 'mediaUrls',
      label: 'Images (upload files or paste URLs)',
      type: 'mediaUpload',
      visibleIf: (values) => !values.videoUrl,
      upload: {
        folder: 'socialMediaPosts/uploaded',
        maxFiles: 10,
      }
    },
    {
      name: 'videoUrl',
      label: 'Video (upload file or paste URL)',
      type: 'videoUpload',
      visibleIf: (values) => !values.mediaUrls?.length && !values.mediaUrl,
      upload: {
        folder: 'socialMediaPosts/uploaded',
      }
    },
    {
      name: 'scheduledAt',
      label: 'Schedule For',
      type: 'date',
      date: { showTime: true, hourFormat: '12' },
      visibleIf: (values) => values.postingMode === 'schedule'
    },
  ],
})
