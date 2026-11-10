import { Fragment, useCallback, useState } from "react";
import { StageCanvas } from "./scene/StageCanvas.jsx";
import { SeatMap } from "./ui/SeatMap.jsx";
import { SeatSheet } from "./ui/SeatSheet.jsx";
import { VENUES, sectionName } from "./venues.js";
import { CUES, CUE_ORDER } from "./stage/JokerXueStage.jsx";
import { seatMetrics } from "./metrics.js";

const LAND_MS = 200;
const params = new URLSearchParams(window.location.search);
const pathVenue = /\/wuxi\/?$/.test(location.pathname) ? "wuxi" : /\/beijing\/?$/.test(location.pathname) ? "nest" : null;
const venue = VENUES[params.get("venue") ?? pathVenue] ?? VENUES.nest;
const deepPov = venue.povs?.[params.get("pov")];
document.title = venue.meta.pageTitle;
const switchLink = venue.id === "nest" ? { href: "?venue=wuxi", label: "切换到无锡站" } : { href: "?venue=nest", label: "切换到北京站" };

// phase: map → flyin → land → pov → flyout → map
export default function App() {
  const [phase, setPhase] = useState(deepPov ? "flyin" : "map");
  const [section, setSection] = useState(venue.byId(deepPov ?? venue.defaultId));
  const [cue, setCue] = useState("title");
  const onArrived = useCallback(() => {
    setPhase("land");
    setTimeout(() => setPhase("pov"), LAND_MS);
  }, []);
  const onReturned = useCallback(() => setPhase("map"), []);
  const pick = (s) => setSection(s);
  const go = () => {
    setCue("title");
    setPhase("flyin");
  };
  const m = seatMetrics(section, venue);
  const onMap = phase === "map", inPov = phase === "pov";
  return (
    <main className="app">
      <StageCanvas venue={venue} phase={phase === "land" ? "pov" : phase} section={section} cue={cue} onArrived={onArrived} onReturned={onReturned} />
      <SeatMap venue={venue} selected={section} onSelect={pick} leaving={!onMap} />
      <div className={`masthead ${onMap ? "" : "hide"}`}>
        <h1>{venue.meta.title}</h1>
        <p className="artist">薛之谦 · 万兽之王巡回演唱会</p>
        <p className="dates">{venue.meta.dates.map((d, i) => <Fragment key={d}>{i > 0 && <br />}{d}</Fragment>)}</p>
        <p className="venue">{venue.meta.place}</p>
        <a className="venue-switch" href={switchLink.href}>{switchLink.label}</a>
      </div>
      {onMap && (
        <section className="pick-card">
          <div className="quick">
            {venue.quick.map((id) => {
              const s = venue.byId(id);
              return <button key={id} className={section.id === id ? "on" : ""} onClick={() => pick(s)}>{sectionName(s)}</button>;
            })}
          </div>
          <div className="pick-row">
            <div>
              <h2>{sectionName(section)}</h2>
              <p>{m.zone} · ¥{m.price_cny} <small>示意价</small></p>
            </div>
            <button className="go" onClick={go}>进入视角</button>
          </div>
        </section>
      )}
      {inPov && (
        <>
          <nav className="cues" aria-label="演出段落">
            {CUE_ORDER.map((c) => <button key={c} className={cue === c ? "on" : ""} onClick={() => setCue(c)}>{CUES[c].label}</button>)}
          </nav>
          <SeatSheet venue={venue} section={section} onChange={() => setPhase("flyout")} />
          <p className="drag-hint">拖动画面环顾四周</p>
        </>
      )}
    </main>
  );
}
