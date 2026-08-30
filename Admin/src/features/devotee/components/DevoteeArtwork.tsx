import { ScreenRenderer } from '@/components/screenBuilder/ScreenRenderer'

/**
 * The decorative zone on the devotee login/register/forgot-password pages —
 * customizable via the Screen Customizer (screenKey 'devoteeAuth', see
 * ScreenBuilderPage) the same way every other devotee-facing screen's
 * banners/images are, instead of a hardcoded illustration. Ships with a
 * default single-image template (see pageContentService.DEFAULT_TEMPLATES)
 * so it's never blank before staff have customized it.
 */
export function DevoteeArtwork() {
  return (
    <div className="dp-auth-art">
      <ScreenRenderer screenKey="devoteeAuth" />
    </div>
  )
}
