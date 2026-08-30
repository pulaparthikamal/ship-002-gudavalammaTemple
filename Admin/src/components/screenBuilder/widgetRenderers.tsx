import { useEffect, useState } from 'react'
import { useDevoteeTranslation } from '@/i18n/useTranslation'
import { useGetTempleProfileQuery } from '@/services/api/endpoints/templeProfileApi'
import { useGetActiveAnnouncementsQuery } from '@/services/api/endpoints/announcementApi'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import type { Widget } from '@/types/pageContent'

const SOCIAL_ICONS: { key: 'facebook' | 'instagram' | 'youtube' | 'twitter' | 'whatsapp'; icon: string; label: string }[] = [
  { key: 'facebook', icon: '📘', label: 'Facebook' },
  { key: 'instagram', icon: '📷', label: 'Instagram' },
  { key: 'youtube', icon: '▶️', label: 'YouTube' },
  { key: 'twitter', icon: '🐦', label: 'Twitter' },
  { key: 'whatsapp', icon: '💬', label: 'WhatsApp' },
]

function useWidgetText(widget: Widget): string {
  // Widget content is devotee-facing regardless of whether this renders on
  // the real devotee page or inside the staff builder/preview — always
  // resolve by the devotee locale, never the staff editor's own UI language.
  const { language } = useDevoteeTranslation()
  return widget.content?.[language] ?? widget.content?.en ?? ''
}

function HeadingWidget({ widget }: { widget: Widget }) {
  const text = useWidgetText(widget)
  return <h2 className="dp-widget-heading">{text}</h2>
}

function TextWidget({ widget }: { widget: Widget }) {
  const text = useWidgetText(widget)
  return <p className="dp-widget-text">{text}</p>
}

function ButtonWidget({ widget }: { widget: Widget }) {
  const text = useWidgetText(widget)
  if (!text) return null
  return (
    <a className="dp-cta-btn dp-cta-btn-primary" href={widget.linkUrl || '#'} style={{ display: 'inline-flex' }}>
      {text}
    </a>
  )
}

function ImageWidget({ widget }: { widget: Widget }) {
  if (!widget.imageUrl) return null
  const img = (
    <img
      src={resolveApiAssetUrl(widget.imageUrl)}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: widget.objectFit ?? 'cover', borderRadius: 12 }}
    />
  )
  return widget.linkUrl ? <a href={widget.linkUrl}>{img}</a> : img
}

function CarouselWidget({ widget }: { widget: Widget }) {
  const images = widget.images ?? []
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (images.length < 2) return
    const duration = widget.slideDurationMs ?? 4000
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), duration)
    return () => clearInterval(timer)
  }, [images.length, widget.slideDurationMs])

  if (!images.length) return null
  const current = images[index]

  return (
    <div style={{ position: 'relative', width: '100%', height: widget.heightPx ?? '100%', overflow: 'hidden', borderRadius: 12 }}>
      {current.linkUrl ? (
        <a href={current.linkUrl}>
          <img src={resolveApiAssetUrl(current.url)} alt={current.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </a>
      ) : (
        <img src={resolveApiAssetUrl(current.url)} alt={current.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {current.caption && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px', background: 'rgba(43,23,16,0.55)', color: '#fbf1dc', fontSize: 13 }}>
          {current.caption}
        </div>
      )}
      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: 8, right: 12, display: 'flex', gap: 4 }}>
          {images.map((_, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === index ? '#ce9a24' : 'rgba(255,255,255,0.6)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SpacerWidget() {
  return <div style={{ width: '100%', height: '100%' }} />
}

function SocialLinksWidgetRenderer() {
  const { data: templeProfile } = useGetTempleProfileQuery()
  if (!templeProfile?.socialLinks) return null

  return (
    <div className="dp-social-links">
      {SOCIAL_ICONS.filter((s) => templeProfile.socialLinks?.[s.key]).map((s) => (
        <a
          key={s.key}
          href={templeProfile.socialLinks?.[s.key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          className="dp-social-link"
        >
          {s.icon}
        </a>
      ))}
    </div>
  )
}

function AnnouncementBannerWidget() {
  const { data: announcements } = useGetActiveAnnouncementsQuery()
  const top = announcements?.slice().sort((a, b) => b.priority - a.priority)[0]
  if (!top) return null

  return (
    <div className="dp-panel" style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', height: '100%' }}>
      {top.imageUrl && (
        <img src={resolveApiAssetUrl(top.imageUrl)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
      )}
      <div>
        <strong>{top.title}</strong>
        <p style={{ margin: 0, fontSize: 13 }}>{top.body}</p>
      </div>
    </div>
  )
}

export function WidgetRenderer({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'heading':
      return <HeadingWidget widget={widget} />
    case 'text':
      return <TextWidget widget={widget} />
    case 'button':
      return <ButtonWidget widget={widget} />
    case 'image':
      return <ImageWidget widget={widget} />
    case 'carousel':
      return <CarouselWidget widget={widget} />
    case 'socialLinks':
      return <SocialLinksWidgetRenderer />
    case 'announcementBanner':
      return <AnnouncementBannerWidget />
    case 'spacer':
    default:
      return <SpacerWidget />
  }
}
