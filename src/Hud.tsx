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
}

export function Hud({ venue, seat, tier, onVenue, onSeat, onTier }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '12px 12px calc(12px + env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'linear-gradient(transparent, rgba(5,6,11,0.92))',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        {venue === 'wuxi' ? '无锡奥体 · 万兽之王' : '鸟巢 · 效果演示'} · {seat} · {tier}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', pointerEvents: 'auto' }}>
        <Chip active={venue === 'wuxi'} onClick={() => onVenue('wuxi')}>无锡交付</Chip>
        <Chip active={venue === 'nest'} onClick={() => onVenue('nest')}>鸟巢演示</Chip>
        <Chip active={seat === '贴脸'} onClick={() => onSeat('贴脸')}>贴脸</Chip>
        <Chip active={seat === '黄金角'} onClick={() => onSeat('黄金角')}>黄金角</Chip>
        <Chip active={seat === 'overview'} onClick={() => onSeat('overview')}>全场</Chip>
        {(['ultra', 'high', 'medium', 'low'] as QualityTier[]).map((t) => (
          <Chip key={t} active={tier === t} onClick={() => onTier(t)}>{t}</Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid rgba(255,255,255,0.18)',
        background: active ? 'rgba(120,140,255,0.35)' : 'rgba(20,24,40,0.75)',
        color: '#fff',
        borderRadius: 999,
        padding: '8px 12px',
        fontSize: 13,
      }}
    >
      {children}
    </button>
  )
}
