import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { useGetActiveAnnouncementsQuery } from '@/services/api/endpoints/announcementApi'

const DISMISSED_KEY = 'dismissedAnnouncements'

function getDismissedIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function addDismissedId(id: string) {
  const ids = getDismissedIds()
  if (!ids.includes(id)) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids, id]))
  }
}

const TYPE_ACCENT: Record<string, string> = {
  info: '#146569',
  urgent: '#c1421a',
  festival: '#a9790c',
}

export function AnnouncementPopup() {
  const { data: announcements } = useGetActiveAnnouncementsQuery()
  const [visible, setVisible] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => getDismissedIds())
  const navigate = useNavigate()

  const announcement = useMemo(() => {
    if (!announcements?.length) return null
    const undismissed = announcements.filter((a) => !dismissedIds.includes(a._id))
    if (!undismissed.length) return null
    return [...undismissed].sort((a, b) => b.priority - a.priority)[0]
  }, [announcements, dismissedIds])

  useEffect(() => {
    if (announcement) setVisible(true)
  }, [announcement])

  if (!announcement) return null

  const handleClose = () => {
    addDismissedId(announcement._id)
    setDismissedIds((prev) => [...prev, announcement._id])
    setVisible(false)
  }

  const handleViewEvent = () => {
    handleClose()
    navigate('/devotee/events')
  }

  return (
    <Dialog
      visible={visible}
      onHide={handleClose}
      header={announcement.title}
      style={{ width: '28rem', borderTop: `4px solid ${TYPE_ACCENT[announcement.type] ?? '#7c1220'}` }}
      modal
    >
      {announcement.imageUrl && (
        <img
          src={announcement.imageUrl}
          alt=""
          style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }}
        />
      )}
      <p style={{ whiteSpace: 'pre-wrap' }}>{announcement.body}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '1rem' }}>
        {announcement.linkedEventId && <Button label="View Event" outlined onClick={handleViewEvent} />}
        <Button label="Got it" onClick={handleClose} />
      </div>
    </Dialog>
  )
}
