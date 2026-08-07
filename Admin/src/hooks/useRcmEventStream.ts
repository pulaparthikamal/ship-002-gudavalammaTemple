import { useEffect } from 'react'
import { apiSlice } from '@/services/api/apiSlice'
import { API_BASE_URL, RCM_REALTIME_ENABLED, RCM_REALTIME_MODE, RCM_REALTIME_POLLING_INTERVAL_MS } from '@/services/api/apiConfig'
import { getAuthSessionSnapshot, isAuthSnapshotExpired } from '@/services/api/authSessionBridge'
import { useAppDispatch } from '@/hooks/redux'
import { useToast } from '@/hooks/useToast'

const rcmRealtimeTags = [
  { type: 'Claim' as const, id: 'LIST' },
  { type: 'ClaimSubmission' as const, id: 'LIST' },
  { type: 'ClaimTracking' as const, id: 'LIST' },
  { type: 'EraEobProcessing' as const, id: 'LIST' },
  { type: 'EraException' as const, id: 'LIST' },
  { type: 'PaymentPosting' as const, id: 'LIST' },
  { type: 'Denial' as const, id: 'LIST' },
  { type: 'Appeal' as const, id: 'LIST' },
  { type: 'CorrectedClaim' as const, id: 'LIST' },
  { type: 'ArWorkItem' as const, id: 'LIST' },
  { type: 'PatientBilling' as const, id: 'LIST' },
  { type: 'PatientPayment' as const, id: 'LIST' },
  { type: 'Refund' as const, id: 'LIST' },
  { type: 'Collection' as const, id: 'LIST' },
  { type: 'Report' as const, id: 'LIST' },
  { type: 'Report' as const, id: 'RCM_OPERATIONS' },
  { type: 'AuditLog' as const, id: 'LIST' },
  { type: 'Document' as const, id: 'LIST' },
  { type: 'Metric' as const, id: 'RCM_OPS' },
]

const eventEntityTagMap: Record<string, (typeof rcmRealtimeTags)[number]['type']> = {
  claim: 'Claim',
  claimSubmission: 'ClaimSubmission',
  claimTracking: 'ClaimTracking',
  eraEobProcessing: 'EraEobProcessing',
  eraException: 'EraException',
  paymentPosting: 'PaymentPosting',
  denial: 'Denial',
  appeal: 'Appeal',
  correctedClaim: 'CorrectedClaim',
  arWorkItem: 'ArWorkItem',
  patientBilling: 'PatientBilling',
  patientPayment: 'PatientPayment',
  refund: 'Refund',
  collection: 'Collection',
  auditLog: 'AuditLog',
  report: 'Report',
  document: 'Document',
  rcmBackgroundJob: 'Metric',
  rcmQueueWorker: 'Metric',
}

const RCM_LAST_EVENT_ID_KEY = 'rcm:lastEventId'

function resolveEventStreamUrl(accessToken: string, lastEventId?: string | null) {
  const base = /^https?:\/\//i.test(API_BASE_URL)
    ? API_BASE_URL
    : new URL(API_BASE_URL, window.location.origin).toString()
  const url = new URL(`${base.replace(/\/+$/, '')}/rcm/events/stream`)
  url.searchParams.set('accessToken', accessToken)
  if (lastEventId) {
    url.searchParams.set('lastEventId', lastEventId)
  }
  return url.toString()
}

export function shouldToastRcmEvent(eventType?: string, status?: string) {
  if (eventType === 'QUEUE_JOB_STATUS_CHANGED') {
    return ['FAILED', 'DEAD_LETTER'].includes(String(status ?? '').toUpperCase())
  }
  return [
    'CLAIM_SUBMISSION_STATUS_CHANGED',
    'ACKNOWLEDGEMENT_RECEIVED',
    'ERA_RECEIVED',
    'PAYMENT_POSTED',
    'DENIAL_CREATED',
    'APPEAL_OUTCOME_RECORDED',
    'APPEAL_OVERTURNED',
    'APPEAL_PARTIALLY_OVERTURNED',
    'APPEAL_UPHELD',
    'CLAIM_CLOSED',
    'CLAIM_REOPENED',
    'PAYMENT_REVERSED',
    'PATIENT_PAYMENT_POSTED',
    'REFUND_STATUS_CHANGED',
    'WEBHOOK_REJECTED',
    'FINANCIAL_IMBALANCE_DETECTED',
    'UNSUPPORTED_ADJUSTMENT_DETECTED',
  ].includes(eventType ?? '')
}

function toastSeverity(eventType?: string, status?: string) {
  const normalizedStatus = String(status ?? '').toUpperCase()
  if (eventType?.includes('REJECT') || eventType?.includes('DENIAL') || normalizedStatus === 'FAILED') return 'warn'
  if (eventType?.includes('DEAD_LETTER') || normalizedStatus === 'DEAD_LETTER') return 'error'
  return 'info'
}

export function useRcmEventStream() {
  const dispatch = useAppDispatch()
  const { showToast } = useToast()

  useEffect(() => {
    if (!RCM_REALTIME_ENABLED) {
      return undefined
    }

    if (RCM_REALTIME_MODE !== 'sse' || typeof EventSource === 'undefined') {
      const interval = window.setInterval(() => {
        dispatch(apiSlice.util.invalidateTags(rcmRealtimeTags))
      }, RCM_REALTIME_POLLING_INTERVAL_MS)
      return () => window.clearInterval(interval)
    }

    const snapshot = getAuthSessionSnapshot()
    if (!snapshot.accessToken || !snapshot.isAuthenticated || isAuthSnapshotExpired(snapshot)) {
      return undefined
    }

    let wasDisconnected = false
    const eventSource = new EventSource(resolveEventStreamUrl(snapshot.accessToken, window.localStorage.getItem(RCM_LAST_EVENT_ID_KEY)))

    eventSource.onopen = () => {
      if (wasDisconnected) {
        wasDisconnected = false
        dispatch(apiSlice.util.invalidateTags(rcmRealtimeTags))
      }
    }

    eventSource.addEventListener('rcm-event', (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          eventType?: string
          title?: string
          message?: string
          entityType?: string
          entityId?: string
          status?: string
          sequence?: number
        }

        if (typeof payload.sequence === 'number') {
          window.localStorage.setItem(RCM_LAST_EVENT_ID_KEY, String(payload.sequence))
        }

        const entityTag = payload.entityType ? eventEntityTagMap[payload.entityType] : undefined
        dispatch(apiSlice.util.invalidateTags([
          ...rcmRealtimeTags,
          ...(entityTag && payload.entityId ? [{ type: entityTag, id: payload.entityId }] : []),
        ]))

        if (shouldToastRcmEvent(payload.eventType, payload.status)) {
          showToast({
            severity: toastSeverity(payload.eventType, payload.status),
            summary: payload.title || 'RCM workflow updated',
            detail: payload.message,
          })
        }
      } catch {
        dispatch(apiSlice.util.invalidateTags(rcmRealtimeTags))
      }
    })

    eventSource.onerror = () => {
      wasDisconnected = true
      dispatch(apiSlice.util.invalidateTags(rcmRealtimeTags))
    }

    return () => eventSource.close()
  }, [dispatch, showToast])
}
