import { useId } from 'react'

interface TempleGopuramMarkProps {
  className?: string
}

/**
 * The temple-tower (gopuram) illustration used as the app's brand mark —
 * the same artwork as the staff login page's `.temple-login-gopuram`
 * (see TempleArtwork.tsx), extracted here so it can be reused as a compact
 * logo (sidebar, header, auth screens) without duplicating the markup.
 * Gradient ids are made unique per instance via useId() since this can be
 * mounted more than once in the same DOM (e.g. header + sidebar together).
 */
export function TempleGopuramMark({ className }: TempleGopuramMarkProps) {
  const uid = useId()
  const goldId = `temple-gopuram-gold-${uid}`
  const gold2Id = `temple-gopuram-gold-2-${uid}`

  return (
    <svg viewBox="0 0 320 470" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e4b94b" />
          <stop offset="100%" stopColor="#a9790c" />
        </linearGradient>
        <linearGradient id={gold2Id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1d081" />
          <stop offset="100%" stopColor="#c29418" />
        </linearGradient>
      </defs>
      <g stroke="#7c1220" strokeWidth="1.4" strokeLinejoin="round">
        <circle cx="160" cy="34" r="8" fill={`url(#${gold2Id})`} />
        <rect x="157" y="14" width="6" height="18" fill={`url(#${gold2Id})`} />
        <polygon points="134,60 186,60 200,96 120,96" fill={`url(#${goldId})`} />
        <polygon points="120,102 200,102 218,144 102,144" fill={`url(#${gold2Id})`} />
        <polygon points="102,150 218,150 240,198 80,198" fill={`url(#${goldId})`} />
        <polygon points="80,204 240,204 266,258 54,258" fill={`url(#${gold2Id})`} />
        <polygon points="54,264 266,264 298,322 22,322" fill={`url(#${goldId})`} />
        <polygon points="22,328 298,328 320,384 0,384" fill={`url(#${gold2Id})`} />
        <rect x="60" y="384" width="200" height="80" fill="#fbefcb" />
        <rect x="130" y="410" width="60" height="54" fill="#4a0b14" />
      </g>
    </svg>
  )
}
