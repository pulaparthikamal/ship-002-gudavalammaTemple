import type { AuthUser } from '@/types/auth'

export function getUserInitials(user: AuthUser | null | undefined) {
  if (!user?.name) {
    return 'U'
  }

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return initials || 'U'
}

export function getPrimaryRole(user: AuthUser | null | undefined) {
  const role = user?.roles[0]

  if (!role) {
    return 'User'
  }

  return role.charAt(0).toUpperCase() + role.slice(1)
}
