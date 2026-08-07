import { ExternalLink, Search, TriangleAlert } from 'lucide-react'
import type { SocialAdditionalInformation, CreatorResearchInformation as CreatorResearchReport } from '@/types/social'

interface Props {
  report?: SocialAdditionalInformation | null
}

const labelForSource = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatDate = (value?: string | null) => {
  if (!value) return 'Time unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

const isCreatorResearchReport = (report: SocialAdditionalInformation | null | undefined): report is CreatorResearchReport => {
  return Boolean(report && typeof report === 'object' && 'type' in report && report.type === 'creator_research')
}

export function CreatorResearchInformation({ report }: Props) {
  if (!isCreatorResearchReport(report)) return null
const discussions = Array.isArray(report.top_discussions)
    ? report.top_discussions.filter((discussion) => {
        const hasContent = Boolean(
          discussion?.headline
          && (
            discussion.why_people_are_talking
            || discussion.emotional_hook
            || discussion.debate_or_tension
            || discussion.why_audience_cares
          )
        )
        return hasContent && Array.isArray(discussion.sources) && discussion.sources.some((source) => Boolean(source?.url))
      })
    : []
  if (discussions.length === 0) return null

  const themes = Array.isArray(report.themes) ? report.themes : []
  const warnings = Array.isArray(report.warnings) ? report.warnings : []
  const coverage = report.source_coverage || {}

  return (
    <details className="group rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-violet-600 p-2 text-white"><Search className="h-5 w-5" /></div>
          <div>
            <h3 className="font-black text-slate-800">Additional Creator Research</h3>
            <p className="mt-1 text-xs text-slate-500">
              {report.research_window?.hours ? `Last ${report.research_window.hours} hours` : 'Requested time window'}
              {' · '}{discussions.length} ranked discussion{discussions.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-violet-700 group-open:hidden">Expand</span>
        <span className="hidden text-xs font-bold text-violet-700 group-open:inline">Collapse</span>
      </summary>

      <div className="space-y-5 border-t border-violet-200 p-5">
        {report.audience && (
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audience</div>
            <div className="mt-1 text-sm font-semibold text-slate-700">{report.audience}</div>
          </div>
        )}

        {Object.keys(coverage).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(coverage).map(([source, status]) => (
              <span
                key={source}
                className={status === 'searched'
                  ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700'
                  : status === 'partial'
                    ? 'rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700'
                    : 'rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600'}
              >
                {labelForSource(source)}: {status}
              </span>
            ))}
          </div>
        )}

        {themes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {themes.map((theme, index) => (
              <span key={`${theme.name}-${index}`} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700">
                {theme.name || 'Research theme'}{typeof theme.discussion_count === 'number' ? ` · ${theme.discussion_count}` : ''}
              </span>
            ))}
          </div>
        )}

        {warnings.map((warning, index) => (
          <div key={index} className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{warning}</span>
          </div>
        ))}

        <div className="space-y-4">
          {discussions.map((discussion, index) => (
              <article key={`${discussion.rank}-${discussion.headline}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white">
                    {discussion.rank || index + 1}
                  </span>
                  <h4 className="font-black leading-snug text-slate-800">{discussion.headline || 'Untitled discussion'}</h4>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <ResearchField label="Why people are talking" value={discussion.why_people_are_talking} />
                  <ResearchField label="Emotional hook" value={discussion.emotional_hook} />
                  <ResearchField label="Debate or tension" value={discussion.debate_or_tension} />
                  <ResearchField label="Why your audience cares" value={discussion.why_audience_cares} />
                </div>
                {discussion.sources?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {discussion.sources.map((source, sourceIndex) => source.url ? (
                      <a
                        key={`${source.url}-${sourceIndex}`}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        title={`${source.title || source.platform || 'Source'} · ${formatDate(source.published_at)}`}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-violet-100 hover:text-violet-700"
                      >
                        {labelForSource(source.platform || 'Source')} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null)}
                  </div>
                ) : null}
              </article>
          ))}
        </div>
      </div>
    </details>
  )
}

function ResearchField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <p className="mt-1 leading-relaxed text-slate-700">{value}</p>
    </div>
  )
}
