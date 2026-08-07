import type { CSSProperties } from 'react'

const RAY_ANGLES = Array.from({ length: 16 }, (_, index) => index * 22.5)
const PETALS = Array.from({ length: 6 }, (_, index) => index)

export function TempleArtwork() {
  return (
    <div className="temple-login-art">
      <svg className="temple-login-sunburst" viewBox="0 0 200 200" aria-hidden="true">
        <g stroke="#ce9a24" strokeWidth="1">
          <circle cx="100" cy="100" r="70" fill="none" opacity=".3" />
          {RAY_ANGLES.map((angle) => (
            <line
              key={angle}
              x1={100}
              y1={100}
              x2={100 + 90 * Math.cos((angle * Math.PI) / 180)}
              y2={100 + 90 * Math.sin((angle * Math.PI) / 180)}
              opacity={angle % 45 === 0 ? 0.5 : 0.2}
            />
          ))}
        </g>
      </svg>

      <div className="temple-login-petals" aria-hidden="true">
        {PETALS.map((index) => (
          <span
            key={index}
            className="temple-login-petal"
            style={{
              left: `${8 + index * 60}px`,
              animationDelay: `${index * 1.1}s`,
              animationDuration: `${6 + (index % 3)}s`,
              '--tl-drift': `${(index % 2 === 0 ? 1 : -1) * (10 + index * 3)}px`,
            } as CSSProperties}
          />
        ))}
      </div>

      <svg className="temple-login-gopuram" width="260" height="380" viewBox="0 0 320 470" aria-hidden="true">
        <defs>
          <linearGradient id="temple-login-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e4b94b" />
            <stop offset="100%" stopColor="#a9790c" />
          </linearGradient>
          <linearGradient id="temple-login-gold-2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f1d081" />
            <stop offset="100%" stopColor="#c29418" />
          </linearGradient>
        </defs>
        <g stroke="#7c1220" strokeWidth="1.4" strokeLinejoin="round">
          <circle cx="160" cy="34" r="8" fill="url(#temple-login-gold-2)" />
          <rect x="157" y="14" width="6" height="18" fill="url(#temple-login-gold-2)" />
          <polygon points="134,60 186,60 200,96 120,96" fill="url(#temple-login-gold)" />
          <polygon points="120,102 200,102 218,144 102,144" fill="url(#temple-login-gold-2)" />
          <polygon points="102,150 218,150 240,198 80,198" fill="url(#temple-login-gold)" />
          <polygon points="80,204 240,204 266,258 54,258" fill="url(#temple-login-gold-2)" />
          <polygon points="54,264 266,264 298,322 22,322" fill="url(#temple-login-gold)" />
          <polygon points="22,328 298,328 320,384 0,384" fill="url(#temple-login-gold-2)" />
          <rect x="60" y="384" width="200" height="80" fill="#fbefcb" />
          <rect x="130" y="410" width="60" height="54" fill="#4a0b14" />
        </g>
      </svg>
    </div>
  )
}
