import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from 'primereact/button'
import { z } from 'zod'
import { FormInputText } from '@/components/forms/FormInputText'
import { selectCurrentUser, selectLoginData, updateProfile } from '@/features/auth/authSlice'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useToast } from '@/hooks/useToast'

export function DevoteeProfilePage() {
  const { t } = useDevoteeLanguage()
  const dispatch = useAppDispatch()
  const { showToast } = useToast()
  const user = useAppSelector(selectCurrentUser)
  const loginData = useAppSelector(selectLoginData)

  const profileSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t('errorFirstNameMin')),
        email: z.string().trim().email(t('errorInvalidEmail')),
      }),
    [t],
  )

  type DevoteeProfileFormValues = z.infer<typeof profileSchema>

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<DevoteeProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
    mode: 'onBlur',
  })

  useEffect(() => {
    reset({ name: user?.name ?? '', email: user?.email ?? '' })
  }, [reset, user?.email, user?.name])

  const onSubmit = (values: DevoteeProfileFormValues) => {
    dispatch(updateProfile(values))
    showToast({ severity: 'success', summary: t('profileTitle'), detail: t('profileSavedToast') })
    reset(values)
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('profileTitle')}</h1>
        <p>{t('profileSubtitle')}</p>
      </div>

      <div className="dp-panel" style={{ maxWidth: 520, marginTop: 20 }}>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormInputText control={control} name="name" label={t('profileNameLabel')} autoComplete="name" />
          <FormInputText control={control} name="email" label={t('profileEmailLabel')} autoComplete="email" />

          <div>
            <label style={{ display: 'block', marginBottom: 6 }}>{t('profilePhoneLabel')}</label>
            <p style={{ margin: 0, color: 'var(--dp-ink)', fontSize: 14 }}>{loginData?.phone ?? '—'}</p>
          </div>

          <Button type="submit" label={t('profileSaveButton')} icon="pi pi-check" disabled={!isDirty} loading={isSubmitting} />
        </form>
      </div>
    </div>
  )
}
