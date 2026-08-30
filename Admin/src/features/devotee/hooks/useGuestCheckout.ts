import { useState } from 'react'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useDevoteeTranslation } from '@/i18n/useTranslation'

export interface GuestBookingPayload {
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  preferredLocale?: string
}

/**
 * Shared guest-checkout state for the 5 booking/order/donation forms that
 * support anonymous use. When authenticated, the account's own identity is
 * used server-side and no guest fields are sent; when not, the visitor must
 * provide a name plus at least one of email/phone before submitting.
 */
export function useGuestCheckout() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { language } = useDevoteeTranslation()
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  const hasContactMethod = guestEmail.trim().length > 0 || guestPhone.trim().length > 0
  const isGuestInfoValid = isAuthenticated || (guestName.trim().length > 0 && hasContactMethod)

  const guestPayload: GuestBookingPayload = isAuthenticated
    ? {}
    : {
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
        preferredLocale: language,
      }

  return {
    isAuthenticated,
    guestName,
    setGuestName,
    guestEmail,
    setGuestEmail,
    guestPhone,
    setGuestPhone,
    isGuestInfoValid,
    guestPayload,
  }
}
