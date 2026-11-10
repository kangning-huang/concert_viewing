import { MAP_BOX } from "../scene/CameraRig.jsx";
import { sectionName } from "../venues.js";

const polyPoints = (s) => s.points.map((p) => p.join(",")).join(" ");

// Section picker — every non-closed numbered section is its own tap target.
export function SeatMap({ venue, selected, onSelect, leaving }) {
  const { w, h } = MAP_BOX;
  const { sections, stage, meta } = venue;
  return (
    <div className={`map-layer ${leaving ? "leaving" : ""}`}>
      <svg className="seat-svg" viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={meta.aria}>
        <rect x={-stage.halfX} y={-stage.halfZ} width={stage.halfX * 2} height={stage.halfZ * 2} className="stage-rect" />
        <text x="0" y="3.4" className="stage-label">舞 台</text>
        {sections.map((s) => {
          const on = selected?.id === s.id, floor = s.kind === "floor", label = s.mapLabel === undefined ? s.id : s.mapLabel;
          if (s.unsold)
            return (
              <g key={s.id} className="sec unsold" aria-hidden="true">
                <polygon points={polyPoints(s)} fill={s.color} />
                {label && <text x={s.label.x} y={s.label.z + 0.9} fontSize={2.5} opacity={0.45}>{label}</text>}
              </g>
            );
          return (
            <g key={s.id} className={`sec ${on ? "on" : ""}`} role="button" tabIndex={0} aria-label={sectionName(s)} onClick={() => onSelect(s)} onKeyDown={(e) => e.key === "Enter" && onSelect(s)}>
              <polygon points={polyPoints(s)} fill={on ? "#6fffd2" : s.color} />
              {label && <text x={s.label.x} y={s.label.z + (floor ? 1 : 0.9)} fontSize={floor ? 2.9 : 2.5}>{label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
