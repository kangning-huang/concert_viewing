import type { SeatPreset } from './App'

type Props = {
  seat: SeatPreset
  onSeat: (s: SeatPreset) => void
  onEnterView: () => void
  leaving?: boolean
}

const QUICK: { id: SeatPreset; label: string; hint: string }[] = [
  { id: '贴脸', label: '贴脸', hint: '内场 A 区 · 舞台正前' },
  { id: '黄金角', label: '黄金角', hint: '看台侧角 · 917 档' },
  { id: 'overview', label: '全场', hint: '鸟瞰全场概览' },
]

const TIERS: { price: string; color: string }[] = [
  { price: '1717', color: 'var(--tier-1717)' },
  { price: '1517', color: 'var(--tier-1517)' },
  { price: '1317', color: 'var(--tier-1317)' },
  { price: '917', color: 'var(--tier-917)' },
  { price: '717', color: 'var(--tier-717)' },
  { price: '517', color: 'var(--tier-517)' },
  { price: '317', color: 'var(--tier-317)' },
]

export function SeatMapStart({ seat, onSeat, onEnterView, leaving }: Props) {
  const active = QUICK.find((q) => q.id === seat) ?? QUICK[1]!

  return (
    <div className={`map-layer${leaving ? ' leaving' : ''}`} role="main">
      <div className="map-nebula" aria-hidden />

      <div className="map-frame">
        <div className="map-crop">
          <img
            className="map-art"
            src={`${import.meta.env.BASE_URL}refs/wuxi/damai_seatmap.jpg`}
            alt="薛之谦万兽之王无锡站大麦座位图"
            draggable={false}
          />
        </div>
      </div>

      <aside className="pick-card">
        <div className="quick" role="tablist" aria-label="快捷选座">
          {QUICK.map((q) => (
            <button
              key={q.id}
              type="button"
              role="tab"
              aria-selected={seat === q.id}
              className={seat === q.id ? 'on' : undefined}
              onClick={() => onSeat(q.id)}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="pick-row">
          <div className="pick-meta">
            <h2>{active.label}</h2>
            <p>{active.hint}</p>
          </div>
          <button type="button" className="go" onClick={onEnterView}>
            查看视角
          </button>
        </div>

        <div className="price-legend" aria-label="票价">
          <span className="price-legend-label">票价</span>
          {TIERS.map((t) => (
            <span key={t.price} className="price-swatch">
              <i style={{ background: t.color }} />¥{t.price}
            </span>
          ))}
        </div>
      </aside>
    </div>
  )
}
