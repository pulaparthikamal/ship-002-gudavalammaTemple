/**
 * Shared social post status utilities.
 * Pure functions — no React hooks, no side effects.
 * Used by both SocialPostsPage (table) and SocialAutomationPostsGrid (cards).
 */

// ─── Human-readable labels ───────────────────────────────────────────────────

export const statusLabels: Record<string, string> = {
  waiting_for_approval: 'Waiting for Approval',
  scheduled: 'Scheduled',
  pending: 'Pending to Publish',
  posted: 'Posted',
  failed: 'Failed',
  paused: 'Paused',
  content_generation_pending: 'Content Generation Pending',
  email_sent: 'Email Sent',
  email_failed: 'Mailing Failed',
  email_send_error: 'Mail Send Error',
  approved: 'Approved',
  rejected: 'Rejected',
  not_required: 'Not Required',
}

// ─── Table badge Tailwind classes (border + bg + text) ───────────────────────

export const statusBadgeClasses: Record<string, string> = {
  scheduled: 'border-amber-200 bg-amber-50 text-amber-700',
  waiting_for_approval: 'border-amber-200 bg-amber-50 text-amber-700',
  pending: 'border-sky-200 bg-sky-50 text-sky-700',
  posted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  paused: 'border-slate-300 bg-slate-100 text-slate-500',
  content_generation_pending: 'border-amber-200 bg-amber-50 text-amber-700',
  email_sent: 'border-sky-200 bg-sky-50 text-sky-700',
  email_failed: 'border-red-200 bg-red-50 text-red-700',
  email_send_error: 'border-red-200 bg-red-50 text-red-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-200 bg-red-50 text-red-700',
  not_required: 'border-slate-200 bg-slate-50 text-slate-600',
}

// ─── Card badge Tailwind classes (backdrop-blur / opacity-friendly) ───────────

export const statusCardClasses: Record<string, string> = {
  posted: 'bg-green-100/90 text-green-700 border border-green-200',
  failed: 'bg-red-100/90 text-red-700 border border-red-200',
  rejected: 'bg-red-100/90 text-red-700 border border-red-200',
  email_failed: 'bg-red-100/90 text-red-700 border border-red-200',
  paused: 'bg-slate-200/90 text-slate-700 border border-slate-300',
  pending: 'bg-sky-100/90 text-sky-700 border border-sky-200',
  waiting_for_approval: 'bg-amber-100/90 text-amber-700 border border-amber-200',
  content_generation_pending: 'bg-amber-100/90 text-amber-700 border border-amber-200',
  scheduled: 'bg-blue-100/90 text-blue-700 border border-blue-200',
  email_sent: 'bg-sky-100/90 text-sky-700 border border-sky-200',
  approved: 'bg-green-100/90 text-green-700 border border-green-200',
}

export function getStatusCardClass(statusKey: string): string {
  return statusCardClasses[statusKey] ?? 'bg-blue-100/90 text-blue-700 border border-blue-200'
}

// ─── Smart effective status resolver (server data → display key) ──────────────

type PostStatusInput = {
  postType?: string
  status?: string
  approvalStatus?: string
}

/**
 * Maps raw server data to the correct display status key.
 * Mirrors the logic in StatusCellBadge (socialModel.tsx) but as a pure function
 * so it can be used outside React component trees (e.g. card grids, dialogs).
 *
 * Rules:
 *  - AI post, no content generated → 'content_generation_pending'
 *  - Manual post, status=scheduled → 'pending'  (shows "Pending to Publish")
 *  - Everything else → raw server status
 */
export function getEffectiveStatusKey(post: PostStatusInput): string {
  const { postType, status, approvalStatus } = post

  if (postType === 'ai') {
    if (!approvalStatus || approvalStatus === 'content_generation_pending') {
      return 'content_generation_pending'
    }
    if (status === 'waiting_for_approval') {
      return 'scheduled'
    }
    return status ?? ''
  }

  if (postType === 'manual' && status === 'scheduled') {
    return 'pending'
  }

  return status ?? ''
}
