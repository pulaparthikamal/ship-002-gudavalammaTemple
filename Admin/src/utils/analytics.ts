import { API_BASE_URL } from '@/services/api/apiConfig'

type AnalyticsEventType = 'pageview' | 'click' | 'funnel_step'

interface QueuedEvent {
  sessionId: string
  path: string
  eventType: AnalyticsEventType
  targetLabel?: string
  funnelName?: string
  stepIndex?: number
  stepName?: string
  timestamp: string
}

const SESSION_STORAGE_KEY = 'dp_analytics_session_id'
const FLUSH_INTERVAL_MS = 10000
const MAX_QUEUE_LENGTH = 20
const ANALYTICS_URL = `${API_BASE_URL.replace(/\/+$/, '')}/analytics/events`

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  try {
    let id = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!id) {
      id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(SESSION_STORAGE_KEY, id)
    }
    return id
  } catch {
    return 'unknown'
  }
}

function flush() {
  if (queue.length === 0) return
  const events = queue
  queue = []

  const body = JSON.stringify({ events })

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' })
    const sent = navigator.sendBeacon(ANALYTICS_URL, blob)
    if (sent) return
  }

  fetch(ANALYTICS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics is best-effort — never let a failed flush surface to the user.
  })
}

function ensureFlushTimer() {
  if (flushTimer || typeof window === 'undefined') return
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS)
}

function enqueue(event: Omit<QueuedEvent, 'sessionId' | 'timestamp'>) {
  queue.push({ ...event, sessionId: getSessionId(), timestamp: new Date().toISOString() })
  ensureFlushTimer()
  if (queue.length >= MAX_QUEUE_LENGTH) flush()
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

export function trackPageview(path: string) {
  enqueue({ path, eventType: 'pageview' })
}

export function trackClick(path: string, targetLabel: string) {
  enqueue({ path, eventType: 'click', targetLabel })
}

export function trackFunnelStep(path: string, funnelName: string, stepIndex: number, stepName: string) {
  enqueue({ path, eventType: 'funnel_step', funnelName, stepIndex, stepName })
}
