import type { SeatPreset } from './App'

type Props = {
  seat: SeatPreset
  onSeat: (s: SeatPreset) => void
  onEnterView: () => void
  leaving?: boolean
}

const QUICK: { id: SeatPreset; label: string; hint: string }[] = [
  { id: '贴脸', label: '贴脸', hint: '内场 C 区 · 舞台正前 · ¥1717' },
  { id: '黄金角', label: '黄金角', hint: '看台侧角 · 约 409 区 · ¥917' },
  { id: 'overview', label: '全场', hint: '高位鸟瞰 · 全场构图' },
]

/** Percent-space polygons over the official Damai seatmap art (incl. title/legend). */
const HOTSPOTS: {
  id: SeatPreset
  label: string
  points: string
  aria: string
}[] = [
  {
    id: '贴脸',
    label: '贴脸',
    // Floor C1–C6, stage front (toward open bowl / bottom of art)
    points: '41,49 59,49 60,60 50,64 40,60',
    aria: '内场贴脸 C 区',
  },
  {
    id: '黄金角',
    label: '黄金角',
    // Lower-right stands ~408–411 (917 档)
    points: '61,56 73,53 79,63 75,73 64,74 58,67',
    aria: '黄金角 右侧看台',
  },
  {
    id: '黄金角',
    label: '黄金角',
    // Lower-left mirror ~221–213 side
    points: '27,53 39,56 42,67 36,74 25,73 21,63',
    aria: '黄金角 左侧看台',
  },
  {
    id: 'overview',
    label: '全场',
    // Bottom high bowl ~209–211 / 409–411 outer
    points: '36,74 64,74 70,84 50,90 30,84',
    aria: '全场高位概览',
  },
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
          <div className="map-stack">
            <img
              className="map-art"
              src={`${import.meta.env.BASE_URL}refs/wuxi/damai_seatmap_web.jpg`}
              alt="薛之谦万兽之王无锡站大麦座位图"
              draggable={false}
            />
            <svg
              className="map-hotspots"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="group"
              aria-label="可点击座位区（大麦布局）"
            >
              {HOTSPOTS.map((h, i) => (
                <polygon
                  key={`${h.id}-${i}`}
                  className={`hotspot${seat === h.id ? ' on' : ''}`}
                  points={h.points}
                  role="button"
                  tabIndex={0}
                  aria-label={h.aria}
                  aria-pressed={seat === h.id}
                  onClick={() => onSeat(h.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSeat(h.id)
                    }
                  }}
                />
              ))}
            </svg>
          </div>
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
            进入视角
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
