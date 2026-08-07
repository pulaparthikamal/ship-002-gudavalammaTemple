import { useState } from 'react'
import { z } from 'zod'
import { marked } from 'marked'
import { Dialog } from 'primereact/dialog'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { ExternalLink, Link2 } from 'lucide-react'
import { cn } from '@/utils/classNames'
import { CreatorResearchInformation } from '@/components/social/CreatorResearchInformation'
import { PromptTopicCell } from '@/components/ui/PromptTopicCell'
import type {
  MediaCategory,
  MediaCategoryCreatePayload,
  MediaCategoryFormValues,
  MediaCategoryUpdatePayload,
} from '@/types/mediaCategory'

const defaultPlatformEnable = {
  youtube: false,
  facebook: false,
  instagram: false,
  linkedin: false,
} satisfies Record<string, boolean>

export const mediaCategoryApiDetails = {
  endpoint: '/mediaCategories',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const mediaCategoryActiveOptions = [
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
]

export function PlatformIcon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null
  const n = name.toLowerCase()
  
  const iconStyle = { 
    fontSize: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'middle'
  }

  const getPiClass = () => {
    if (n.includes('twitter') || n.includes('x')) return 'pi-twitter'
    if (n.includes('instagram')) return 'pi-instagram'
    if (n.includes('linkedin')) return 'pi-linkedin'
    if (n.includes('facebook')) return 'pi-facebook'
    if (n.includes('pinterest')) return 'pi-pinterest'
    if (n.includes('tiktok')) return 'pi-video'
    if (n.includes('threads')) return 'pi-at'
    if (n.includes('bluesky')) return 'pi-cloud'
    if (n.includes('youtube')) return 'pi-youtube'
    return 'pi-globe'
  }

  const getColor = () => {
    if (n.includes('twitter') || n.includes('x')) return '#000000'
    if (n.includes('instagram')) return '#E4405F'
    if (n.includes('linkedin')) return '#0077B5'
    if (n.includes('facebook')) return '#1877F2'
    if (n.includes('pinterest')) return '#BD081C'
    if (n.includes('tiktok')) return '#000000'
    if (n.includes('threads')) return '#000000'
    if (n.includes('bluesky')) return '#0285FF'
    if (n.includes('youtube')) return '#FF0000'
    return 'var(--color-primary)'
  }

  return <i className={cn("pi", getPiClass(), className)} style={{ color: getColor(), ...iconStyle }} />
}

export const mediaCategoryFrequencyOptions = [
  { label: 'Every Day', value: 1 },
  { label: 'Every 2 Days', value: 2 },
  { label: 'Every 3 Days', value: 3 },
  { label: 'Every 4 Days', value: 4 },
  { label: 'Every 5 Days', value: 5 },
  { label: 'Every 6 Days', value: 6 },
  { label: 'Every Week (7 days)', value: 7 },
  { label: 'Every 15 Days', value: 15 },
  { label: 'Every Month (30 days)', value: 30 },
]

export const mediaCategoryFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  content: z.string().trim().optional(),
  videoUrl: z.string().trim().url('Please enter a valid URL').optional().or(z.literal('')),
  imageUrl: z.string().trim().url('Please enter a valid image URL').optional().or(z.literal('')),
  description: z.string().trim().optional(),
  interestedTopics: z.union([z.string(), z.array(z.string())]).optional(),
  frequencyOfPublishing: z.union([z.number().int().min(1, 'Must be at least 1 day'), z.literal('')]).optional(),
  scheduledDate: z.union([z.date(), z.string(), z.null()]).optional(),
  tone: z.string().trim().optional(),
  platform: z.string().trim().optional(),
  active: z.boolean(),
}) as z.ZodType<MediaCategoryFormValues>

export const mediaCategoryDefaultValues: MediaCategoryFormValues = {
  _id: '',
  name: '',
  content: '',
  videoUrl: '',
  imageUrl: '',
  description: '',
  interestedTopics: '',
  frequencyOfPublishing: '',
  scheduledDate: null,
  tone: '',
  platform: '',
  active: true,
}

export function createMediaCategoryFormConfig(
  interestedTopics: any[] = [],
  frequencyOptions: any[] = mediaCategoryFrequencyOptions
): CrudFormConfig<MediaCategoryFormValues> {
  const chipOptions = interestedTopics.flatMap((cat) =>
    (cat.subTopics || []).map((sub: string) => ({
      label: sub,
      value: sub,
      category: cat.category,
    }))
  )

  return {
    schema: mediaCategoryFormSchema,
    defaultValues: mediaCategoryDefaultValues,
    columns: 1,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'platform',
        label: 'Social Media Platform',
        type: 'platformSelector',
        placeholder: 'Select platform',
      },
      {
        name: 'name',
        label: 'Category Name',
        type: 'text',
        placeholder: 'Category name',
      },
      {
        name: 'tone',
        label: 'Content Tone',
        type: 'toneSelector',
        placeholder: 'Select content tone',
      },
      {
        name: 'interestedTopics',
        label: 'Prompt/Topic',
        type: 'chips',
        options: chipOptions,
        placeholder: 'Select a prompt/topic',
        helperText: 'Select the prompts/topics that this social media account should focus on.',
      },
      {
        name: 'frequencyOfPublishing',
        label: 'Frequency of Publishing',
        type: 'select',
        options: frequencyOptions,
        placeholder: 'Select frequency',
        helperText: 'How often to publish content for this category.',
      },
      {
        name: 'scheduledDate',
        label: 'Scheduled Date',
        type: 'date',
        placeholder: 'Select scheduled date',
        helperText: 'When this content is planned to be published.',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        placeholder: 'Brief description of the category',
      },
      {
        name: 'content',
        label: 'Category Content',
        type: 'textarea',
        placeholder: 'Category content',
      },
      {
        name: 'imageUrl',
        label: 'Image URL',
        type: 'text',
        placeholder: 'https://example.com/image.jpg',
      },
      {
        name: 'videoUrl',
        label: 'Video URL',
        type: 'text',
        placeholder: 'https://example.com/video',
      },
      {
        name: 'active',
        label: 'Active Category',
        type: 'switch',
        helperText: 'Disable this when the category should not be available.',
      },
    ],
  }
}

function formatCategoryDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function renderBooleanBadge(value: boolean, trueLabel: string, falseLabel: string) {
  return (
    <span
      className={
        value
          ? 'inline-flex rounded-lg bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]'
          : 'inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]'
      }
    >
      {value ? trueLabel : falseLabel}
    </span>
  )
}

function stripMarkdown(text?: string | null) {
  if (!text) return ''
  return text
    .replace(/[#*`~_]/g, '') // Remove basic formatting characters
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Simplify links
    .replace(/\|/g, ' ') // Remove table pipes
    .replace(/[-+]{3,}/g, '') // Remove dividers/table lines
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim()
}

type MediaType = 'image' | 'video'

function MediaCell({ url, type }: { url: string; type: MediaType }) {
  const [open, setOpen] = useState(false)

  const downloadFile = () => {
    const ext = type === 'video' ? 'mp4' : 'jpg'
    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `media.${ext}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      })
      .catch(console.error)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="group relative flex max-w-[7rem] items-center gap-1.5 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] shadow-sm transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:shadow-md"
        title={`Preview ${type}`}
      >
        {type === 'image' ? (
          <img
            src={url}
            alt="thumb"
            className="h-5 w-5 shrink-0 rounded object-cover ring-1 ring-[var(--color-border)] group-hover:ring-[var(--color-primary)]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <i className="pi pi-play-circle text-xs" />
          </span>
        )}
        <span className="truncate">{type === 'image' ? 'Image' : 'Video'}</span>
        <i className="pi pi-external-link shrink-0 text-[9px] opacity-0 transition-opacity group-hover:opacity-60" />
      </button>

      <Dialog
        visible={open}
        onHide={() => setOpen(false)}
        header={
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <i className={`pi ${type === 'image' ? 'pi-image' : 'pi-video'} text-sm`} />
            </span>
            <span className="text-sm font-bold text-[var(--color-text-strong)]">
              {type === 'image' ? 'Image Preview' : 'Video Player'}
            </span>
          </div>
        }
        className="w-full max-w-2xl"
        pt={{
          root: { className: 'rounded-2xl overflow-hidden shadow-2xl' },
          header: { className: 'border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4' },
          content: { className: 'bg-[var(--color-surface)] p-0' },
          closeButton: { className: 'text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]' },
        }}
      >
        <div className="flex flex-col">
          <div className={`flex min-h-[320px] items-center justify-center ${
            type === 'video' ? 'bg-zinc-950' : 'bg-[var(--color-surface-muted)] p-8'
          }`}>
            {type === 'image' ? (
              <img
                src={url}
                alt="Full preview"
                className="max-h-[420px] max-w-full rounded-xl object-contain shadow-2xl ring-1 ring-black/5"
              />
            ) : (
              <video
                src={url}
                controls
                autoPlay={false}
                className="max-h-[420px] w-full rounded-lg shadow-2xl outline-none"
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:underline"
              title={url}
            >
              {url}
            </a>
            <button
              type="button"
              onClick={downloadFile}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-text-strong)] shadow-sm transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
            >
              <i className="pi pi-download text-xs" />
              Download
            </button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

export function createMediaCategoryTableColumns(): Array<CrudTableColumn<MediaCategory>> {
  return [
    {
      key: 'platform',
      header: 'Platform',
      field: 'platform',
      render: (category) => {
        const selectedPlatform = getSelectedPlatform(category)

        return (
          <div className="flex items-center gap-2.5 min-h-[24px]">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-muted)] shadow-sm">
              <PlatformIcon name={selectedPlatform} />
            </div>
            <span className="text-xs font-medium text-[var(--color-text-strong)]">{selectedPlatform || '-'}</span>
          </div>
        )
      },
    },
    {
      key: 'name',
      header: 'Category Name',
      field: 'name',
      sortField: 'name',
      filter: {
        key: 'name',
        type: 'regexOr',
        placeholder: 'Search name',
        matchModes: ['contains', 'notContains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
    },
    {
      key: 'scheduledDate',
      header: 'Scheduled',
      sortField: 'scheduledDate',
      render: (category) => (
        <span className="text-xs font-medium text-[var(--color-primary)]">
          {category.scheduledDate ? formatCategoryDate(category.scheduledDate) : '-'}
        </span>
      ),
    },
    {
      key: 'tone',
      header: 'Tone',
      field: 'tone',
      render: (category) => <span>{category.tone || '-'}</span>,
    },
    {
      key: 'interestedTopics',
      header: 'Prompt/Topic',
      field: 'interestedTopics',
      render: (category) => <PromptTopicCell value={category.interestedTopics} />,
    },
    {
      key: 'frequencyOfPublishing',
      header: 'Freq.',
      field: 'frequencyOfPublishing',
      render: (category) =>
        category.frequencyOfPublishing != null ? (
          <span>{category.frequencyOfPublishing}d</span>
        ) : (
          <span>-</span>
        ),
    },
    {
      key: 'description',
      header: 'Description',
      field: 'description',
      render: (category) => <span className="truncate max-w-[150px] block text-xs text-[var(--color-text-muted)]">{category.description || '-'}</span>,
    },
    {
      key: 'content',
      header: 'Content',
      field: 'content',
      render: (category) => <span className="truncate max-w-[200px] block text-xs text-[var(--color-text-muted)] italic">{stripMarkdown(category.content) || '-'}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      sortField: 'active',
      render: (category) => renderBooleanBadge(category.active, 'Active', 'Inactive'),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortField: 'updatedAt',
      field: 'updatedAt',
      filter: {
        key: 'updatedAt',
        input: 'date',
        placeholder: 'Updated date',
      },
      render: (category) => formatCategoryDate(category.updatedAt),
    },
    {
      key: 'imageUrl',
      header: 'Image',
      field: 'imageUrl',
      render: (category) => (
        category.imageUrl ? (
          <MediaCell url={category.imageUrl} type="image" />
        ) : (
          <span className="text-[var(--color-text-muted)] text-xs">—</span>
        )
      ),
    },
    {
      key: 'videoUrl',
      header: 'Video',
      field: 'videoUrl',
      render: (category) => (
        category.videoUrl ? (
          <MediaCell url={category.videoUrl} type="video" />
        ) : (
          <span className="text-[var(--color-text-muted)] text-xs">—</span>
        )
      ),
    },
    {
      key: 'categoryUrls',
      header: 'Sources',
      field: 'categoryUrls',
      render: (category) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
          <Link2 className="h-3 w-3" />
          {category.categoryUrls?.length || 0}
        </span>
      ),
    },
  ]
}

function parseInterestedTopics(raw: string | string[] | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return raw.split(',').map((t) => t.trim()).filter(Boolean)
}

function normalizePlatformKey(platform?: string | null) {
  return platform?.trim().toLowerCase().replace(/\s+/g, '') || ''
}

function mapPlatformToEnable(platform?: string | null) {
  const selectedPlatform = normalizePlatformKey(platform)
  const enable: Record<string, boolean> = { ...defaultPlatformEnable }

  if (selectedPlatform) {
    enable[selectedPlatform] = true
  }

  return enable
}

function getSelectedPlatform(category: MediaCategory) {
  const enabledPlatform = Object.entries(category.enable ?? {}).find(([, enabled]) => enabled)?.[0]

  return enabledPlatform ?? category.platform ?? ''
}

function serializeDateOnly(value: string | Date | null | undefined) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())).toISOString()
  }

  return value
}

export function mapCategoryToFormValues(category: MediaCategory): MediaCategoryFormValues {
  const selectedPlatform = getSelectedPlatform(category)

  return {
    _id: category._id,
    name: category.name,
    content: category.content ?? '',
    videoUrl: category.videoUrl ?? '',
    imageUrl: category.imageUrl ?? '',
    description: category.description ?? '',
    interestedTopics: category.interestedTopics || [],
    frequencyOfPublishing: category.frequencyOfPublishing ?? '',
    scheduledDate: category.scheduledDate ? new Date(category.scheduledDate) : null,
    tone: category.tone ?? '',
    platform: selectedPlatform,
    active: category.active,
  }
}

export function mapCategoryFormToCreatePayload(values: MediaCategoryFormValues): MediaCategoryCreatePayload {
  return {
    name: values.name.trim(),
    content: values.content.trim() || undefined,
    videoUrl: values.videoUrl.trim() || undefined,
    imageUrl: values.imageUrl.trim() || undefined,
    description: values.description.trim() || undefined,
    interestedTopics: parseInterestedTopics(values.interestedTopics) || undefined,
    frequencyOfPublishing: values.frequencyOfPublishing !== '' ? Number(values.frequencyOfPublishing) : undefined,
    scheduledDate: serializeDateOnly(values.scheduledDate),
    tone: values.tone || undefined,
    enable: mapPlatformToEnable(values.platform),
    active: values.active,
  }
}

export function mapCategoryFormToUpdatePayload(values: MediaCategoryFormValues): MediaCategoryUpdatePayload {
  return {
    name: values.name.trim(),
    content: values.content.trim() || null,
    videoUrl: values.videoUrl.trim() || null,
    imageUrl: values.imageUrl.trim() || null,
    description: values.description.trim() || null,
    interestedTopics: parseInterestedTopics(values.interestedTopics) || [],
    frequencyOfPublishing: values.frequencyOfPublishing !== '' ? Number(values.frequencyOfPublishing) : null,
    scheduledDate: serializeDateOnly(values.scheduledDate),
    tone: values.tone || null,
    enable: mapPlatformToEnable(values.platform),
    active: values.active,
  }
}

export function renderCategoryDetails(category: MediaCategory) {
  const selectedPlatform = getSelectedPlatform(category)

  return (
    <div className="space-y-5">
      <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Platform</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right flex items-center justify-end gap-2">
            <PlatformIcon name={selectedPlatform} />
            {selectedPlatform || '-'}
          </dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Category Name</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{category.name}</dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Tone</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{category.tone || '-'}</dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Prompt/Topic</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">
             {category.interestedTopics && category.interestedTopics.length > 0 ? category.interestedTopics.join(', ') : '-'}
          </dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Frequency</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{category.frequencyOfPublishing ? `${category.frequencyOfPublishing} days` : '-'}</dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Scheduled Date</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-primary)] sm:text-right">
            {category.scheduledDate ? formatCategoryDate(category.scheduledDate) : '-'}
          </dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Description</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{category.description || '-'}</dd>
        </div>
        {(category.imageUrl || category.videoUrl) && (
          <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Media</dt>
            <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right flex items-center justify-end gap-3">
               {category.imageUrl && <MediaCell url={category.imageUrl} type="image" />}
               {category.videoUrl && <MediaCell url={category.videoUrl} type="video" />}
            </dd>
          </div>
        )}
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Status</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{category.active ? 'Active' : 'Inactive'}</dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Created</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{formatCategoryDate(category.createdAt)}</dd>
        </div>
        <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-center">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Updated</dt>
          <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{formatCategoryDate(category.updatedAt)}</dd>
        </div>
      </dl>

      <div className="rounded-lg border border-[var(--color-border)] p-5 bg-white shadow-sm">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></span>
          Generated Content
        </h4>
        <div 
          className="category-content-renderer text-[var(--color-text-strong)] leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: category.content 
              ? marked.parse(category.content) 
              : '<p class="text-neutral-400 italic">No content generated yet.</p>' 
          }} 
        />
      </div>

      <CreatorResearchInformation report={category.additionalInformation} />

      {category.categoryUrls && category.categoryUrls.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] p-5 bg-white shadow-sm">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></span>
            Research Sources
          </h4>
          <ul className="grid gap-2 sm:grid-cols-2">
            {category.categoryUrls.map((url, index) => (
              <li key={index} className="group flex items-center gap-2 rounded-md border border-[var(--color-border)] p-2 hover:bg-[var(--color-surface-muted)] transition-colors">
                <Link2 className="h-3 w-3 text-[var(--color-text-muted)]" />
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="truncate text-xs font-medium text-[var(--color-primary)] hover:underline flex-1"
                >
                  {url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                </a>
                <ExternalLink className="h-3 w-3 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .category-content-renderer h1 { font-size: 1.5rem; font-weight: 800; margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--color-text-strong); border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem; }
        .category-content-renderer h2 { font-size: 1.25rem; font-weight: 700; margin-top: 1.25rem; margin-bottom: 0.5rem; color: var(--color-text-strong); }
        .category-content-renderer h3 { font-size: 1.1rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; color: var(--color-text-strong); }
        .category-content-renderer p { margin-bottom: 1rem; font-size: 0.95rem; }
        .category-content-renderer ul, .category-content-renderer ol { margin-bottom: 1rem; padding-left: 1.5rem; }
        .category-content-renderer li { margin-bottom: 0.35rem; font-size: 0.95rem; }
        .category-content-renderer code { background: var(--color-surface-muted); padding: 0.2rem 0.4rem; rounded: 4px; font-family: monospace; font-size: 0.85rem; }
        .category-content-renderer blockquote { border-left: 4px solid var(--color-primary); padding-left: 1rem; font-style: italic; color: var(--color-text-muted); margin: 1.5rem 0; }
        .category-content-renderer table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; font-size: 0.9rem; }
        .category-content-renderer th { background: var(--color-surface-muted); text-align: left; padding: 0.75rem; border: 1px solid var(--color-border); font-weight: 700; }
        .category-content-renderer td { padding: 0.75rem; border: 1px solid var(--color-border); }
        .category-content-renderer tr:nth-child(even) { background: var(--color-surface-muted-soft, #f9fafb); }
        .category-content-renderer hr { border: 0; border-top: 1px solid var(--color-border); margin: 1.5rem 0; }
        .category-content-renderer strong { font-weight: 700; color: var(--color-text-strong); }
      `}} />
    </div>
  )
}

export function renderCategoryGridItem(category: MediaCategory) {
  const selectedPlatform = getSelectedPlatform(category)

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{category.name}</h3>
          <p className="line-clamp-2 text-xs text-[var(--color-text-muted)] leading-relaxed">{stripMarkdown(category.content) || 'No content generated'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {renderBooleanBadge(category.active, 'Active', 'Inactive')}
        {selectedPlatform && (
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
            <PlatformIcon name={selectedPlatform} className="h-3 w-3" />
            {selectedPlatform}
          </div>
        )}
      </div>

      <dl className="grid gap-2.5 sm:grid-cols-2">
        {[
          ['Freq.', category.frequencyOfPublishing != null ? `${category.frequencyOfPublishing}d` : '-'],
          ['Updated', formatCategoryDate(category.updatedAt)],
        ].map(([label, value]) => (
          <div key={label} className="space-y-1">
            <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {label}
            </dt>
            <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
