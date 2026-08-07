import { useState } from 'react'
import { useDevoteeLanguage } from '@/features/devotee/i18n/useDevoteeLanguage'

type Camera = 'garbhagriha' | 'queue' | 'tower'

export function DevoteeLivePage() {
  const { t } = useDevoteeLanguage()
  const [camera, setCamera] = useState<Camera>('garbhagriha')

  const cameras: { id: Camera; labelKey: 'camGarbhagriha' | 'camQueue' | 'camTower' }[] = [
    { id: 'garbhagriha', labelKey: 'camGarbhagriha' },
    { id: 'queue', labelKey: 'camQueue' },
    { id: 'tower', labelKey: 'camTower' },
  ]

  return (
    <div className="dp-page">
      <div className="dp-page-head">
        <h1>{t('liveTitle')}</h1>
        <p>{t('liveSubtitle')}</p>
      </div>

      <div className="dp-live-wrap" style={{ marginTop: 20 }}>
        <div>
          <div className="dp-live-frame">
            <div className="dp-live-screen">
              <span className="dp-live-badge">
                <span className="dp-dot-live" />
                {t('liveBadge')}
              </span>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#f1d081" strokeWidth="1.2" opacity=".9">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10,8 16,12 10,16" fill="#f1d081" />
              </svg>
              <div className="dp-cam-tabs">
                {cameras.map((cam) => (
                  <button key={cam.id} type="button" className={camera === cam.id ? 'active' : ''} onClick={() => setCamera(cam.id)}>
                    {t(cam.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--dp-ink-soft)' }}>{t('liveNote')}</p>
        </div>

        <div className="dp-panel">
          <div className="dp-stat-label">{t('queueStatusTitle')}</div>
          <div className="dp-sched-item">
            <span>{t('sarvaLine')}</span>
            <span>~45 min</span>
          </div>
          <div className="dp-sched-item">
            <span>{t('specialLine')}</span>
            <span>~20 min</span>
          </div>
          <div className="dp-sched-item">
            <span>{t('seniorLine')}</span>
            <span>~10 min</span>
          </div>
        </div>
      </div>
    </div>
  )
}
