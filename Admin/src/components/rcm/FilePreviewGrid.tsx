import { ExternalLink, FileImage, FileText, FolderOpen } from 'lucide-react'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { getFileNameFromPath } from '@/utils/fileUploads'
import { cn } from '@/utils/classNames'

interface FilePreviewItem {
  title: string
  fileUrl?: string
  subtitle?: string
  description?: string
  alwaysShow?: boolean
  emptyLabel?: string
}

interface FilePreviewGridProps {
  items: FilePreviewItem[]
  emptyMessage?: string
  columns?: 1 | 2 | 3
}

function getNormalizedPath(fileUrl: string) {
  return fileUrl.split('?')[0]?.toLowerCase() ?? fileUrl.toLowerCase()
}

function isImageFile(fileUrl: string) {
  return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(getNormalizedPath(fileUrl))
}

function isPdfFile(fileUrl: string) {
  return /\.pdf$/i.test(getNormalizedPath(fileUrl))
}

function gridClass(columns: 1 | 2 | 3) {
  return cn('grid gap-3', columns >= 2 && 'md:grid-cols-2', columns === 3 && 'xl:grid-cols-3')
}

function EmptyPreview({ label }: { label: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-center">
      <FolderOpen className="h-8 w-8 text-[var(--color-text-muted)]" aria-hidden="true" />
      <p className="text-sm font-medium text-[var(--color-text-muted)]">{label}</p>
    </div>
  )
}

export function FilePreviewGrid({
  items,
  emptyMessage = 'No files uploaded.',
  columns = 2,
}: FilePreviewGridProps) {
  const visibleItems = items.filter((item) => item.alwaysShow || Boolean(item.fileUrl?.trim()))

  if (!visibleItems.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-4 py-5 text-sm font-medium text-[var(--color-text-muted)]">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={gridClass(columns)}>
      {visibleItems.map((item) => {
        const normalizedFileUrl = item.fileUrl?.trim()
        const resolvedUrl = normalizedFileUrl ? resolveApiAssetUrl(normalizedFileUrl) : ''
        const isImage = normalizedFileUrl ? isImageFile(normalizedFileUrl) : false
        const isPdf = normalizedFileUrl ? isPdfFile(normalizedFileUrl) : false
        const fileName = normalizedFileUrl ? getFileNameFromPath(normalizedFileUrl) : ''

        return (
          <article
            key={`${item.title}-${normalizedFileUrl ?? 'empty'}`}
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
          >
            {resolvedUrl ? (
              isImage ? (
                <img
                  src={resolvedUrl}
                  alt={item.title}
                  className="h-48 w-full bg-[var(--color-surface-muted)] object-contain p-2"
                  loading="lazy"
                />
              ) : isPdf ? (
                <iframe
                  title={item.title}
                  src={`${resolvedUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="h-48 w-full border-0 bg-[var(--color-surface-muted)]"
                />
              ) : (
                <div className="flex h-48 flex-col items-center justify-center gap-2 bg-[var(--color-surface-muted)] px-4 text-center">
                  <FileText className="h-8 w-8 text-[var(--color-text-muted)]" aria-hidden="true" />
                  <p className="text-sm font-medium text-[var(--color-text-muted)]">{fileName || 'File preview unavailable'}</p>
                </div>
              )
            ) : (
              <EmptyPreview label={item.emptyLabel ?? 'No file uploaded'} />
            )}

            <div className="space-y-2 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">{item.title}</p>
                {item.subtitle ? (
                  <p className="text-xs font-medium uppercase tracking-normal text-[var(--color-text-muted)]">{item.subtitle}</p>
                ) : null}
                {item.description ? (
                  <p className="text-sm text-[var(--color-text-muted)]">{item.description}</p>
                ) : null}
              </div>

              {resolvedUrl ? (
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)]"
                >
                  {isImage ? <FileImage className="h-4 w-4" aria-hidden="true" /> : <ExternalLink className="h-4 w-4" aria-hidden="true" />}
                  Open file
                </a>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
