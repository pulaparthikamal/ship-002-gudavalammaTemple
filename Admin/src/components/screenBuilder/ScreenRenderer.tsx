import { useSearchParams } from 'react-router-dom'
import { useGetDraftPageContentQuery, useGetPublishedPageContentQuery } from '@/services/api/endpoints/pageContentApi'
import { WidgetTreeRenderer } from './WidgetTreeRenderer'
import type { ScreenKey } from '@/types/pageContent'

interface ScreenRendererProps {
  screenKey: ScreenKey
}

/**
 * Mounted inside each real devotee-facing page to render the admin's
 * customized content (banners, carousels, promo text, social links,
 * announcements) for that screen. Renders nothing if the screen has no
 * content yet, so it's always safe to mount.
 *
 * When loaded with `?previewDraft=1` — as the Screen Customizer's preview
 * mode does, via an iframe pointed at this same real route — it renders the
 * staff-only `draft` content instead of `published`, so an editor can see the
 * actual real page (nav/footer/booking UI and all) with their in-progress
 * edits in place, not just an isolated widget tree.
 */
export function ScreenRenderer({ screenKey }: ScreenRendererProps) {
  const [searchParams] = useSearchParams()
  const previewDraft = searchParams.get('previewDraft') === '1'

  const publishedResult = useGetPublishedPageContentQuery(screenKey, { skip: previewDraft })
  const draftResult = useGetDraftPageContentQuery(screenKey, { skip: !previewDraft })

  const widgets = (previewDraft ? draftResult.data : publishedResult.data) ?? []
  if (!widgets.length) return null
  return <WidgetTreeRenderer widgets={widgets} />
}
