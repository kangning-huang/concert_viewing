# STEER — AAA adaptive quality

- Visual bar: photo-realistic AAA **when device allows**
- Tiers: Ultra → High → Medium → Low
- Target ~60 FPS, floor ~45 on fly-in + look-around
- On jank: drop post-FX, shadows, DPR, anisotropy, texture res, LOD — in that spirit
- Never force max graphics on weak phones
- Honor `?quality=` override
- Phone-first UI (most users open on smartphones)
