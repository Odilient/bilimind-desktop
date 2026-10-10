// Learner words on screen: the engine's progress text says "chunk", "LLM" and so on; the app never shows those.
const SWAPS: [RegExp, string][] = [
  [/\bchunks\b/gi, 'passages'],
  [/\bchunk\b/gi, 'passage'],
  [/\bLLMs?\b/gi, 'AI'],
  [/\bpipeline\b/gi, 'run'],
  [/\bnodes\b/gi, 'steps'],
  [/\bnode\b/gi, 'step'],
  [/\btiers\b/gi, 'levels'],
  [/\btier\b/gi, 'level'],
];

export function learnerWords(text: string): string {
  let t = text;
  for (const [re, w] of SWAPS) t = t.replace(re, w);
  return t;
}

/** Remove anything that looks like a secret before it is shown or logged. */
export function redact(text: string): string {
  return text
    .replace(/\bsk-[A-Za-z0-9_\-]{4,}/g, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]');
}
