import GridLayout, { WidthProvider } from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { X } from 'lucide-react'
import { WidgetRenderer } from './widgetRenderers'
import { useStaffTranslation } from '@/i18n/useTranslation'
import type { Widget } from '@/types/pageContent'

const GridLayoutWithWidth = WidthProvider(GridLayout)

interface BuilderCanvasProps {
  widgets: Widget[]
  selectedId: string | null
  onSelect: (id: string) => void
  onLayoutChange: (layout: Layout[]) => void
  onRemove: (id: string) => void
}

export function BuilderCanvas({ widgets, selectedId, onSelect, onLayoutChange, onRemove }: BuilderCanvasProps) {
  const { t } = useStaffTranslation()
  const layout: Layout[] = widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h }))

  return (
    <div className="devotee-portal" style={{ borderRadius: 12, padding: 16, minHeight: 400 }}>
      <GridLayoutWithWidth
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={60}
        margin={[12, 12]}
        onLayoutChange={onLayoutChange}
        compactType={null}
        preventCollision={false}
      >
        {widgets.map((widget) => (
          <div
            key={widget.id}
            onClick={() => onSelect(widget.id)}
            style={{
              border: selectedId === widget.id ? '2px solid var(--dp-maroon)' : '1px dashed var(--dp-line-strong)',
              borderRadius: 10,
              background: 'var(--dp-panel)',
              overflow: 'hidden',
              position: 'relative',
              cursor: 'pointer',
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(widget.id)
              }}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                zIndex: 10,
                background: 'rgba(43,23,16,0.6)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label={t('Remove widget')}
            >
              <X size={12} />
            </button>
            <div style={{ padding: 8, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <WidgetRenderer widget={widget} />
            </div>
          </div>
        ))}
      </GridLayoutWithWidth>
    </div>
  )
}
