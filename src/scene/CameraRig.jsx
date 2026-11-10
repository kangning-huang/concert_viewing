// Camera: top-down map view → fly-in along a centripetal Catmull-Rom path →
// seat POV with drag look-around. 1:1 from c941445 — do not retune without
// measuring frame times (see scripts/smoke.mjs).
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const { MathUtils } = THREE;

export const MAP_BOX = { w: 360, h: 320 }; // SVG map viewBox (world metres)
const POV_HFOV = MathUtils.degToRad(65);
export const FLYIN_S = 1.6;
export const FLYOUT_S = 1.25;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const vfovFor = (aspect) => 2 * Math.atan(Math.tan(POV_HFOV / 2) / aspect);

// Height at which the top-down camera frames MAP_BOX exactly like the SVG overlay.
export function mapHeight(w, h) {
  return h / Math.min(w / MAP_BOX.w, h / MAP_BOX.h) / (2 * Math.tan(vfovFor(w / h) / 2));
}

function flightPath(section, topY) {
  const s = section.seat;
  const out = new THREE.Vector3(s.x, 0, s.z).normalize();
  const seat = new THREE.Vector3(s.x, s.y, s.z);
  const top = new THREE.Vector3(0, topY, 0.01);
  const pts =
    section.kind === "floor"
      ? [top, new THREE.Vector3(s.x * 0.9, 58, s.z * 1.05), seat.clone().addScaledVector(out, 7).setY(4.6), seat]
      : [top, new THREE.Vector3(s.x * 0.62, 72, s.z * 0.62), seat.clone().addScaledVector(out, -15).setY(s.y + 8), seat];
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

export function CameraRig({ phase, section, onArrived, onReturned, lookEnabled }) {
  const { camera, size, gl } = useThree();
  const st = useRef({ t: 0, path: null, yaw: 0, pitch: 0, yawT: 0, pitchT: 0 });
  const stageTarget = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    camera.fov = MathUtils.radToDeg(vfovFor(size.width / size.height));
    camera.far = 1600;
    camera.updateProjectionMatrix();
  }, [camera, size]);

  useEffect(() => {
    const top = mapHeight(size.width, size.height);
    if (section) st.current.path = flightPath(section, top);
    st.current.t = 0;
    if (phase === "map" || phase === "flyin") Object.assign(st.current, { yaw: 0, pitch: 0, yawT: 0, pitchT: 0 });
  }, [phase, section?.id]);

  // Drag look-around (pointer events; works for touch + mouse).
  useEffect(() => {
    const el = gl.domElement;
    let drag = null;
    const down = (e) => {
      if (lookEnabled) drag = [e.clientX, e.clientY, st.current.yawT, st.current.pitchT];
    };
    const move = (e) => {
      if (!drag) return;
      st.current.yawT = MathUtils.clamp(drag[2] + (e.clientX - drag[0]) * 0.0035, -1.1, 1.1);
      st.current.pitchT = MathUtils.clamp(drag[3] + (e.clientY - drag[1]) * 0.0035, -0.5, 0.8);
    };
    const up = () => {
      drag = null;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl, lookEnabled]);

  useFrame((_, dt) => {
    const s = st.current;
    if (phase === "map" || !section || !s.path) {
      camera.position.set(0, mapHeight(size.width, size.height), 0.01);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
      return;
    }
    if (phase === "flyin" || phase === "flyout") {
      s.t = Math.min(1, s.t + dt / (phase === "flyin" ? FLYIN_S : FLYOUT_S));
      if (s.t >= 1) {
        s.t = 0;
        phase === "flyin" ? onArrived() : onReturned();
        return;
      }
    }
    const k = phase === "pov" ? 1 : easeInOutCubic(phase === "flyin" ? s.t : 1 - s.t);
    s.path.getPoint(k, camera.position);
    const floor = section.kind === "floor";
    const endFloor = floor && Math.abs(section.seat.z) > 22;
    stageTarget.set(endFloor ? section.seat.x * 1.1 : 0, floor ? 9 : 7, 0);
    const ground = tmp.set(section.seat.x, 0, section.seat.z);
    look.lerpVectors(ground, stageTarget, MathUtils.smoothstep(k, 0.08, 0.72));
    camera.up.set(0, 0, -1).lerp(tmp.set(0, 1, 0), MathUtils.smoothstep(k, 0.02, 0.5)).normalize();
    camera.lookAt(look);
    if (phase === "pov") {
      s.yaw = MathUtils.damp(s.yaw, s.yawT, 9, dt);
      s.pitch = MathUtils.damp(s.pitch, s.pitchT, 9, dt);
      camera.rotateY(s.yaw);
      camera.rotateX(s.pitch);
    }
  });
  return null;
}
