import { useStaffTranslation } from '@/i18n/useTranslation'
import { WIDGET_PALETTE } from '@/types/pageContent'
import type { WidgetType } from '@/types/pageContent'

interface WidgetPaletteProps {
  onAdd: (type: WidgetType) => void
}

export function WidgetPalette({ onAdd }: WidgetPaletteProps) {
  const { t } = useStaffTranslation()

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-strong)]">{t('Add a widget')}</h3>
      <div className="flex flex-col gap-2">
        {WIDGET_PALETTE.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => onAdd(item.type)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-left text-sm hover:bg-[var(--color-hover)]"
          >
            {t(item.label)}
          </button>
        ))}
      </div>
    </div>
  )
}
