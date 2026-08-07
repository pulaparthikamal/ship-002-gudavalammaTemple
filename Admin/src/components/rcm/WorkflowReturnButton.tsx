import { ArrowLeft } from 'lucide-react'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import type { WorkflowContext } from '@/types/rcmWorkflow'

type WorkflowReturnButtonProps = {
  context: WorkflowContext
}

export function WorkflowReturnButton({ context }: WorkflowReturnButtonProps) {
  const navigate = useNavigate()
  const returnTo = context.returnTo ?? (context.dashboardQueue ? '/rcm/dashboard' : undefined)
  const returnLabel = context.returnLabel ?? (context.dashboardQueue ? 'Back to Dashboard' : 'Back')

  if (!returnTo) {
    return null
  }

  return (
    <Button
      type="button"
      label={returnLabel}
      icon={<ArrowLeft className="h-3.5 w-3.5" />}
      className="rcm-navigation-button h-8 w-fit px-3 text-xs font-semibold"
      outlined
      onClick={() => navigate(returnTo)}
    />
  )
}
