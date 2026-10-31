// Draws what an answer's `draw` action asks for, while the learner watches.
//
// Thinking is off: measured on the same question, first token in 1.2 s and done in 8.5 s; with low effort 15 to 33 s;
// the default spent 3,000 tokens and drew nothing. A graphic that takes half a minute isn't one in a conversation.
//
// A 3D scene is parts in a JSON list our own renderer draws, not code the model wrote, so nothing it says can run. An
// SVG is markup shown only through <img>, where a browser runs and loads nothing, and it is still checked because it
// is stored. A model told "output only the svg" still wraps it, so the graphic is cut out of whatever comes back.
import { partialJson } from './fence.ts'

export const SVG_PROMPT = `You draw one teaching graphic. Reply with one <svg viewBox="0 0 800 500"> element and nothing else: no prose, no code fences, no scripts, no links, no images.
- It shows the mechanism, using the real values in the brief. A learner should get the idea in five seconds.
- White or transparent background. Ink #0B0D10 for text, cobalt #2740E0 for what matters, lime #C8F04B for the one thing to look at, greys for the rest.
- font-family="system-ui, sans-serif". Text is at least 14 high. At most 40 words on it. Every label fits inside its box, nothing overlaps, and everything stays 24 from the edges.
- Draw in reading order, so that it makes sense as it appears.`

export const SCENE_PROMPT = `You build one 3D teaching scene from simple solids. Reply with JSON and nothing else:
{"caption":"one sentence on what it shows","parts":[{"shape":"box","at":[x,y,z],"size":[w,h,d],"rotate":[x,y,z],"color":"cobalt","opacity":1,"label":"short text"}]}
- The world runs from -10 to 10 on x and z, and y is up from a floor at 0. \`at\` is the centre of the part.
- shape is one of: box (size [w,h,d]), sphere (size [diameter]), cylinder (size [diameter,height]), cone (size [diameter,height]), torus (size [diameter,tube]), arrow (\`at\` is where it starts, and add "to":[x,y,z] instead of size).
- rotate is in degrees and optional. opacity is optional; use about 0.25 for a casing someone should see into.
- color is one of: cobalt, lime, ink, grey, white, red, amber, green, sky. Cobalt for what matters, lime for the one thing to look at.
- label is optional and at most 4 words. Label what the learner must name, not every part. Use the real values in the brief.
- Build real objects from several parts placed precisely, touching where they touch. At most 60 parts. No part floats unless the idea needs it.
- List parts in the order they should appear, biggest idea first.`

const SHAPES = ['box', 'sphere', 'cylinder', 'cone', 'torus', 'arrow']
const COLORS = ['cobalt', 'lime', 'ink', 'grey', 'white', 'red', 'amber', 'green', 'sky']
const MAX_PARTS = 60
const MAX_SVG_BYTES = 60_000
const UNSAFE = /<\s*(script|foreignObject|iframe|image|use)\b|\son\w+\s*=|(?:href|src)\s*=|javascript:|url\(\s*["']?\s*(?:https?:|\/\/)/i

export function finishedSvg(raw: string): Record<string, unknown> | null {
  const m = /<svg\b[\s\S]*<\/svg>/i.exec(raw)
  if (!m || Buffer.byteLength(m[0]) > MAX_SVG_BYTES) return null
  return UNSAFE.test(m[0]) ? null : { mode: '2d', svg: m[0] }
}

/** The SVG so far, cut back to the last whole tag: half of one would not parse. The client closes what is still open. */
export function partialSvg(raw: string): Record<string, unknown> | null {
  const start = raw.toLowerCase().indexOf('<svg')
  const end = raw.lastIndexOf('>')
  if (start < 0 || end < start) return null
  const svg = raw.slice(start, end + 1)
  return UNSAFE.test(svg) ? null : { mode: '2d', svg }
}

function vector(value: unknown, length: number, min = -30, max = 30): number[] | null {
  if (!Array.isArray(value) || value.length < length) return null
  const out: number[] = []
  for (const n of value.slice(0, length)) {
    if (n === null || n === '' || !Number.isFinite(Number(n))) return null
    out.push(Math.round(Math.max(min, Math.min(max, Number(n))) * 1000) / 1000)
  }
  return out
}

function partOf(p: Record<string, any>): Record<string, unknown> | null {
  const at = vector(p.at, 3)
  if (!SHAPES.includes(p.shape) || !at) return null
  const clean: Record<string, unknown> = { shape: p.shape, at, color: COLORS.includes(p.color) ? p.color : 'grey' }
  if (p.shape === 'arrow') {
    const to = vector(p.to, 3)
    if (!to) return null
    clean.to = to
  } else {
    const size = vector(p.size, p.shape === 'box' ? 3 : p.shape === 'sphere' ? 1 : 2, 0.01)
    if (!size) return null
    clean.size = size
  }
  const rotate = vector(p.rotate, 3, -360, 360)
  if (rotate) clean.rotate = rotate
  if (typeof p.opacity === 'number') clean.opacity = Math.max(0.05, Math.min(1, p.opacity))
  if (typeof p.label === 'string' && p.label.trim()) clean.label = p.label.trim().slice(0, 40)
  return clean
}

/** A scene, whole or half-written, keeping only what the renderer knows: a part that makes no sense is dropped, the rest is still worth seeing. */
export function sceneOf(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{')
  if (start < 0) return null
  const data = partialJson(raw.slice(start))
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const parts: Record<string, unknown>[] = []
  for (const part of Array.isArray(data.parts) ? data.parts : []) {
    const clean = part && typeof part === 'object' ? partOf(part) : null
    if (clean) parts.push(clean)
    if (parts.length === MAX_PARTS) break
  }
  return parts.length ? { mode: '3d', caption: typeof data.caption === 'string' ? data.caption.trim().slice(0, 240) : '', parts } : null
}
