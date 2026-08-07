import { AuthShell } from '@/components/ui/AuthShell'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

export function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot password"
      description="Enter your email to request a reset link."
      cardClassName="max-w-sm"
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
