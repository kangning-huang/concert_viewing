# concert_viewing — restore-c941445

Source for the seat-view demo Ken prefers: the GitHub Pages build at `main@c941445`
("Adaptive AAA quality tiers (Ultra→Low) + ?quality= force", built on the Mac mini).

The original source lived only on the Mac mini LaCie (offline). It was not found on
this iMac (repos, iCloud, Google Drive, Downloads, `_incoming/` scaffold, git history —
the `source` branch is the later iMac redo). This tree is a **1:1 reconstruction from the
shipped bundle** `assets/index-DIDaugcb.js`: app code de-minified, vendor identifiers
mapped back to three r169 / R3F 8 / drei 9 / postprocessing 6.36.4 / React 18.3.1.
Rebuilding reproduces the original CSS, GLB-chunk and LED-image hashes byte-for-byte.

```
npm install
npm run dev              # http://localhost:5173/concert_viewing/?venue=wuxi
npm run build
node scripts/smoke.mjs dist <label> [--shots <prefix>]   # 390×844 phone smoke + frame times
```
