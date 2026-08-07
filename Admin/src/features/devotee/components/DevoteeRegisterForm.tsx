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
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'

export function DevoteeRegisterForm() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { t } = useDevoteeLanguage()
  const [register, { error, isLoading }] = useRegisterMutation()

  const registerSchema = useMemo(
    () =>
      z
        .object({
          firstName: z.string().trim().min(2, t('errorFirstNameMin')),
          lastName: z.string().trim().min(2, t('errorLastNameMin')),
          email: z.string().trim().email(t('errorInvalidEmail')),
          phone: z
            .string()
            .trim()
            .refine((value) => value.length === 0 || value.length >= 8, t('errorPhoneMin')),
          password: z.string().min(8, t('errorPasswordMin')),
          confirmPassword: z.string().min(8, t('errorPasswordMin')),
        })
        .superRefine((values, context) => {
          if (values.password !== values.confirmPassword) {
            context.addIssue({ code: 'custom', path: ['confirmPassword'], message: t('errorConfirmMismatch') })
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
        summary: response.respMessage ?? response.message ?? t('registerSuccessTitle'),
        detail: t('registerSuccessDetail'),
      })
      navigate('/devotee/login', { replace: true })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: t('registerFailedTitle'),
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? <Message severity="error" text={formError} className="w-full justify-start" style={{ marginBottom: '0.75rem' }} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormInputText control={control} name="firstName" label={t('firstNameLabel')} placeholder={t('firstNamePlaceholder')} />
        <FormInputText control={control} name="lastName" label={t('lastNameLabel')} placeholder={t('lastNamePlaceholder')} />
      </div>

      <FormInputText control={control} name="email" label={t('emailLabel')} placeholder={t('emailPlaceholder')} autoComplete="email" />

      <FormInputText
        control={control}
        name="phone"
        label={t('phoneLabel')}
        placeholder={t('phonePlaceholder')}
        autoComplete="tel"
        helperText={t('phoneHelper')}
      />

      <FormPassword control={control} name="password" label={t('passwordLabel')} placeholder={t('passwordPlaceholder')} autoComplete="new-password" />

      <FormPassword
        control={control}
        name="confirmPassword"
        label={t('confirmPasswordLabel')}
        placeholder={t('confirmPasswordPlaceholder')}
        autoComplete="new-password"
      />

      <Button
        type="submit"
        label={isLoading || isSubmitting ? t('creatingAccount') : t('createAccountButton')}
        icon="pi pi-user-plus"
        iconPos="right"
        loading={isLoading || isSubmitting}
        className="w-full justify-center"
      />

      <div className="text-center">
        <span className="text-sm">{t('alreadyHaveAccount')} </span>
        <Link to="/devotee/login" className="text-sm font-medium">
          {t('signInLink')}
        </Link>
      </div>
    </form>
  )
}
