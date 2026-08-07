import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormPassword } from '@/components/forms/FormPassword'
import { useToast } from '@/hooks/useToast'
import { registerSchema } from '@/schemas/authSchema'
import type { RegisterFormValues } from '@/schemas/authSchema'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useRegisterMutation } from '../services/authApi'

const defaultValues: RegisterFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
}

export function RegisterForm() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [register, { error, isLoading }] = useRegisterMutation()
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues,
    mode: 'onBlur',
  })

  const formError = getApiErrorMessage(error, '')

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const response = await register({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        password: values.password,
      }).unwrap()

      showToast({
        severity: 'success',
        summary: response.respMessage ?? response.message ?? 'Registration successful',
        detail: 'Your account has been created.',
      })
      navigate('/login', { replace: true })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: 'Registration failed',
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? <Message severity="error" text={formError} className="w-full justify-start" /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormInputText
          control={control}
          name="firstName"
          label="First name"
          placeholder="First name"
        />
        <FormInputText
          control={control}
          name="lastName"
          label="Last name"
          placeholder="Last name"
        />
      </div>

      <FormInputText
        control={control}
        name="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
      />

      <FormInputText
        control={control}
        name="phone"
        label="Phone"
        placeholder="+1234567890"
        autoComplete="tel"
        helperText="Optional"
      />

      <FormPassword
        control={control}
        name="password"
        label="Password"
        placeholder="Create a password"
        autoComplete="new-password"
      />

      <FormPassword
        control={control}
        name="confirmPassword"
        label="Confirm password"
        placeholder="Re-enter password"
        autoComplete="new-password"
      />

      <Button
        type="submit"
        label="Create account"
        icon="pi pi-user-plus"
        iconPos="right"
        loading={isLoading || isSubmitting}
        className="w-full justify-center"
      />

      <div className="text-center">
        <span className="text-sm text-[var(--color-text-muted)]">Already have an account? </span>
        <Link to="/login" className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
          Sign in
        </Link>
      </div>
    </form>
  )
}
