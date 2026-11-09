# STEER — XHS photo gate then AAA

Before any new AAA photoreal remesh / material pass:

1. Ensure ≥ **100** real concert-goer **stage-angle** photos under `assets/refs/xhs/`
   - Prefer `nest/` for shared stage grounding
   - `wuxi/` when available for bowl/seat context
   - Keep `manifest.jsonl`
2. If 小红书 blocked → `STEER_ALT_SOURCES.md` (still ≥100)
3. Only then AAA pass grounded in those refs (Unreal-on-three / Blender→GLB→R3F leads in `docs/refs/X_PHOTOREAL_PROMPTS.md`)

Never build premature photoreal without photo grounding.
