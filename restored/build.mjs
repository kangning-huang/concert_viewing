#!/usr/bin/env node
/* Applies the stage graphics upgrade to the restored interactive Pages build.
 *
 * That build's source is on the LaCie checkout and is not in this repo, so we
 * patch the shipped bundle at a pinned gh-pages commit. Every patch must match
 * exactly once or the build aborts.
 *
 * Usage (repo root): node restored/build.mjs [outDir] [--only=led,roof,fans,floor,haze]
 * Default outDir: dist/restored-pages/concert_viewing
 */
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const BASELINE_COMMIT = '4e441d7'
const BUNDLE = 'assets/index-DIDaugcb.js'
const LED_DIR = 'public/stage/joker_xue_2026/led'

const args = process.argv.slice(2)
const out = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'dist/restored-pages/concert_viewing')
const onlyArg = args.find((a) => a.startsWith('--only='))
const ALL = ['led', 'roof', 'fans', 'floor', 'haze']
const on = new Set(onlyArg ? onlyArg.slice(7).split(',').filter(Boolean) : ALL)

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
execSync(`git archive ${BASELINE_COMMIT} | tar -x -C "${out}"`, { stdio: 'inherit' })

let js = fs.readFileSync(path.join(out, BUNDLE), 'utf8')

function count(needle) {
  return js.split(needle).length - 1
}
function replace(needle, value) {
  if (count(needle) !== 1) throw new Error(`expected one match (${count(needle)}): ${needle.slice(0, 70)}`)
  js = js.replace(needle, () => value)
}
/* Replaces from `start` up to, but not including, the next `end`. */
function replaceSpan(start, end, value) {
  if (count(start) !== 1) throw new Error(`expected one start match (${count(start)}): ${start.slice(0, 70)}`)
  const a = js.indexOf(start)
  const b = js.indexOf(end, a + start.length)
  if (b < 0) throw new Error(`no end match: ${end.slice(0, 70)}`)
  js = js.slice(0, a) + value + js.slice(b)
}

const inject = fs.readFileSync(new URL('./stage_upgrade.js', import.meta.url), 'utf8')
replace('function YG({cue:n="title",motifs:e=wG}){', `${inject}\nfunction YG({cue:n="title",motifs:e=wG,quality:cvQ}){`)
replace('z.jsx(YG,{cue:i})', 'z.jsx(YG,{cue:i,quality:f})')

if (on.has('led')) {
  const crop = { face: '[1,.8,0,.1]', side: '[.49,1,.255,0]' }
  replaceSpan(
    '[8.05,-8.05].map(',
    'z.jsx("mesh",{geometry:u,',
    `[8.05,-8.05].map(f=>z.jsx(CVLedPanel,{position:[0,21,f],rotation:[0,f<0?Math.PI:0,0],w:45,h:13,uv:${crop.face},grid:cvTier(cvQ).grid,map:f<0?cvLedTextures(cvQ).back:cvLedTextures(cvQ).front,tint:cvTint(t.building,.42,1.3)},f)),` +
      `[23.05,-23.05].map(f=>z.jsx(CVLedPanel,{position:[f,21,0],rotation:[0,f>0?Math.PI/2:-Math.PI/2,0],w:9.8,h:13,uv:${crop.side},grid:cvTier(cvQ).grid,map:t.led==="title"||t.led==="red"?s:f>0?cvLedTextures(cvQ).right:cvLedTextures(cvQ).left,tint:cvTint(t.building,.3,1.25)},f)),`,
  )
  replace('plate:s,edge:t.edge,truss:r,h:20}', 'plate:cvLedTextures(cvQ).imag[p],edge:t.edge,truss:r,h:20,cvTint:cvTint(t.building,.28,1.25),cvGrid:cvTier(cvQ).grid}')
  replace('function KG({position:n,rotationY:e,plate:t,edge:i,truss:r,w:s=12,h:o=18,base:a=3}){', 'function KG({position:n,rotationY:e,plate:t,edge:i,truss:r,w:s=12,h:o=18,base:a=3,cvTint:cT,cvGrid:cG}){')
  replaceSpan(
    'z.jsxs("mesh",{position:[0,a+o/2,.05],',
    'z.jsxs("mesh",{position:[0,a+o/2,-.15],',
    'z.jsx(CVLedPanel,{position:[0,a+o/2,.05],w:s,h:o,map:t,tint:cT,grid:cG}),',
  )
}

const extras = []
if (on.has('roof')) extras.push('z.jsx(CVRoof,{q:cvQ,edge:t.edge,rainbow:n==="title"})')
if (on.has('fans')) extras.push('z.jsx(CVFans,{q:cvQ,color:t.beam})')
if (on.has('floor')) extras.push('z.jsx(CVFloor,{q:cvQ,color:t.light})')

if (on.has('haze')) {
  replace('z.jsx(jG,{color:t.light})', [...extras, 'z.jsx(CVHaze,{q:cvQ,color:t.light})'].join(','))
  replace('z.jsx(JG,{active:t.confetti})', 'z.jsx(JG,{active:t.confetti,count:Math.round(7e3*cvTier(cvQ).confetti)})')
} else if (extras.length) {
  replace('z.jsx(jG,{color:t.light})', [...extras, 'z.jsx(jG,{color:t.light})'].join(','))
}

const hash = createHash('sha256').update(js).digest('hex').slice(0, 8)
const name = `assets/index-restored-${hash}.js`
fs.writeFileSync(path.join(out, name), js)
fs.rmSync(path.join(out, BUNDLE))
const htmlPath = path.join(out, 'index.html')
const html = fs.readFileSync(htmlPath, 'utf8')
if (!html.includes(BUNDLE)) throw new Error('index.html does not reference the baseline bundle')
fs.writeFileSync(htmlPath, html.replace(BUNDLE, name))

if (on.has('led')) fs.cpSync(LED_DIR, path.join(out, 'stage/joker_xue_2026/led'), { recursive: true })
console.log(`built ${name} [${[...on].join(',') || 'baseline'}] -> ${out}`)
