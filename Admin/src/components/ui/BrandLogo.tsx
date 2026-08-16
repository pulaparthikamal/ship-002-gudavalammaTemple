import { TempleGopuramMark } from './TempleGopuramMark'
import { cn } from '@/utils/classNames'
import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { resolveTempleName } from '@/utils/templeName'

interface BrandLogoProps {
  variant?: 'full' | 'mark'
  className?: string
}

export function BrandLogo({ variant = 'full', className }: BrandLogoProps) {
  const isMark = variant === 'mark'
  const { data: templeProfile } = useGetTempleProfileQuery()
  const { language } = useStaffTranslation()

  if (isMark) {
    return <TempleGopuramMark className={cn('block h-9 w-9', className)} />
  }

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <TempleGopuramMark className="block h-10 w-auto shrink-0" />
      <span className="truncate text-base font-semibold leading-tight text-[var(--color-text-strong)]">
        {resolveTempleName(templeProfile, language, 'Temple Administration')}
      </span>
    </span>
  )
}
