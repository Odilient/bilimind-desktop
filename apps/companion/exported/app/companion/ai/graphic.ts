/**
 * Live graphics in the chat: what a `draw` action holds, and turning it into something
 * a browser shows safely. A 2D graphic is only ever shown through <img>, where SVG runs
 * nothing and loads nothing. A 3D one is data for `Scene.vue`, never code.
 */
export interface ScenePart {
  shape: 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'arrow'
  at: [number, number, number]
  size?: number[]
  to?: [number, number, number]
  rotate?: [number, number, number]
  color: string
  opacity?: number
  label?: string
}

export type AiGraphic =
  | { mode: '2d'; svg: string }
  | { mode: '3d'; caption?: string; parts: ScenePart[] }

/**
 * Close whatever a half-written SVG still has open, so it can be drawn as it grows.
 * The server has already cut it back to its last whole tag.
 */
export function closedSvg(svg: string): string {
  const open: string[] = []
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)(?:\s[^<>]*?)?(\/?)>/g)) {
    if (m[1]) open.pop()
    else if (!m[3]) open.push(m[2]!)
  }
  return svg + open.reverse().map((tag) => `</${tag}>`).join('')
}

export function svgUrl(svg: string): string {
  const named = /\bxmlns=/.test(svg) ? svg : svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(closedSvg(named))}`
}
