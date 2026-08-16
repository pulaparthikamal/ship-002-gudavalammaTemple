import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { z } from 'zod'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormPassword } from '@/components/forms/FormPassword'
import { useRegisterMutation } from '@/features/auth/services/authApi'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'

export function DevoteeRegisterForm() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { t } = useDevoteeTranslation()
  const [register, { error, isLoading }] = useRegisterMutation()

  const registerSchema = useMemo(
    () =>
      z
        .object({
          firstName: z.string().trim().min(2, t('devotee.errorFirstNameMin')),
          lastName: z.string().trim().min(2, t('devotee.errorLastNameMin')),
          email: z.string().trim().email(t('devotee.errorInvalidEmail')),
          phone: z
            .string()
            .trim()
            .refine((value) => value.length === 0 || value.length >= 8, t('devotee.errorPhoneMin')),
          password: z.string().min(8, t('devotee.errorPasswordMin')),
          confirmPassword: z.string().min(8, t('devotee.errorPasswordMin')),
        })
        .superRefine((values, context) => {
          if (values.password !== values.confirmPassword) {
            context.addIssue({ code: 'custom', path: ['confirmPassword'], message: t('devotee.errorConfirmMismatch') })
          }
        }),
    [t],
  )

  type DevoteeRegisterFormValues = z.infer<typeof registerSchema>

  const defaultValues: DevoteeRegisterFormValues = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  }

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<DevoteeRegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues,
    mode: 'onBlur',
  })

  const formError = getApiErrorMessage(error, '')

  const onSubmit = async (values: DevoteeRegisterFormValues) => {
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
        summary: response.respMessage ?? response.message ?? t('devotee.registerSuccessTitle'),
        detail: t('devotee.registerSuccessDetail'),
      })
      navigate('/devotee/login', { replace: true })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: t('devotee.registerFailedTitle'),
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? <Message severity="error" text={formError} className="w-full justify-start" style={{ marginBottom: '0.75rem' }} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormInputText control={control} name="firstName" label={t('devotee.firstNameLabel')} placeholder={t('devotee.firstNamePlaceholder')} />
        <FormInputText control={control} name="lastName" label={t('devotee.lastNameLabel')} placeholder={t('devotee.lastNamePlaceholder')} />
      </div>

      <FormInputText control={control} name="email" label={t('devotee.emailLabel')} placeholder={t('devotee.emailPlaceholder')} autoComplete="email" />

      <FormInputText
        control={control}
        name="phone"
        label={t('devotee.phoneLabel')}
        placeholder={t('devotee.phonePlaceholder')}
        autoComplete="tel"
        helperText={t('devotee.phoneHelper')}
      />

      <FormPassword control={control} name="password" label={t('devotee.passwordLabel')} placeholder={t('devotee.passwordPlaceholder')} autoComplete="new-password" />

      <FormPassword
        control={control}
        name="confirmPassword"
        label={t('devotee.confirmPasswordLabel')}
        placeholder={t('devotee.confirmPasswordPlaceholder')}
        autoComplete="new-password"
      />

      <Button
        type="submit"
        label={isLoading || isSubmitting ? t('devotee.creatingAccount') : t('devotee.createAccountButton')}
        icon="pi pi-user-plus"
        iconPos="right"
        loading={isLoading || isSubmitting}
        className="w-full justify-center"
      />

      <div className="text-center">
        <span className="text-sm">{t('devotee.alreadyHaveAccount')} </span>
        <Link to="/devotee/login" className="text-sm font-medium">
          {t('devotee.signInLink')}
        </Link>
      </div>
    </form>
  )
}
