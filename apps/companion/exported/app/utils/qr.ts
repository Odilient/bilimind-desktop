/**
 * A QR encoder, hand-rolled, because the tracking-links screen needs one and
 * nothing else in this bundle does.
 *
 * A library would be the obvious call and is the wrong one at this size: the
 * smallest maintained option is ~12 kB gzipped and brings a canvas renderer we
 * would not use — the codes here are drawn as inline SVG so they print, scale
 * and theme like everything else on the page.
 *
 * Scope is deliberately narrow, and the narrowness is what keeps this honest:
 * **byte mode, error correction level L, versions 1–5**. Those five versions
 * are exactly the ones with a single error-correction block, which removes the
 * interleaving table that is most of a general encoder's weight. It stops at
 * five for that reason and no other: version 6 at level L is two blocks, and
 * version 7 adds the version-information strips as well. 106 bytes is the
 * ceiling; a tracking URL is around thirty-five and a printed source's deep
 * link around forty. Anything longer returns `null` and the caller shows the
 * link instead of a code that would not scan — survivable on a card in the ads
 * screen, and a thousand ruined posters in print, which is why the ceiling was
 * raised rather than left at version 4's 78.
 *
 * Verified against a reference implementation for the URL shapes this product
 * generates, and every code it produces carries its own quiet zone.
 */

/** Total data codewords at EC level L, indexed by version. */
const DATA_CODEWORDS_L: Record<number, number> = { 1: 19, 2: 34, 3: 55, 4: 80, 5: 108 }

/** EC codewords per block at level L. One block for every version here. */
const EC_CODEWORDS_L: Record<number, number> = { 1: 7, 2: 10, 3: 15, 4: 20, 5: 26 }

/**
 * Single alignment-pattern centre for versions 2–5; version 1 has none.
 *
 * Versions 2–6 list two alignment coordinates, {6, n}, and three of the four
 * intersections are swallowed by the finder patterns — so exactly one pattern
 * is drawn, at (n, n), and one number is the whole table.
 */
const ALIGNMENT_CENTRE: Record<number, number | null> = { 1: null, 2: 18, 3: 22, 4: 26, 5: 30 }

/* ------------------------------------------------------------------ GF(256) */

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)

;(() => {
  let x = 1
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    // 0x11d is the QR field's primitive polynomial.
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255]!
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a]! + LOG[b]!]!
}

/** Reed–Solomon generator polynomial of the given degree. */
function generator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j += 1) {
      next[j] = (next[j] ?? 0) ^ gfMul(poly[j]!, 1)
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j]!, EXP[i]!)
    }
    poly = next
  }
  return poly
}

function remainder(data: number[], degree: number): number[] {
  const gen = generator(degree)
  const result = new Array<number>(degree).fill(0)

  for (const byte of data) {
    const factor = byte ^ (result[0] ?? 0)
    result.shift()
    result.push(0)
    for (let i = 0; i < degree; i += 1) {
      result[i] = (result[i] ?? 0) ^ gfMul(gen[i + 1]!, factor)
    }
  }

  return result
}

/* --------------------------------------------------------------- bit stream */

class Bits {
  readonly values: number[] = []

  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i -= 1) this.values.push((value >>> i) & 1)
  }

  get length(): number {
    return this.values.length
  }
}

/* ------------------------------------------------------------------ modules */

type Grid = (0 | 1 | null)[][]

function blank(size: number): Grid {
  return Array.from({ length: size }, () => new Array<0 | 1 | null>(size).fill(null))
}

function placeFinder(grid: Grid, row: number, column: number): void {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const y = row + r
      const x = column + c
      if (y < 0 || x < 0 || y >= grid.length || x >= grid.length) continue

      const onRing = r === 0 || r === 6 || c === 0 || c === 6
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4
      const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6

      grid[y]![x] = inside && (onRing || inCore) ? 1 : 0
    }
  }
}

function placeAlignment(grid: Grid, centre: number): void {
  for (let r = -2; r <= 2; r += 1) {
    for (let c = -2; c <= 2; c += 1) {
      const ring = Math.max(Math.abs(r), Math.abs(c))
      grid[centre + r]![centre + c] = ring === 1 ? 0 : 1
    }
  }
}

function reserveFormat(grid: Grid): boolean[][] {
  const size = grid.length
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))

  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (grid[i]![j] !== null) reserved[i]![j] = true
    }
  }

  // The two format-information strips, plus the always-dark module.
  for (let i = 0; i < 9; i += 1) {
    reserved[8]![i] = true
    reserved[i]![8] = true
  }
  for (let i = 0; i < 8; i += 1) {
    reserved[size - 1 - i]![8] = true
    reserved[8]![size - 1 - i] = true
  }

  return reserved
}

function maskBit(mask: number, row: number, column: number): boolean {
  switch (mask) {
    case 0:
      return (row + column) % 2 === 0
    case 1:
      return row % 2 === 0
    case 2:
      return column % 3 === 0
    case 3:
      return (row + column) % 3 === 0
    case 4:
      return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0
    case 5:
      return ((row * column) % 2) + ((row * column) % 3) === 0
    case 6:
      return (((row * column) % 2) + ((row * column) % 3)) % 2 === 0
    default:
      return (((row + column) % 2) + ((row * column) % 3)) % 2 === 0
  }
}

/** 15-bit format information: EC level L (01) plus the mask, BCH(15,5)-coded. */
function formatBits(mask: number): number {
  const data = (0b01 << 3) | mask
  let rem = data

  for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)

  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412
}

function penalty(grid: Grid): number {
  const size = grid.length
  let score = 0

  const run = (get: (a: number, b: number) => number): void => {
    for (let a = 0; a < size; a += 1) {
      let last = -1
      let length = 0
      for (let b = 0; b < size; b += 1) {
        const value = get(a, b)
        if (value === last) {
          length += 1
        } else {
          if (length >= 5) score += 3 + (length - 5)
          last = value
          length = 1
        }
      }
      if (length >= 5) score += 3 + (length - 5)
    }
  }

  run((a, b) => grid[a]![b] ?? 0)
  run((a, b) => grid[b]![a] ?? 0)

  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = grid[r]![c]
      if (v === grid[r]![c + 1] && v === grid[r + 1]![c] && v === grid[r + 1]![c + 1]) score += 3
    }
  }

  const finderish = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]
  const matches = (values: number[]): boolean =>
    values.length === 11 && values.every((value, index) => value === finderish[index])

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c <= size - 11; c += 1) {
      const row: number[] = []
      const column: number[] = []
      for (let i = 0; i < 11; i += 1) {
        row.push(grid[r]![c + i] ?? 0)
        column.push(grid[c + i]![r] ?? 0)
      }
      if (matches(row)) score += 40
      if (matches(column)) score += 40
    }
  }

  let dark = 0
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) dark += grid[r]![c] ?? 0
  }
  const ratio = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10

  return score
}

/**
 * Encode `text` as a matrix of booleans, or `null` when it does not fit in
 * versions 1–5 at level L.
 */
export function encodeQr(text: string): boolean[][] | null {
  const bytes = Array.from(new TextEncoder().encode(text))

  const version = [1, 2, 3, 4, 5].find((candidate) => {
    const capacity = DATA_CODEWORDS_L[candidate]!
    // 4 mode bits + 8 length bits + payload, rounded up to whole codewords.
    return Math.ceil((4 + 8 + bytes.length * 8) / 8) <= capacity
  })

  if (version === undefined) return null

  const dataCodewords = DATA_CODEWORDS_L[version]!
  const ecCodewords = EC_CODEWORDS_L[version]!

  const bits = new Bits()
  bits.push(0b0100, 4)
  bits.push(bytes.length, 8)
  for (const byte of bytes) bits.push(byte, 8)

  const capacityBits = dataCodewords * 8
  bits.push(0, Math.min(4, capacityBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(0, 1)

  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits.values[i + j]!
    codewords.push(byte)
  }

  const padding = [0xec, 0x11]
  let padIndex = 0
  while (codewords.length < dataCodewords) {
    codewords.push(padding[padIndex % 2]!)
    padIndex += 1
  }

  const full = [...codewords, ...remainder(codewords, ecCodewords)]

  const size = version * 4 + 17
  const base = blank(size)

  placeFinder(base, 0, 0)
  placeFinder(base, 0, size - 7)
  placeFinder(base, size - 7, 0)

  for (let i = 8; i < size - 8; i += 1) {
    const value: 0 | 1 = i % 2 === 0 ? 1 : 0
    base[6]![i] = value
    base[i]![6] = value
  }

  const centre = ALIGNMENT_CENTRE[version]
  if (centre !== null && centre !== undefined) placeAlignment(base, centre)

  base[size - 8]![8] = 1

  const reserved = reserveFormat(base)

  // Data first, unmasked, in the two-module-wide zig-zag the spec fixes; the
  // masks are then XORed over a copy, which is eight cheap passes rather than
  // eight repetitions of the placement walk.
  const placed = base.map((row) => [...row])
  let bit = 0

  for (let right = size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern; the pair shifts left past it.
    if (right === 6) right = 5

    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let j = 0; j < 2; j += 1) {
        const column = right - j
        const upward = ((right + 1) & 2) === 0
        const row = upward ? size - 1 - vertical : vertical

        if (reserved[row]![column]) continue

        const byte = full[bit >> 3] ?? 0
        placed[row]![column] = (((byte >>> (7 - (bit & 7))) & 1) === 1 ? 1 : 0) as 0 | 1
        bit += 1
      }
    }
  }

  let best: Grid | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (let mask = 0; mask < 8; mask += 1) {
    const grid = placed.map((row) => [...row])

    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (reserved[row]![column]) continue
        if (maskBit(mask, row, column)) grid[row]![column] = (grid[row]![column] === 1 ? 0 : 1) as 0 | 1
      }
    }

    const format = formatBits(mask)
    for (let i = 0; i < 15; i += 1) {
      const value: 0 | 1 = ((format >>> i) & 1) === 1 ? 1 : 0

      if (i < 6) grid[i]![8] = value
      else if (i === 6) grid[7]![8] = value
      else if (i === 7) grid[8]![8] = value
      else if (i === 8) grid[8]![7] = value
      else grid[8]![14 - i] = value

      if (i < 8) grid[8]![size - 1 - i] = value
      else grid[size - 15 + i]![8] = value
    }

    const score = penalty(grid)
    if (score < bestScore) {
      bestScore = score
      best = grid
    }
  }

  return best?.map((row) => row.map((cell) => cell === 1)) ?? null
}

/**
 * The matrix as one SVG path, plus the side of the (quiet-zone padded) canvas.
 * One path rather than N rects: a version-5 code is 1369 modules, and 1369
 * elements is a scroll-janking amount of DOM for a 120px square.
 */
export function qrPath(text: string, quietZone = 2): { path: string; size: number } | null {
  const matrix = encodeQr(text)
  if (!matrix) return null

  const modules = matrix.length
  const size = modules + quietZone * 2
  const parts: string[] = []

  for (let r = 0; r < modules; r += 1) {
    for (let c = 0; c < modules; c += 1) {
      if (matrix[r]![c]) parts.push(`M${c + quietZone} ${r + quietZone}h1v1h-1z`)
    }
  }

  return { path: parts.join(''), size }
}
