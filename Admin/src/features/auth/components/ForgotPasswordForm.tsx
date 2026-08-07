import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { FormInputText } from '@/components/forms/FormInputText'
import { useToast } from '@/hooks/useToast'
import { forgotPasswordSchema } from '@/schemas/authSchema'
import type { ForgotPasswordFormValues } from '@/schemas/authSchema'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useForgotPasswordMutation } from '../services/authApi'
import { getClientDeviceInfo } from '@/utils/deviceInfo'

const defaultValues: ForgotPasswordFormValues = {
  email: '',
}

export function ForgotPasswordForm() {
  const { showToast } = useToast()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [forgotPassword, { error, isLoading }] = useForgotPasswordMutation()
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues,
    mode: 'onBlur',
  })

  const formError = getApiErrorMessage(error, '')

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setSuccessMessage(null)

    try {
      const response = await forgotPassword({
        email: values.email.trim(),
        entityType: 'user',
        deviceInfo: getClientDeviceInfo(),
      }).unwrap()
      const message =
        response.respMessage ??
        response.message ??
        'If the email exists, a password reset link has been sent.'

      setSuccessMessage(message)
      showToast({
        severity: 'success',
        summary: 'Reset link requested',
        detail: message,
      })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: 'Request failed',
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {successMessage ? (
        <Message severity="success" text={successMessage} className="w-full justify-start" />
      ) : null}
      {formError ? <Message severity="error" text={formError} className="w-full justify-start" /> : null}

      <FormInputText
        control={control}
        name="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
      />

      <Button
        type="submit"
        label="Send reset link"
        icon="pi pi-send"
        iconPos="right"
        loading={isLoading || isSubmitting}
        className="w-full justify-center"
      />

      <div className="text-center">
        <Link to="/login" className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
          Back to sign in
        </Link>
      </div>
    </form>
  )
}
