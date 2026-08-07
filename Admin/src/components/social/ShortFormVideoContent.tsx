import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { ShortFormVideoContent as ShortFormVideoContentType } from '@/types/social'

type PlatformContent = {
  shortFormVideo?: ShortFormVideoContentType
  short_form_video?: ShortFormVideoContentType
}

interface ShortFormVideoContentProps {
  content?: PlatformContent
  accentClassName?: string
}

export function getShortFormVideoContent(content?: PlatformContent) {
  return content?.shortFormVideo || content?.short_form_video
}

function hasVideoContent(video?: ShortFormVideoContentType) {
  return Boolean(
    video?.title?.trim()
    || video?.hook?.trim()
    || video?.script?.trim()
    || video?.thumbnail_text?.trim()
    || video?.thumbnail_concept?.trim()
    || video?.hashtags?.length
    || video?.presentation?.sections?.some((section) => section.content?.trim()),
  )
}

export function formatShortFormVideoText(video?: ShortFormVideoContentType) {
  if (!hasVideoContent(video)) return ''

  if (video?.presentation?.replace_fallback) {
    const heading = video.presentation.title || 'Custom Video Script'
    const duration = video.duration_seconds ? `${video.duration_seconds} seconds` : ''
    const sections = (video.presentation.sections || [])
      .filter((section) => section.content?.trim())
      .map((section) => `## ${section.label || section.key || 'Section'}\n${section.content}`)
      .join('\n\n')
    return [`# ${heading}`, duration && `**Duration:** ${duration}`, sections].filter(Boolean).join('\n\n')
  }

  const sections = [
    ['Short-Form Video Title', video?.title],
    ['Duration', video?.duration_seconds ? `${video.duration_seconds} seconds` : '60 seconds'],
    ['Hook', video?.hook],
    ['Script', video?.script],
    ['Thumbnail Text', video?.thumbnail_text],
    ['Thumbnail Concept', video?.thumbnail_concept],
    ['Hashtags', video?.hashtags?.join(' ')],
  ]

  return sections
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([label, value]) => `## ${label}\n${value}`)
    .join('\n\n')
}

export function ShortFormVideoContent({ content, accentClassName = 'text-indigo-600' }: ShortFormVideoContentProps) {
  const video = getShortFormVideoContent(content)
  if (!hasVideoContent(video)) return null

  if (video?.presentation?.replace_fallback) {
    return (
      <div className="mt-4 rounded-lg border border-violet-200 bg-white p-4 text-slate-700">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className={`text-[10px] font-black uppercase tracking-widest ${accentClassName}`}>
            {video.presentation.title || 'Custom Video Script'}
          </span>
          {video.duration_seconds ? (
            <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">
              {video.duration_seconds}s
            </span>
          ) : null}
        </div>

        <div className="space-y-3">
          {(video.presentation.sections || [])
            .filter((section) => section.content?.trim())
            .map((section, index) => {
              const key = section.key || `section-${index}`
              const label = section.label || section.key || 'Section'
              if (key === 'thumbnail_concept') {
                return (
                  <div key={key} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <ThumbnailImagePrompt prompt={section.content || ''} label={label} />
                  </div>
                )
              }
              return (
                <div key={key} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <span className="mb-1 block text-[10px] font-black uppercase text-slate-400">{label}</span>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{section.content}</div>
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`text-[10px] font-black uppercase tracking-widest ${accentClassName}`}>
          {video?.duration_seconds ? `${video.duration_seconds}-Second Video Script` : '60-Second Video Script'}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
          {video?.duration_seconds ? `${video.duration_seconds}s` : '60s'}
        </span>
      </div>

      {video?.title?.trim() && (
        <div className="mb-3 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-bold leading-snug text-slate-900">
          {video.title}
        </div>
      )}

      {video?.hook?.trim() && (
        <div className="mb-3 rounded-md border border-slate-100 bg-slate-50 p-3">
          <span className="mb-1 block text-[10px] font-black uppercase text-slate-400">Hook</span>
          <div className="text-sm font-semibold text-slate-800">{video.hook}</div>
        </div>
      )}

      {video?.script?.trim() && (
        <div className="mb-3">
          <span className="mb-1 block text-[10px] font-black uppercase text-slate-400">Script</span>
          <div className="whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50 p-3 text-sm leading-relaxed">
            {video.script}
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {video?.thumbnail_text?.trim() && (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <span className="mb-1 block text-[10px] font-black uppercase text-slate-400">Thumbnail Text</span>
            <div className="text-sm font-semibold">{video.thumbnail_text}</div>
          </div>
        )}

        {video?.thumbnail_concept?.trim() && (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <ThumbnailImagePrompt prompt={video.thumbnail_concept} />
          </div>
        )}
      </div>

      {video?.hashtags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {video.hashtags.map((hashtag, index) => (
            <span key={`${hashtag}-${index}`} className={`text-xs font-semibold ${accentClassName}`}>
              {hashtag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ThumbnailImagePrompt({ prompt, label = 'Thumbnail Image Prompt' }: { prompt: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase text-slate-400">{label}</span>
        <button
          type="button"
          onClick={copyPrompt}
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy Prompt'}
        </button>
      </div>
      <div className="text-sm leading-relaxed">{prompt}</div>
    </div>
  )
}
