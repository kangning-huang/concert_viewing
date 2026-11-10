import { seatMetrics } from "../metrics.js";
import { sectionName } from "../venues.js";

const Stat = ({ value, unit, label }) => (
  <div className="stat">
    <b>{value}<i>{unit}</i></b>
    <span>{label}</span>
  </div>
);

export function SeatSheet({ venue, section, onChange }) {
  const m = seatMetrics(section, venue);
  const [a, b] = venue.compare;
  const other = venue.byId(section.id === a ? b : a), om = seatMetrics(other, venue);
  return (
    <aside className="sheet">
      <header>
        <h2>{sectionName(section)}</h2>
        <em className={`zone z-${m.zone}`}>{m.zone}</em>
        <span className="price">¥{m.price_cny}<small>示意价</small></span>
      </header>
      <p className="promise">{m.promise}</p>
      <div className="stats">
        <Stat value={m.distance_m.toFixed(0)} unit="m" label="距舞台" />
        <Stat value={m.stage_hfov_deg.toFixed(0)} unit="°" label="舞台水平张角" />
        <Stat value={m.offset_m.toFixed(0)} unit="m" label="偏中心" />
      </div>
      <p className="occ">遮挡提示 · {m.occlusion}</p>
      <p className="vs">对比 {sectionName(other)}：{om.zone} · 距舞台 {om.distance_m.toFixed(0)}m · 张角 {om.stage_hfov_deg.toFixed(0)}° · ¥{om.price_cny}</p>
      <button className="change" onClick={onChange}>换座</button>
      <p className="fine">示意区 · 视角与座位号以实际票面为准</p>
    </aside>
  );
}
