import { Suspense, useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Lazy URL imports (same relative glob as c941445).
const GLBS = import.meta.glob("../../../assets/venue/*.glb", { query: "?url", import: "default" });
const glbLoader = (name) => Object.entries(GLBS).find(([k]) => k.endsWith(name))?.[1];

function GlbBowl({ url, scale }) {
  const { scene } = useGLTF(url);
  useMemo(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.attributes.normal || o.geometry.computeVertexNormals();
      const n = o.geometry.attributes.normal;
      for (let i = 0; i < n.count; i++) if (n.getX(i) ** 2 + n.getY(i) ** 2 + n.getZ(i) ** 2 < 1e-10) n.setXYZ(i, 0, 1, 0);
      o.material.side = THREE.DoubleSide;
    });
  }, [scene]);
  return <primitive object={scene} scale={scale} />;
}

function ringGeometry([ia, ib], [oa, ob], y0, y1, segs = 128) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pos.push(ia * Math.sin(a), y0, ib * Math.cos(a), oa * Math.sin(a), y1, ob * Math.cos(a));
    if (i < segs) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function PlaceholderBowl({ rings, segments = 128 }) {
  const geos = useMemo(() => rings.map((r) => ringGeometry(r.inner, r.outer, r.y[0], r.y[1], segments)), [rings, segments]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <circleGeometry args={[110, Math.max(24, Math.floor(segments / 2))]} />
        <meshStandardMaterial color="#0a1f19" />
      </mesh>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={rings[i].roof ? "#c4cfd2" : "#4a1c26"} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function Bowl({ venue, bowl = "glb" }) {
  const [url, setUrl] = useState(null);
  const useGlb = bowl === "glb";
  useEffect(() => {
    if (!useGlb) {
      setUrl(null);
      return;
    }
    glbLoader(venue.glb)?.().then(setUrl);
  }, [venue.glb, useGlb]);
  const segs = bowl === "stub" ? 32 : bowl === "lite" ? 64 : 128;
  const fallback = <PlaceholderBowl rings={venue.placeholderRings} segments={segs} />;
  return useGlb && url ? (
    <Suspense fallback={fallback}>
      <GlbBowl url={url} scale={venue.glbScale} />
    </Suspense>
  ) : (
    fallback
  );
}
