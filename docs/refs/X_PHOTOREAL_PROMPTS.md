# Photoreal leads for three.js / R3F (Unreal-on-web bar)

Use these as **steering references**, not as licenses to invent geometry.
AAA materials / lighting only after the XHS photo gate and bowl-params gate.

## Unreal-on-three.js / web AAA looks

Search / study (X + web):

- Threads on pushing three.js toward Unreal-like lighting (HDRI, contact shadows, AO, bloom used sparingly on mobile)
- `threejs-awesome-graphics` style demos: polished PBR, correct exposure, limited overdraw
- Mobile constraints: DPR caps, shadow map size, disable heavy post-FX on Medium/Low

Prompts for agents:

1. Match Nest/Wuxi **stage** silhouettes to real XHS POVs (LED wall proportion, thrust length, truss density) before texturing.
2. Prefer **baked** lightmaps / emissive LED textures over many realtime lights on phone.
3. Keep a single shared GLB for `joker_xue_2026`; swap only bowl GLBs per venue.

## Blender → GLB → R3F

Pipeline:

1. Blockout in meters from `BOWL_PARAMS.md` (cited only).
2. Mid-poly bowl + separate shared stage collection.
3. Export GLB (Draco OK); keep textures ≤2k on High/Ultra, ≤1k on Medium/Low.
4. Load in R3F via `@react-three/drei` `<GLTF />` / `useGLTF` with Suspense.
5. Adaptive: swap material complexity / texture sets by `quality` tier.

## Do not

- Remesh bowls from vibes or Nest→Wuxi scale guesses
- Force Ultra post-FX on weak phones
- Check in multi-hundred-MB texture dumps to iCloud (disk ~13 GB free)
