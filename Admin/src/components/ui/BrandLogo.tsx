import { TempleGopuramMark } from './TempleGopuramMark'
import { cn } from '@/utils/classNames'
import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { resolveTempleName } from '@/utils/templeName'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'

interface BrandLogoProps {
  variant?: 'full' | 'mark'
  className?: string
}

/**
 * Renders the staff-uploaded TempleProfile.logoUrl when one exists (set via
 * the Temple Profile screen's logo uploader), falling back to the built-in
 * gopuram illustration otherwise — so every call site updates automatically
 * the moment staff upload a new logo, without code changes.
 */
function BrandMark({ className }: { className?: string }) {
  const { data: templeProfile } = useGetTempleProfileQuery()
  const logoUrl = templeProfile?.logoUrl ? resolveApiAssetUrl(templeProfile.logoUrl) : ''

  if (logoUrl) {
    return <img src={logoUrl} alt="" aria-hidden="true" className={cn('block object-contain', className)} />
  }

  return <TempleGopuramMark className={className} />
}

export function BrandLogo({ variant = 'full', className }: BrandLogoProps) {
  const isMark = variant === 'mark'
  const { data: templeProfile } = useGetTempleProfileQuery()
  const { language } = useStaffTranslation()

  if (isMark) {
    return <BrandMark className={cn('h-9 w-9', className)} />
  }

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <BrandMark className="h-10 w-auto shrink-0" />
      <span className="truncate text-base font-semibold leading-tight text-[var(--color-text-strong)]">
        {resolveTempleName(templeProfile, language, 'Temple Administration')}
      </span>
    </span>
  )
}
