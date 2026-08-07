import { Link } from 'react-router-dom'
import { AuthShell } from '@/components/ui/AuthShell'
import { LoginForm } from '@/features/auth/components/LoginForm'

export function LoginPage() {
  return (
    <AuthShell title="Sign in" description="Use your account credentials." cardClassName="max-w-sm">
      <LoginForm />
      <div className="mt-5 text-center">
        <span className="text-sm text-[var(--color-text-muted)]">New here? </span>
        <Link to="/register" className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
          Create account
        </Link>
      </div>
    </AuthShell>
  )
}
