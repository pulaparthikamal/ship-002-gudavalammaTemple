import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { FormInputText } from '@/components/forms/FormInputText'
import { PageHeader } from '@/components/ui/PageHeader'
import { selectCurrentUser, selectLoginData, updateProfile } from '@/features/auth/authSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { profileSchema } from '@/schemas/profileSchema'
import type { ProfileFormValues } from '@/schemas/profileSchema'
import { getPrimaryRole, getUserInitials } from '@/utils/userDisplay'

export function ProfilePage() {
  const { t } = useStaffTranslation()
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectCurrentUser)
  const loginData = useAppSelector(selectLoginData)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
    },
    mode: 'onBlur',
  })

  useEffect(() => {
    reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
    })
  }, [reset, user?.email, user?.name])

  const onSubmit = (values: ProfileFormValues) => {
    dispatch(updateProfile(values))
    setSuccessMessage(t('Profile updated successfully.'))
    reset(values)
  }

  const profileRows = [
    [t('User ID'), loginData?._id ?? user?.id ?? '-'],
    [t('Phone'), loginData?.phone ?? '-'],
    [t('Role'), getPrimaryRole(user)],
    [t('Status'), loginData?.isActive === false ? t('Inactive') : t('Active')],
    [t('Email verification'), loginData?.isEmailVerified ? t('Verified') : t('Pending')],
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow={t('Profile')}
        title={t('My profile')}
        description={t('Review your account details and update the profile used in this session.')}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
        <aside className="space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="text-center">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-lg bg-[var(--color-primary)] text-3xl font-semibold text-white">
              {getUserInitials(user)}
            </div>
            <h2 className="mt-4 truncate text-xl font-semibold text-[var(--color-text-strong)]">
              {user?.name ?? t('Signed in')}
            </h2>
            <p className="mt-1 break-all text-sm text-[var(--color-text-muted)]">
              {user?.email ?? t('No email available')}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="inline-flex rounded-lg bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-medium text-[var(--color-primary)]">
                {getPrimaryRole(user)}
              </span>
              <span
                className={
                  loginData?.isEmailVerified
                    ? 'inline-flex rounded-lg bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-medium text-[var(--color-primary)]'
                    : 'inline-flex rounded-lg bg-[var(--color-surface-muted)] px-3 py-1 text-sm font-medium text-[var(--color-text-muted)]'
                }
              >
                {loginData?.isEmailVerified ? t('Verified') : t('Pending verification')}
              </span>
            </div>
          </div>

          <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            {profileRows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
              >
                <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
                  {label}
                </dt>
                <dd className="break-words text-sm font-semibold text-[var(--color-text-strong)]">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <div className="border-b border-[var(--color-border)] pb-5">
            <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">{t('Edit profile')}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('These details are used for the current signed-in session.')}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            {successMessage ? (
              <Message severity="success" text={successMessage} className="w-full justify-start" />
            ) : null}

            <div className="grid gap-5 pt-6 md:grid-cols-2">
              <FormInputText
                control={control}
                name="name"
                label={t('Name')}
                placeholder={t('Your name')}
                autoComplete="name"
              />
              <FormInputText
                control={control}
                name="email"
                label={t('Email')}
                placeholder={t('you@example.com')}
                autoComplete="email"
              />
            </div>

            <div className="flex justify-end border-t border-[var(--color-border)] pt-6">
              <Button
                type="submit"
                label={t('Update profile')}
                icon="pi pi-check"
                disabled={!isDirty}
                loading={isSubmitting}
                className="flex items-center gap-1"
              />
            </div>
          </form>
        </section>
      </section>
    </div>
  )
}
