import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import gudavalammaDeviImage from '@/assets/gudavalamma-devi.webp'

/**
 * The staff login page's decorative left-column artwork — the temple's
 * uploaded deity picture (TempleProfile.deityImageUrl, see TempleProfilePage),
 * falling back to the bundled default when none has been uploaded yet.
 * `object-fit: contain` deliberately avoids cropping a tall portrait photo.
 */
export function TempleArtwork() {
  const { data: templeProfile } = useGetTempleProfileQuery()
  const src = templeProfile?.deityImageUrl ? resolveApiAssetUrl(templeProfile.deityImageUrl) : gudavalammaDeviImage

  return (
    <div className="temple-login-art">
      <img className="temple-login-art-image" src={src} alt="" />
    </div>
  )
}
