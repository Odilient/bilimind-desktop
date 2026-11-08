/**
 * A course's picture on its cover (`CompanionCourseCover`): a glyph from the
 * pack below, one emoji the learner typed, or a picture they uploaded
 * (`img:<name>`, a name only the server gives), kept in `subjects.icon`.
 *
 * With nothing picked, the title chooses: "Psychology 101" gets the brain,
 * "World history since 1900" the columns. A title that says nothing we know
 * keeps its initials, which is what every cover was before.
 *
 * The glyphs are drawn by `CompanionIcon` (its own set, or `UiIcon`'s), so a
 * key here is always a name that component draws.
 */

export interface CourseIconChoice {
  /** A `CompanionIcon` name. */
  key: string
  /** What it reads as, for the picker's labels. */
  label: string
}

/** The pack, in the order the picker lays it out (eight to a row). */
export const COURSE_ICONS: CourseIconChoice[] = [
  { key: 'book', label: 'Book' },
  { key: 'cap', label: 'Graduation' },
  { key: 'brain', label: 'Mind' },
  { key: 'bulb', label: 'Ideas' },
  { key: 'flask', label: 'Chemistry' },
  { key: 'atom', label: 'Physics' },
  { key: 'dna', label: 'Biology' },
  { key: 'heart-pulse', label: 'Medicine' },
  { key: 'sigma', label: 'Maths' },
  { key: 'chart', label: 'Statistics' },
  { key: 'calculator', label: 'Accounting' },
  { key: 'coins', label: 'Finance' },
  { key: 'code', label: 'Code' },
  { key: 'terminal', label: 'Computers' },
  { key: 'puzzle', label: 'Logic' },
  { key: 'briefcase', label: 'Business' },
  { key: 'quill', label: 'Writing' },
  { key: 'speech', label: 'Languages' },
  { key: 'landmark', label: 'History' },
  { key: 'scales', label: 'Law' },
  { key: 'globe', label: 'Geography' },
  { key: 'leaf', label: 'Nature' },
  { key: 'building', label: 'Architecture' },
  { key: 'rocket', label: 'Space' },
  { key: 'palette', label: 'Art' },
  { key: 'music', label: 'Music' },
  { key: 'camera', label: 'Photography' },
  { key: 'film', label: 'Film' },
  { key: 'chef', label: 'Cooking' },
  { key: 'dumbbell', label: 'Sport' },
  { key: 'compass', label: 'Travel' },
  { key: 'star', label: 'Anything' },
]

const KEYS = new Set(COURSE_ICONS.map((i) => i.key))

/**
 * Words in a title and the glyph they call for, the first match winning, so
 * the narrower subject comes first ("World history" is history, not the
 * world; "Biology: the human body" is biology). Each stem matches at the
 * start of a word, so `bio` finds "Biology" and `bee` "Beekeeping".
 */
const GUESSES: [string, RegExp][] = [
  ['code', /\b(program|coding|code\b|sql|python|javascript|typescript|java\b|software|web dev|databas|algorithm|artificial intel|machine learn|ai\b)/i],
  ['terminal', /\b(comput|network|linux|unix|devops|cyber|cloud)/i],
  ['brain', /\b(psych|neuro|mind|cognit|memory|learning how to learn)/i],
  ['dna', /\b(bio|genet|cell\b)/i],
  ['heart-pulse', /\b(medic|nurs|health|anatom|physiol|human body|first aid)/i],
  ['flask', /\b(chem|lab\b)/i],
  ['atom', /\b(physic|quantum|mechanic)/i],
  ['rocket', /\b(space|astro|aero|rocket)/i],
  ['landmark', /\b(histor|politic|civic|govern|archaeolog|ancient)/i],
  ['scales', /\b(law\b|legal|justice|ethic)/i],
  ['chart', /\b(statist|data\b|analytic|econom|probabil)/i],
  ['sigma', /\b(math|calcul|algebra|geometr|trigon|arithmetic)/i],
  ['calculator', /\b(account|bookkeep|tax)/i],
  ['coins', /\b(financ|money|invest|bank|crypto|budget)/i],
  ['briefcase', /\b(business|manag|marketing|career|entrepreneur|startup|sales\b|interview)/i],
  ['quill', /\b(writ|essay|literat|poet|poem|novel|story)/i],
  ['speech', /\b(language|english|italian|spanish|french|german|uzbek|russian|chinese|mandarin|japanese|korean|arabic|turkish|portuguese|vocab|speak|ielts|toefl|grammar)/i],
  ['palette', /\b(art\b|arts\b|paint|draw|design|illustrat|watercolo|sketch)/i],
  ['music', /\b(music|piano|guitar|singing|song|violin|drum)/i],
  ['camera', /\b(photo)/i],
  ['film', /\b(film|cinema|movie|video)/i],
  ['chef', /\b(cook|bak|cuisine|food|nutrition|recipe|chef)/i],
  ['dumbbell', /\b(sport|fitness|gym|yoga|running|football|swim|exercise)/i],
  ['building', /\b(architect|civil eng|construct|interior)/i],
  ['leaf', /\b(bee|garden|botan|plant|ecolog|nature|environment|agri|climate|farm)/i],
  ['globe', /\b(geograph|world|international|global|countr)/i],
  ['compass', /\b(travel|navigat|explor|hiking)/i],
  ['puzzle', /\b(logic|puzzle|chess|game)/i],
  ['bulb', /\b(philosoph|creativ|innovat|idea|critical thinking)/i],
  ['cap', /\b(exam|university|college|degree|admission|sat\b|gre\b|gmat)/i],
  ['book', /\b(read|book|library)/i],
]

/** The glyph a title calls for, or null when it says nothing we know. */
export function guessIcon(title: string): string | null {
  return GUESSES.find(([, words]) => words.test(title))?.[0] ?? null
}

export type CoverPicture =
  | { kind: 'glyph'; key: string }
  | { kind: 'emoji'; text: string }
  | { kind: 'image'; name: string }
  | { kind: 'initials' }

/** An uploaded picture's name in `icon`, as the server writes it (SubjectLogoController). */
const IMAGE = /^img:([0-9a-f]{28})$/

/**
 * What a cover draws: the uploaded picture, the picked glyph or emoji, else
 * the title's guess, else the initials. An `icon` that is none of the others
 * is the learner's emoji.
 */
export function coverPicture(subject: { icon?: string | null; title: string }): CoverPicture {
  const icon = subject.icon?.trim()
  const image = icon?.match(IMAGE)?.[1]
  if (image) return { kind: 'image', name: image }
  if (icon) return KEYS.has(icon) ? { kind: 'glyph', key: icon } : { kind: 'emoji', text: icon }
  const guess = guessIcon(subject.title)
  return guess ? { kind: 'glyph', key: guess } : { kind: 'initials' }
}

/**
 * The first emoji (or, failing one, the first character) of what was typed,
 * so a pasted "🐝 bees" keeps the bee. Grapheme-aware, so a flag or a family
 * stays whole; null for nothing.
 */
export function firstEmoji(text: string): string | null {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text.trim())].map((s) => s.segment)
  return graphemes.find((g) => /\p{Extended_Pictographic}/u.test(g)) ?? graphemes[0] ?? null
}

/** Where an uploaded picture's bytes are: public by name, so an <img> needs no token. */
export function coverImageUrl(name: string): string {
  return `${apiBaseUrl().replace(/\/+$/, '')}/companion-logos/${name}`
}
