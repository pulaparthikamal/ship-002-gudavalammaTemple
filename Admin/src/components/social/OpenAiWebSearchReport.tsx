import { marked } from 'marked'
import type { OpenAiWebSearchInformation } from '@/types/social'

interface ReportProps {
  report?: OpenAiWebSearchInformation | Record<string, any> | null
  fallbackContent?: string
}

export function isOpenAiWebSearchInformation(report: unknown): report is OpenAiWebSearchInformation {
  return Boolean(report && typeof report === 'object' && (report as OpenAiWebSearchInformation).source_type === 'openai_web_search')
}

export function OpenAiWebSearchMainBlock({ report }: ReportProps) {
  if (!isOpenAiWebSearchInformation(report)) return null

  const markdown = buildMainContentMarkdown(report)
  if (!markdown.trim()) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <MarkdownContent markdown={markdown} className="openai-websearch-content px-4 py-4 text-sm leading-relaxed text-slate-700" />
    </div>
  )
}

export function OpenAiWebSearchMasterArticle({ report, fallbackContent }: ReportProps) {
  if (!isOpenAiWebSearchInformation(report)) {
    return (
      <MarkdownContent markdown={fallbackContent || 'No master content available'} className="openai-websearch-content px-4 py-4 text-sm leading-relaxed text-slate-700 bg-slate-50" />
    )
  }

  const article = report.master_article
  if (!article) {
    return (
      <MarkdownContent markdown={fallbackContent || 'No master content available'} className="openai-websearch-content px-4 py-4 text-sm leading-relaxed text-slate-700 bg-slate-50" />
    )
  }

  const markdown = buildMasterArticleMarkdown(report)

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      <MarkdownContent markdown={markdown} className="openai-websearch-content px-4 py-4 text-sm leading-relaxed text-slate-700" />
    </div>
  )
}

function MarkdownContent({ markdown, className }: { markdown: string; className?: string }) {
  const html = addAnchorTargets(marked.parse(markdown) as string)

  return (
    <>
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .openai-websearch-content h1 { font-size: 1.35rem; font-weight: 800; margin: 0 0 0.8rem; color: #0f172a; }
        .openai-websearch-content h2 { font-size: 1rem; font-weight: 800; margin: 1.1rem 0 0.45rem; color: #0f172a; }
        .openai-websearch-content h3 { font-size: 0.95rem; font-weight: 800; margin: 0.9rem 0 0.35rem; color: #0f172a; }
        .openai-websearch-content p { margin: 0 0 0.85rem; }
        .openai-websearch-content ul, .openai-websearch-content ol { margin: 0 0 1rem; padding-left: 1.4rem; }
        .openai-websearch-content li { margin: 0 0 0.35rem; }
        .openai-websearch-content a { color: #0f766e; text-decoration: underline; font-weight: 600; word-break: break-word; }
        .openai-websearch-content code { background: #e2e8f0; padding: 0.1rem 0.3rem; border-radius: 0.25rem; }
        .openai-websearch-content blockquote { border-left: 4px solid #94a3b8; padding-left: 0.9rem; color: #475569; margin: 1rem 0; }
      ` }} />
    </>
  )
}

function addAnchorTargets(html: string) {
  return html.replace(/<a\s+/g, '<a target="_blank" rel="noopener noreferrer" ')
}

function buildMainContentMarkdown(report: OpenAiWebSearchInformation) {
  if (typeof report.raw_main_content === 'string' && report.raw_main_content.trim()) {
    return report.raw_main_content.trim()
  }

  const rawPayload = tryParseJson(report.raw_api_response)
  if (!rawPayload || typeof rawPayload !== 'object') {
    return ''
  }

  const payload = rawPayload as Record<string, any>
  return typeof payload.primary_output === 'string' ? payload.primary_output.trim() : ''
}

function buildMasterArticleMarkdown(report: OpenAiWebSearchInformation) {
  const article = report.master_article || {}
  const sections = [
    article.headline ? `# ${article.headline}` : '',
    buildSection('Timeframe', article.timeframe),
    buildSection('Overview', article.overview),
    buildListSection('Key Updates', article.key_updates),
    buildListSection('Why It Matters', article.why_it_matters),
    buildListSection('Watch Next', article.watch_next),
    buildListSection('Source Notes', article.source_notes),
    buildSourceLinksSection(report.source_urls),
  ]

  return sections.filter(Boolean).join('\n\n').trim()
}

function buildSection(label: string, value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''
  return `## ${label}\n${value.trim()}`
}

function buildListSection(label: string, values: unknown) {
  if (!Array.isArray(values)) return ''
  const items = values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  if (!items.length) return ''
  return `## ${label}\n${items.map((value) => `- ${value}`).join('\n')}`
}

function buildSourceLinksSection(sourceUrls: unknown) {
  if (!Array.isArray(sourceUrls)) return ''
  const urls = sourceUrls.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  if (!urls.length) return ''
  return `## Sources\n${urls.map((url) => `- [${safeHostname(url)}](${url})`).join('\n')}`
}

function tryParseJson(value?: string) {
  if (!value?.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}
