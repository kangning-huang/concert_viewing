# Steer: move mascots out of the audience (branch restore-c941445)

Ken reviewed the c941445 build (live at kangning-huang.github.io/concert_viewing) and said: "This one is much better. Remove the mascot blocking D3. No mascots should be placed in places that block audience. They are placed outside of the audience."

Work in this worktree (~/Documents/repos/concert_viewing_restore), branch restore-c941445, on top of 3d5a8f5. One job only:

1. Find every mascot / giant animal figure (万兽之王 inflatables, beasts, etc.) in the scene: src/stage, src/scene, venues.js, GLBs under public/stage/joker_xue_2026.
2. Re-place them so no mascot sits on or above any seat or floor block, or between any seat and the stage. They belong OUTSIDE the audience: on/behind the stage, beside the stage wings, or above/behind the top rim of the bowl, never in the seating volume. Apply to both Wuxi and Nest.
3. Verify with a check, not by eye only: for every seat POV hotspot (all floor blocks incl. D3, all 2xx/4xx sections) cast rays from the POV to the stage centre and main LED screen corners; assert no ray hits a mascot mesh. Add it to scripts/smoke.mjs (or a sibling) so it re-runs.
4. Keep everything else unchanged: Damai map, real LED photos, camera path/timing/damping.
5. Phone smoke test 390x844; save docs/refs/screenshots/restore_pov_wuxi_D3_phone.png and restore_pov_nest_D3_phone.png (or nearest D3 equivalent).
6. One commit. Do not push, do not touch GitHub Pages or the personal site.

Report: where each mascot was, where it is now, the ray-check result per section, commit sha.
