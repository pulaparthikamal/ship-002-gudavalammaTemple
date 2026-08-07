import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { z } from 'zod'
import { FormInputText } from '@/components/forms/FormInputText'
import { useForgotPasswordMutation } from '@/features/auth/services/authApi'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import { getClientDeviceInfo } from '@/utils/deviceInfo'

export function DevoteeForgotPasswordForm() {
  const { showToast } = useToast()
  const { t } = useDevoteeLanguage()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [forgotPassword, { error, isLoading }] = useForgotPasswordMutation()

  const forgotPasswordSchema = useMemo(
    () => z.object({ email: z.string().trim().email(t('errorInvalidEmail')) }),
    [t],
  )

  type DevoteeForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<DevoteeForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  })

  const formError = getApiErrorMessage(error, '')

  const onSubmit = async (values: DevoteeForgotPasswordFormValues) => {
    setSuccessMessage(null)

    try {
      const response = await forgotPassword({
        email: values.email.trim(),
        entityType: 'user',
        deviceInfo: getClientDeviceInfo(),
      }).unwrap()
      const message = response.respMessage ?? response.message ?? t('forgotDefaultSuccessMessage')

      setSuccessMessage(message)
      showToast({ severity: 'success', summary: t('forgotResetSentTitle'), detail: message })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: t('forgotRequestFailedTitle'),
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {successMessage ? <Message severity="success" text={successMessage} className="w-full justify-start" /> : null}
      {formError ? <Message severity="error" text={formError} className="w-full justify-start" /> : null}

      <FormInputText control={control} name="email" label={t('emailLabel')} placeholder={t('emailPlaceholder')} autoComplete="email" />

      <Button
        type="submit"
        label={isLoading || isSubmitting ? t('forgotSending') : t('forgotSendButton')}
        icon="pi pi-send"
        iconPos="right"
        loading={isLoading || isSubmitting}
        className="w-full justify-center"
      />

      <div className="text-center">
        <Link to="/devotee/login" className="text-sm font-medium">
          {t('forgotBackToSignIn')}
        </Link>
      </div>
    </form>
  )
}
