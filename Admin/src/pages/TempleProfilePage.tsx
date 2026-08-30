import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { Plus, Trash2 } from 'lucide-react'
import { FormInputText } from '@/components/forms/FormInputText'
import { FormFileUpload } from '@/components/forms/FormFileUpload'
import { PageHeader } from '@/components/ui/PageHeader'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { useGetTempleProfileQuery, useUpdateTempleProfileMutation } from '@/services/api/endpoints/templeProfileApi'

const templeProfileSchema = z.object({
  templeName: z.string().min(1, 'Temple name is required'),
  tagline: z.string().optional(),
  address: z.string().optional(),
  helpline: z.string().optional(),
  logoUrl: z.string().optional(),
  deityImageUrl: z.string().optional(),
  upiId: z.string().optional(),
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  youtube: z.string().optional(),
  twitter: z.string().optional(),
  whatsapp: z.string().optional(),
  timings: z.array(z.object({ label: z.string().min(1, 'Required'), time: z.string().min(1, 'Required') })),
  contactEmails: z.array(z.object({ value: z.string().email('Enter a valid email') })),
})

type TempleProfileFormValues = z.infer<typeof templeProfileSchema>

export function TempleProfilePage() {
  const { t } = useStaffTranslation()
  const { data: profile } = useGetTempleProfileQuery()
  const [updateTempleProfile, { isLoading }] = useUpdateTempleProfileMutation()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = useForm<TempleProfileFormValues>({
    resolver: zodResolver(templeProfileSchema),
    defaultValues: {
      templeName: '',
      tagline: '',
      address: '',
      helpline: '',
      logoUrl: '',
      deityImageUrl: '',
      upiId: '',
      facebook: '',
      instagram: '',
      youtube: '',
      twitter: '',
      whatsapp: '',
      timings: [],
      contactEmails: [],
    },
  })

  const timingsArray = useFieldArray({ control, name: 'timings' })
  const emailsArray = useFieldArray({ control, name: 'contactEmails' })

  useEffect(() => {
    if (profile) {
      reset({
        templeName: profile.templeName ?? '',
        tagline: profile.tagline ?? '',
        address: profile.address ?? '',
        helpline: profile.helpline ?? '',
        logoUrl: profile.logoUrl ?? '',
        deityImageUrl: profile.deityImageUrl ?? '',
        upiId: profile.upiId ?? '',
        facebook: profile.socialLinks?.facebook ?? '',
        instagram: profile.socialLinks?.instagram ?? '',
        youtube: profile.socialLinks?.youtube ?? '',
        twitter: profile.socialLinks?.twitter ?? '',
        whatsapp: profile.socialLinks?.whatsapp ?? '',
        timings: profile.timings ?? [],
        contactEmails: (profile.contactEmails ?? []).map((value) => ({ value })),
      })
    }
  }, [profile, reset])

  const onSubmit = async (values: TempleProfileFormValues) => {
    await updateTempleProfile({
      templeName: values.templeName,
      tagline: values.tagline,
      address: values.address,
      helpline: values.helpline,
      logoUrl: values.logoUrl,
      deityImageUrl: values.deityImageUrl,
      upiId: values.upiId,
      socialLinks: {
        facebook: values.facebook,
        instagram: values.instagram,
        youtube: values.youtube,
        twitter: values.twitter,
        whatsapp: values.whatsapp,
      },
      timings: values.timings,
      contactEmails: values.contactEmails.map((entry) => entry.value),
    }).unwrap()
    setSuccessMessage(t('Temple profile updated successfully.'))
  }

  return (
    <div className="temple-scope mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t('Temple Management')}
        title={t('Temple profile')}
        description={t("Manage the temple's public identity, contact details and social media links shown on the home page.")}
      />

      {successMessage && (
        <Message severity="success" text={successMessage} onClick={() => setSuccessMessage(null)} />
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      >
        <FormInputText control={control} name="templeName" label={t('Temple name')} />
        <FormInputText control={control} name="tagline" label={t('Tagline')} />
        <FormInputText control={control} name="address" label={t('Address')} />
        <FormInputText control={control} name="helpline" label={t('Helpline')} />
        <FormFileUpload
          control={control}
          name="deityImageUrl"
          label={t('Deity picture')}
          helperText={t(
            'The large deity/idol photo shown on the staff and devotee login pages’ artwork panel and the devotee home page hero. Upload once here and every one of those places updates automatically, sized to fit without cropping.',
          )}
          accept="image/*"
          folder="temple-profile"
        />
        <FormFileUpload
          control={control}
          name="logoUrl"
          label={t('Logo (small brand mark)')}
          helperText={t(
            'The small icon shown next to the temple name in headers, the sidebar, and login pages — keep this compact; use Deity picture above for the large artwork.',
          )}
          accept="image/*"
          folder="temple-profile"
        />
        <FormInputText
          control={control}
          name="upiId"
          label={t('UPI ID')}
          placeholder={t('e.g. templename@okaxis')}
          helperText={t(
            "The temple's own UPI VPA — used to generate direct payment links/QR codes for bookings and donations. No payment gateway involved.",
          )}
        />

        <h3 className="pt-2 text-sm font-semibold text-[var(--color-text-strong)]">{t('Social media links')}</h3>
        <FormInputText control={control} name="facebook" label={t('Facebook URL')} />
        <FormInputText control={control} name="instagram" label={t('Instagram URL')} />
        <FormInputText control={control} name="youtube" label={t('YouTube URL')} />
        <FormInputText control={control} name="twitter" label={t('Twitter / X URL')} />
        <FormInputText control={control} name="whatsapp" label={t('WhatsApp URL')} />

        <div className="flex items-center justify-between pt-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">{t('Temple timings')}</h3>
          <Button
            type="button"
            label={t('Add timing')}
            icon={<Plus className="h-3.5 w-3.5" />}
            outlined
            size="small"
            onClick={() => timingsArray.append({ label: '', time: '' })}
          />
        </div>
        {timingsArray.fields.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t('No timings added yet.')}</p>
        ) : (
          <div className="space-y-2">
            {timingsArray.fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <InputText
                    {...register(`timings.${index}.label`)}
                    placeholder={t('e.g. Suprabhatam')}
                    className="w-full"
                  />
                  {errors.timings?.[index]?.label && (
                    <span className="text-xs text-red-600">{errors.timings[index]?.label?.message}</span>
                  )}
                </div>
                <div className="flex-1">
                  <InputText
                    {...register(`timings.${index}.time`)}
                    placeholder={t('e.g. 4:30 AM')}
                    className="w-full"
                  />
                  {errors.timings?.[index]?.time && (
                    <span className="text-xs text-red-600">{errors.timings[index]?.time?.message}</span>
                  )}
                </div>
                <Button
                  type="button"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  severity="danger"
                  outlined
                  size="small"
                  onClick={() => timingsArray.remove(index)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">{t('Contact emails')}</h3>
          <Button
            type="button"
            label={t('Add email')}
            icon={<Plus className="h-3.5 w-3.5" />}
            outlined
            size="small"
            onClick={() => emailsArray.append({ value: '' })}
          />
        </div>
        {emailsArray.fields.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{t('No contact emails added yet.')}</p>
        ) : (
          <div className="space-y-2">
            {emailsArray.fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <InputText
                    {...register(`contactEmails.${index}.value`)}
                    placeholder={t('e.g. donations@temple.org')}
                    className="w-full"
                  />
                  {errors.contactEmails?.[index]?.value && (
                    <span className="text-xs text-red-600">{errors.contactEmails[index]?.value?.message}</span>
                  )}
                </div>
                <Button
                  type="button"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  severity="danger"
                  outlined
                  size="small"
                  onClick={() => emailsArray.remove(index)}
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="submit" label={t('Save changes')} loading={isLoading} />
        </div>
      </form>
    </div>
  )
}
