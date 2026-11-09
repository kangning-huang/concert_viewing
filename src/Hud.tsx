import type { ReactNode } from 'react'
import type { SeatPreset, VenueId } from './App'
import type { QualityTier } from './quality'

type Props = {
  venue: VenueId
  seat: SeatPreset
  tier: QualityTier
  onVenue: (v: VenueId) => void
  onSeat: (s: SeatPreset) => void
  onTier: (t: QualityTier) => void
  onBackMap?: () => void
}

export function Hud({ venue, seat, tier, onVenue, onSeat, onTier, onBackMap }: Props) {
  return (
    <div className="hud">
      <div className="hud-meta">
        {venue === 'wuxi' ? '无锡奥体 · 万兽之王' : '鸟巢 · 效果演示'} · {seat} · {tier}
      </div>
      <div className="hud-chips">
        {onBackMap ? (
          <Chip active={false} ghost onClick={onBackMap}>
            选座图
          </Chip>
        ) : null}
        <Chip active={venue === 'wuxi'} onClick={() => onVenue('wuxi')}>
          无锡交付
        </Chip>
        <Chip active={venue === 'nest'} onClick={() => onVenue('nest')}>
          鸟巢演示
        </Chip>
        <Chip active={seat === '贴脸'} onClick={() => onSeat('贴脸')}>
          贴脸
        </Chip>
        <Chip active={seat === '黄金角'} onClick={() => onSeat('黄金角')}>
          黄金角
        </Chip>
        <Chip active={seat === 'overview'} onClick={() => onSeat('overview')}>
          全场
        </Chip>
        {(['ultra', 'high', 'medium', 'low'] as QualityTier[]).map((t) => (
          <Chip key={t} active={tier === t} onClick={() => onTier(t)}>
            {t}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
  ghost,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  ghost?: boolean
}) {
  const cls = ['chip', active ? 'on' : '', ghost ? 'ghost' : ''].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  )
}
