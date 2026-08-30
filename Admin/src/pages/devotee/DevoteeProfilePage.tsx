import { useEffect, useMemo } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from 'primereact/button'
import { z } from 'zod'
import { FormInputText } from '@/components/forms/FormInputText'
import { selectCurrentUser, selectLoginData, updateProfile } from '@/features/auth/authSlice'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useToast } from '@/hooks/useToast'
import { useUpdateOwnProfileMutation } from '@/services/api/endpoints/usersApi'

export function DevoteeProfilePage() {
  const { t } = useDevoteeTranslation()
  const dispatch = useAppDispatch()
  const { showToast } = useToast()
  const user = useAppSelector(selectCurrentUser)
  const loginData = useAppSelector(selectLoginData)
  const [updateOwnProfile, { isLoading: isSaving }] = useUpdateOwnProfileMutation()

  const profileSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t('devotee.errorFirstNameMin')),
        email: z.string().trim().email(t('devotee.errorInvalidEmail')),
        phone: z.string().trim().optional(),
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
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: loginData?.phone ?? '' },
    mode: 'onBlur',
  })

  useEffect(() => {
    reset({ name: user?.name ?? '', email: user?.email ?? '', phone: loginData?.phone ?? '' })
  }, [reset, user?.email, user?.name, loginData?.phone])

  const onSubmit = async (values: DevoteeProfileFormValues) => {
    const [firstName, ...rest] = values.name.trim().split(' ')
    const lastName = rest.join(' ') || firstName

    try {
      await updateOwnProfile({
        firstName,
        lastName,
        email: values.email,
        phone: values.phone,
      }).unwrap()

      dispatch(updateProfile({ name: values.name, email: values.email, phone: values.phone }))
      showToast({ severity: 'success', summary: t('devotee.profileTitle'), detail: t('devotee.profileSavedToast') })
      reset(values)
    } catch {
      showToast({ severity: 'error', summary: t('devotee.profileTitle'), detail: t('devotee.requestFailed') })
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('devotee.profileTitle')}</h1>
        <p>{t('devotee.profileSubtitle')}</p>
      </div>

      <div className="dp-panel" style={{ maxWidth: 520, marginTop: 20 }}>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormInputText control={control} name="name" label={t('devotee.profileNameLabel')} autoComplete="name" />
          <FormInputText control={control} name="email" label={t('devotee.profileEmailLabel')} autoComplete="email" />
          <FormInputText control={control} name="phone" label={t('devotee.profilePhoneLabel')} autoComplete="tel" />

          <Button
            type="submit"
            label={t('devotee.profileSaveButton')}
            icon="pi pi-check"
            disabled={!isDirty}
            loading={isSubmitting || isSaving}
          />
        </form>
      </div>
    </div>
  )
}
