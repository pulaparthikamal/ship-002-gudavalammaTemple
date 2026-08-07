import { LayoutGrid, List } from 'lucide-react'
import { Button } from 'primereact/button'
import type { CrudViewMode } from '@/types/crud'

interface CrudViewToggleProps {
  value: CrudViewMode
  onChange: (mode: CrudViewMode) => void
}

export function CrudViewToggle({ value, onChange }: CrudViewToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        title="List view"
        icon={<List className="h-4 w-4" aria-hidden="true" />}
        severity={value === 'list' ? undefined : 'secondary'}
        outlined={value !== 'list'}
        aria-label="List view"
        aria-pressed={value === 'list'}
        className="h-8 w-8 p-0"
        onClick={() => onChange('list')}
      />
      <Button
        type="button"
        title="Grid view"
        icon={<LayoutGrid className="h-4 w-4" aria-hidden="true" />}
        severity={value === 'grid' ? undefined : 'secondary'}
        outlined={value !== 'grid'}
        aria-label="Grid view"
        aria-pressed={value === 'grid'}
        className="h-8 w-8 p-0"
        onClick={() => onChange('grid')}
      />
    </div>
  )
}
