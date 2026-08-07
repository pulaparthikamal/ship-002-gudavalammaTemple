import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '@/services/api/apiConfig'
import type { CpuMemLivePayload } from '@/types/serverManagement'

function resolveSocketUrl() {
  if (API_BASE_URL.startsWith('http')) {
    return new URL(API_BASE_URL).origin
  }

  return window.location.origin
}

interface ServerManagementSocketOptions {
  debounceMs?: number
  onLiveCpuMem?: (data: CpuMemLivePayload) => void
  liveMetricsEnabled?: boolean
}

export function useServerManagementSocket(
  serverId: string | undefined,
  onUpdate: () => void,
  options: ServerManagementSocketOptions = {}
) {
  const updateTimerRef = useRef<number | undefined>(undefined)
  const debounceMs = options.debounceMs ?? 1000
  const liveMetricsEnabled = options.liveMetricsEnabled ?? true
  // Keep a stable ref so the effect doesn't re-run when the callback identity changes
  const onLiveCpuMemRef = useRef(options.onLiveCpuMem)
  onLiveCpuMemRef.current = options.onLiveCpuMem

  useEffect(() => {
    if (!serverId) {
      return undefined
    }

    const socket = io(resolveSocketUrl(), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })

    const scheduleUpdate = () => {
      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current)
      }

      updateTimerRef.current = window.setTimeout(() => {
        onUpdate()
      }, debounceMs)
    }

    socket.emit('joinServer', serverId)

    if (liveMetricsEnabled) {
      // Request 1s live CPU/memory push — server starts a persistent SSH poller
      socket.emit('startLiveMetrics', serverId)
    }

    // Live CPU/memory — data arrives directly, no API refetch needed
    socket.on('CPU_MEM_LIVE', (data: CpuMemLivePayload) => {
      if (liveMetricsEnabled) {
        if (data.serverId && data.serverId !== serverId) {
          return
        }
        onLiveCpuMemRef.current?.(data)
      }
    })

    socket.on('metrics:update', scheduleUpdate)
    socket.on('scan:completed', scheduleUpdate)
    socket.on('alert:created', scheduleUpdate)
    socket.on('action:completed', scheduleUpdate)
    socket.on('action:failed', scheduleUpdate)
    socket.on('remediation:status', scheduleUpdate)
    socket.on('MONITOR_UPDATE', scheduleUpdate)
    socket.on('HEALTH_SCORE_UPDATE', scheduleUpdate)
    socket.on('METRIC_SPIKE_DETECTED', scheduleUpdate)
    socket.on('AI_PREDICTION', scheduleUpdate)
    socket.on('ANOMALY_DETECTED', scheduleUpdate)
    socket.on('FAILURE_FORECAST', scheduleUpdate)

    return () => {
      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current)
      }
      if (liveMetricsEnabled) {
        socket.emit('stopLiveMetrics', serverId)
      }
      socket.emit('leaveServer', serverId)
      socket.disconnect()
    }
  }, [debounceMs, liveMetricsEnabled, onUpdate, serverId])
}
