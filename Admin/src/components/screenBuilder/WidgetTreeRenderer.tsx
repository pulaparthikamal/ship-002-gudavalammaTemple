import { WidgetRenderer } from './widgetRenderers'
import type { Widget } from '@/types/pageContent'

const GRID_COLS = 12
const ROW_HEIGHT_PX = 60

interface WidgetTreeRendererProps {
  widgets: Widget[]
}

/**
 * Renders a widget tree in a static 12-column CSS grid using each widget's
 * x/y/w/h units — the same grid unit convention the drag-and-drop builder
 * (react-grid-layout, cols=12) uses, so a published layout renders
 * identically here as it did on the builder canvas.
 */
export function WidgetTreeRenderer({ widgets }: WidgetTreeRendererProps) {
  if (!widgets.length) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        gridAutoRows: `${ROW_HEIGHT_PX}px`,
        gap: 12,
        width: '100%',
        marginBottom: 20,
      }}
    >
      {widgets.map((widget) => (
        <div
          key={widget.id}
          style={{
            gridColumn: `${widget.x + 1} / span ${widget.w}`,
            gridRow: `${widget.y + 1} / span ${widget.h}`,
            overflow: 'hidden',
          }}
        >
          <WidgetRenderer widget={widget} />
        </div>
      ))}
    </div>
  )
}
