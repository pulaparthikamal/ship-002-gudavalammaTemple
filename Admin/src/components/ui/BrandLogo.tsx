import logoUrl from '@/assets/do-systems-logo.png'
import logoWhiteUrl from '@/assets/do-systems-logo-white.png'
import markUrl from '@/assets/do-systems-logo.png'
import { cn } from '@/utils/classNames'
import { useTheme } from '@/hooks/useTheme'

interface BrandLogoProps {
  variant?: 'full' | 'mark'
  className?: string
}

export function BrandLogo({ variant = 'full', className }: BrandLogoProps) {
  const isMark = variant === 'mark'
  const { resolvedTheme } = useTheme()
  const fullLogoUrl = resolvedTheme === 'dark' ? logoWhiteUrl : logoUrl

  return (
    <img
      src={isMark ? markUrl : fullLogoUrl}
      alt="DO SYSTEMS"
      className={cn('block object-contain', isMark ? 'h-9 w-9' : 'h-14 w-auto', className)}
    />
  )
}
