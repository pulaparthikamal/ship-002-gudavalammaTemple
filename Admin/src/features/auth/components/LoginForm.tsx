import { useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { z } from 'zod'
import { FormCheckbox } from '@/components/forms/FormCheckbox'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormPassword } from '@/components/forms/FormPassword'
import { clearAuthError, selectAuthError, setCredentials } from '@/features/auth/authSlice'
import { useLoginMutation } from '@/features/auth/services/authApi'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useToast } from '@/hooks/useToast'
import type { LoginFormValues } from '@/schemas/authSchema'
import { getApiErrorMessage } from '@/services/api/apiError'
import { toAuthSession } from '@/utils/authSession'

type LoginLocationState = {
  from?: Location
  reason?: string
}

const defaultValues: LoginFormValues = {
  email: '',
  password: '',
  rememberMe: false,
}

const REMEMBERED_EMAIL_KEY = 'auth:rememberedEmail'
const REMEMBERED_CREDENTIALS_KEY = 'auth:rememberedCredentials'

function readRememberedCredentials() {
  if (typeof window === 'undefined') {
    return {
      email: '',
      password: '',
    }
  }

  try {
    const rememberedCredentials = window.localStorage.getItem(REMEMBERED_CREDENTIALS_KEY)

    if (rememberedCredentials) {
      const parsedValue = JSON.parse(rememberedCredentials) as {
        email?: unknown
        password?: unknown
      }

      return {
        email: typeof parsedValue.email === 'string' ? parsedValue.email : '',
        password: typeof parsedValue.password === 'string' ? parsedValue.password : '',
      }
    }

    return {
      email: window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '',
      password: '',
    }
  } catch {
    return {
      email: '',
      password: '',
    }
  }
}

function applyRememberMePreference(values: LoginFormValues) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (values.rememberMe) {
      window.localStorage.setItem(
        REMEMBERED_CREDENTIALS_KEY,
        JSON.stringify({
          email: values.email.trim(),
          password: values.password,
        }),
      )
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, values.email.trim())
      return
    }

    window.localStorage.removeItem(REMEMBERED_CREDENTIALS_KEY)
    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  } catch {
    // Remember me is a convenience only; login should not fail if storage is unavailable.
  }
}

function getLoginDefaultValues(): LoginFormValues {
  const rememberedCredentials = readRememberedCredentials()

  return {
    ...defaultValues,
    email: rememberedCredentials.email,
    password: rememberedCredentials.password,
    rememberMe: Boolean(rememberedCredentials.email || rememberedCredentials.password),
  }
}

export function LoginForm() {
  const dispatch = useAppDispatch()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const authError = useAppSelector(selectAuthError)
  const [login, { error, isLoading }] = useLoginMutation()
  const { t } = useStaffTranslation()
  const localizedLoginSchema = useMemo(
    () =>
      z.object({
        email: z.string().trim().email(t('login.errorInvalidEmail')),
        password: z.string().min(8, t('login.errorPasswordMin')),
        rememberMe: z.boolean(),
      }),
    [t],
  )
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(localizedLoginSchema),
    defaultValues: getLoginDefaultValues(),
    mode: 'onBlur',
  })

  const locationState = location.state as LoginLocationState | null
  const redirectTo = locationState?.from?.pathname ?? '/dashboard'
  const formError = authError ?? getApiErrorMessage(error, '')

  const onSubmit = async (values: LoginFormValues) => {
    dispatch(clearAuthError())

    try {
      const response = await login(values).unwrap()

      applyRememberMePreference(values)
      dispatch(setCredentials(toAuthSession(response, 'staff')))
      showToast({
        severity: 'success',
        summary: response.respMessage ?? t('login.loginSuccessTitle'),
        detail: t('login.loginSuccessDetail'),
      })
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: t('login.loginFailedTitle'),
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError ? <Message severity="error" text={formError} className="w-full justify-start" style={{marginBottom: '0.75rem'}} /> : null}

      <FormInputText
        control={control}
        name="email"
        label={t('login.emailLabel')}
        placeholder={t('login.emailPlaceholder')}
        autoComplete="email"
      />
      <FormPassword
        control={control}
        name="password"
        label={t('login.passwordLabel')}
        placeholder={t('login.passwordPlaceholder')}
        autoComplete="current-password"
      />

      <div className="flex items-center justify-between gap-4">
        <FormCheckbox
          control={control}
          name="rememberMe"
          label={t('login.rememberMe')}
          compact
        />
        <Link to="/forgot-password" className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
          {t('login.forgotPassword')}
        </Link>
      </div>

      <Button
        type="submit"
        label={isLoading || isSubmitting ? t('login.signingIn') : t('login.signIn')}
        icon="pi pi-arrow-right"
        iconPos="right"
        loading={isLoading || isSubmitting}
        className="w-full justify-center"
      />
    </form>
  )
}
