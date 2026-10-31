// The answer streams as prose, except its ```actions block, which the learner should see as cards, never as JSON
// typing itself out. And that block read while it is half written.

export const FENCE = '```actions'

/**
 * Everything before the fence goes out as it arrives. The fence can arrive split across pieces ("…ready.\n``" then
 * "`actions\n["), so a tail that could still become it is held back until the next piece settles it. From the fence
 * on, nothing is released.
 */
export class FenceGate {
  private text = ''
  private released = 0
  private shut = false

  /** Take the next piece; return what may be shown now. */
  push(piece: string): string {
    this.text += piece
    if (this.shut) return ''
    const from = Math.max(0, this.released - FENCE.length)
    const at = this.text.toLowerCase().indexOf(FENCE, from)
    if (at >= 0) {
      this.shut = true
      return this.release(at)
    }
    return this.release(this.text.length - this.pending())
  }

  /** The stream ended: a tail held back because it might have become the fence is released. */
  flush(): string {
    return this.shut ? '' : this.release(this.text.length)
  }

  /** What has arrived after the fence, while the actions block is being written. */
  fenced(): string | null {
    return this.shut ? this.text.slice(this.released + FENCE.length) : null
  }

  private pending(): number {
    const lower = this.text.toLowerCase()
    for (let k = Math.min(FENCE.length - 1, lower.length); k > 0; k--) {
      if (lower.endsWith(FENCE.slice(0, k))) return k
    }
    return 0
  }

  private release(upTo: number): string {
    if (upTo <= this.released) return ''
    const out = this.text.slice(this.released, upTo)
    this.released = upTo
    return out
  }
}

/** The JSON so far, closed as far as it has got, or null when nothing is readable yet. */
export function partialJson(soFar: string): any {
  const start = soFar.search(/[{[]/)
  if (start < 0) return null
  const closers: string[] = []
  let inString = false
  let escaped = false
  let end = soFar.length
  for (let i = start; i < soFar.length; i++) {
    const ch = soFar[i]!
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') closers.push('}')
    else if (ch === '[') closers.push(']')
    else if (ch === '}' || ch === ']') {
      closers.pop()
      // Whole: whatever follows (the fence's closing ```) is not JSON.
      if (!closers.length) {
        end = i + 1
        break
      }
    }
  }
  let body = soFar.slice(start, end)
  if (inString) {
    // A cut in the middle of an escape ("\", "\u00") would break the string it sits in.
    const cut = /\\(?:u[0-9a-fA-F]{0,3})?$/.exec(body)
    if (cut) {
      let before = 0
      while (body[cut.index - 1 - before] === '\\') before++
      if (before % 2 === 0) body = body.slice(0, cut.index)
    }
    body += '"'
  }
  const closing = closers.reverse().join('')
  // Each pass drops one unreadable tail: `,`, `"key":`, `"key"`, `-1.`, `tru`. Four is the most a cut can leave.
  for (let pass = 0; pass < 4; pass++) {
    try {
      const decoded = JSON.parse(body.trimEnd() + closing)
      if (decoded && typeof decoded === 'object') return decoded
    } catch { /* drop a tail and try again */ }
    body = body.trimEnd().replace(/(?:,|:|"(?:[^"\\]|\\.)*"\s*:?|[-+.\w]+)\s*$/, '')
  }
  return null
}
