import { AuthShell } from '@/components/ui/AuthShell'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export function RegisterPage() {
  return (
    <AuthShell
      title="Create account"
      description="Enter your details to get started."
      cardClassName="max-w-md"
    >
      <RegisterForm />
    </AuthShell>
  )
}
