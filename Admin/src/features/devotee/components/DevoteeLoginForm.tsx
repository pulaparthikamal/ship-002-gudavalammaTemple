import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { z } from 'zod'
import { FormCheckbox } from '@/components/forms/FormCheckbox'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormPassword } from '@/components/forms/FormPassword'
import { clearAuthError, selectAuthError, setCredentials } from '@/features/auth/authSlice'
import { useLoginMutation, useRequestOtpMutation, useVerifyOtpMutation } from '@/features/auth/services/authApi'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import { toAuthSession } from '@/utils/authSession'

type LoginLocationState = {
  from?: Location
  reason?: string
}

type LoginMode = 'password' | 'otp'
type PasswordIdentifier = 'email' | 'phone'

const REMEMBERED_EMAIL_KEY = 'devotee:rememberedEmail'
const REMEMBERED_CREDENTIALS_KEY = 'devotee:rememberedCredentials'
const OTP_RESEND_COOLDOWN_SECONDS = 60

interface PasswordFormValues {
  identifier: string
  password: string
  rememberMe: boolean
}

function readRememberedCredentials() {
  if (typeof window === 'undefined') {
    return { identifier: '', password: '' }
  }

  try {
    const rememberedCredentials = window.localStorage.getItem(REMEMBERED_CREDENTIALS_KEY)

    if (rememberedCredentials) {
      const parsedValue = JSON.parse(rememberedCredentials) as { email?: unknown; password?: unknown }

      return {
        identifier: typeof parsedValue.email === 'string' ? parsedValue.email : '',
        password: typeof parsedValue.password === 'string' ? parsedValue.password : '',
      }
    }

    return {
      identifier: window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '',
      password: '',
    }
  } catch {
    return { identifier: '', password: '' }
  }
}

function applyRememberMePreference(values: PasswordFormValues) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (values.rememberMe) {
      window.localStorage.setItem(
        REMEMBERED_CREDENTIALS_KEY,
        JSON.stringify({ email: values.identifier.trim(), password: values.password }),
      )
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, values.identifier.trim())
      return
    }

    window.localStorage.removeItem(REMEMBERED_CREDENTIALS_KEY)
    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  } catch {
    // Remember me is a convenience only; login should not fail if storage is unavailable.
  }
}

function getPasswordDefaultValues(): PasswordFormValues {
  const rememberedCredentials = readRememberedCredentials()

  return {
    identifier: rememberedCredentials.identifier,
    password: rememberedCredentials.password,
    rememberMe: Boolean(rememberedCredentials.identifier || rememberedCredentials.password),
  }
}

export function DevoteeLoginForm() {
  const dispatch = useAppDispatch()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const authError = useAppSelector(selectAuthError)
  const [login, { error, isLoading: isLoggingIn }] = useLoginMutation()
  const [requestOtp, { isLoading: isSendingOtp }] = useRequestOtpMutation()
  const [verifyOtp, { isLoading: isVerifyingOtp }] = useVerifyOtpMutation()
  const { t } = useDevoteeTranslation()

  const [mode, setMode] = useState<LoginMode>('password')
  const [identifierType, setIdentifierType] = useState<PasswordIdentifier>('email')

  // OTP-mode local state — a multi-step async flow (request code, then
  // verify) doesn't map cleanly onto a single react-hook-form instance.
  const [otpPhone, setOtpPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const passwordSchema = useMemo(
    () =>
      z.object({
        identifier:
          identifierType === 'email'
            ? z.string().trim().email(t('devotee.errorInvalidEmail'))
            : z.string().trim().min(8, t('devotee.errorInvalidMobile')),
        password: z.string().min(8, t('devotee.errorPasswordMin')),
        rememberMe: z.boolean(),
      }),
    [t, identifierType],
  )

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: getPasswordDefaultValues(),
    mode: 'onBlur',
  })

  const locationState = location.state as LoginLocationState | null
  const redirectTo = locationState?.from?.pathname ?? '/devotee/dashboard'
  const formError = authError ?? getApiErrorMessage(error, '')

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    dispatch(clearAuthError())

    try {
      const credentials =
        identifierType === 'email'
          ? { email: values.identifier.trim(), password: values.password }
          : { phone: values.identifier.trim(), password: values.password }
      const response = await login(credentials).unwrap()

      applyRememberMePreference(values)
      dispatch(setCredentials(toAuthSession(response, 'devotee')))
      showToast({
        severity: 'success',
        summary: response.respMessage ?? t('devotee.loginSuccessTitle'),
        detail: t('devotee.loginSuccessDetail'),
      })
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: t('devotee.loginFailedTitle'),
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  const handleSendOtp = async () => {
    setOtpError('')
    if (otpPhone.trim().length < 8) {
      setOtpError(t('devotee.errorInvalidMobile'))
      return
    }

    try {
      await requestOtp({ phone: otpPhone.trim() }).unwrap()
      setOtpSent(true)
      setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS)
      showToast({ severity: 'success', summary: t('devotee.otpSentTo', { phone: otpPhone.trim() }) })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: t('devotee.loginFailedTitle'),
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  const handleVerifyOtp = async () => {
    setOtpError('')
    if (otpCode.trim().length !== 6) {
      setOtpError(t('devotee.errorOtpRequired'))
      return
    }

    try {
      const response = await verifyOtp({ phone: otpPhone.trim(), otp: otpCode.trim() }).unwrap()
      dispatch(setCredentials(toAuthSession(response, 'devotee')))
      showToast({
        severity: 'success',
        summary: response.respMessage ?? t('devotee.loginSuccessTitle'),
        detail: t('devotee.loginSuccessDetail'),
      })
      navigate(redirectTo, { replace: true })
    } catch (submitError) {
      showToast({
        severity: 'error',
        summary: t('devotee.loginFailedTitle'),
        detail: getApiErrorMessage(submitError),
      })
    }
  }

  return (
    <div className="space-y-3">
      <div className="dp-login-mode-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'password'}
          className={`dp-mode-tab ${mode === 'password' ? 'active' : ''}`}
          onClick={() => setMode('password')}
        >
          {t('devotee.loginModePassword')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'otp'}
          className={`dp-mode-tab ${mode === 'otp' ? 'active' : ''}`}
          onClick={() => setMode('otp')}
        >
          {t('devotee.loginModeOtp')}
        </button>
      </div>

      {mode === 'password' ? (
        <form className="space-y-3" onSubmit={handleSubmit(onPasswordSubmit)} noValidate>
          {formError ? <Message severity="error" text={formError} className="w-full justify-start" style={{ marginBottom: '0.75rem' }} /> : null}

          <div className="dp-login-mode-toggle" style={{ marginBottom: 4 }} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={identifierType === 'email'}
              className={`dp-mode-tab ${identifierType === 'email' ? 'active' : ''}`}
              onClick={() => setIdentifierType('email')}
            >
              {t('devotee.loginIdentifierEmail')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={identifierType === 'phone'}
              className={`dp-mode-tab ${identifierType === 'phone' ? 'active' : ''}`}
              onClick={() => setIdentifierType('phone')}
            >
              {t('devotee.loginIdentifierMobile')}
            </button>
          </div>

          <FormInputText
            control={control}
            name="identifier"
            label={identifierType === 'email' ? t('devotee.loginEmailLabel') : t('devotee.loginMobileLabel')}
            placeholder={identifierType === 'email' ? t('devotee.loginEmailPlaceholder') : t('devotee.loginMobilePlaceholder')}
            autoComplete={identifierType === 'email' ? 'email' : 'tel'}
          />
          <FormPassword
            control={control}
            name="password"
            label={t('devotee.loginPasswordLabel')}
            placeholder={t('devotee.loginPasswordPlaceholder')}
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between gap-4">
            <FormCheckbox control={control} name="rememberMe" label={t('devotee.loginRememberMe')} compact />
            <Link to="/devotee/forgot-password" className="text-sm font-medium">
              {t('devotee.loginForgotPassword')}
            </Link>
          </div>

          <Button
            type="submit"
            label={isLoggingIn || isSubmitting ? t('devotee.loginSigningIn') : t('devotee.loginSignIn')}
            icon="pi pi-arrow-right"
            iconPos="right"
            loading={isLoggingIn || isSubmitting}
            className="w-full justify-center"
          />
        </form>
      ) : (
        <div className="space-y-3">
          {otpError ? <Message severity="error" text={otpError} className="w-full justify-start" /> : null}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]">
              {t('devotee.loginMobileLabel')}
            </label>
            <InputText
              value={otpPhone}
              onChange={(event) => setOtpPhone(event.target.value)}
              placeholder={t('devotee.loginMobilePlaceholder')}
              disabled={otpSent}
              autoComplete="tel"
            />
          </div>

          {!otpSent ? (
            <Button
              type="button"
              label={isSendingOtp ? t('devotee.otpSending') : t('devotee.otpSendCode')}
              icon="pi pi-arrow-right"
              iconPos="right"
              loading={isSendingOtp}
              className="w-full justify-center"
              onClick={() => void handleSendOtp()}
            />
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--dp-ink-soft)' }}>{t('devotee.otpSentTo', { phone: otpPhone.trim() })}</p>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold leading-5 text-[var(--color-text-strong)]">
                  {t('devotee.otpLabel')}
                </label>
                <InputText
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('devotee.otpPlaceholder')}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>

              <Button
                type="button"
                label={isVerifyingOtp ? t('devotee.otpVerifying') : t('devotee.otpVerify')}
                icon="pi pi-arrow-right"
                iconPos="right"
                loading={isVerifyingOtp}
                className="w-full justify-center"
                onClick={() => void handleVerifyOtp()}
              />

              <div className="flex items-center justify-between gap-4 text-sm">
                <button
                  type="button"
                  className="font-medium"
                  onClick={() => {
                    setOtpSent(false)
                    setOtpCode('')
                    setOtpError('')
                  }}
                >
                  {t('devotee.otpChangeNumber')}
                </button>
                <button
                  type="button"
                  className="font-medium"
                  disabled={resendCooldown > 0}
                  onClick={() => void handleSendOtp()}
                >
                  {resendCooldown > 0 ? t('devotee.otpResendIn', { seconds: resendCooldown }) : t('devotee.otpResend')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
