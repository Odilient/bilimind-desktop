// Scenario path rules (engine-port 4 table, row 17): an option's next_id points at another step or is
// omitted/null/unknown to end there, so every path ends and reaches the debrief. A guard ends any path that
// loops back more than the step count allows.

export interface ScenarioOptionLike { id: string; correct: boolean; next_id?: string | null }
export interface ScenarioStepLike { id: string; options: ScenarioOptionLike[] }

export const maxPathLength = (steps: readonly ScenarioStepLike[]): number => Math.max(1, steps.length * 2);

/** The id of the step that follows `option`, or null when the scenario ends (debrief). */
export function nextStepId(steps: readonly ScenarioStepLike[], option: ScenarioOptionLike, pathLength: number): string | null {
  const id = option.next_id;
  if (!id || !steps.some(s => s.id === id)) return null;
  if (pathLength >= maxPathLength(steps)) return null;
  return id;
}

/** Every complete path (as option-id lists) from the first step; used by the tests to prove none dead-ends. */
export function allPaths(steps: readonly ScenarioStepLike[]): { path: string[]; ends: boolean }[] {
  const out: { path: string[]; ends: boolean }[] = [];
  const walk = (stepId: string | null, path: string[]) => {
    if (out.length > 5000) return;
    if (stepId === null) { out.push({ path, ends: true }); return; }
    const step = steps.find(s => s.id === stepId);
    if (!step || !step.options.length) { out.push({ path, ends: step ? false : true }); return; }
    for (const o of step.options) walk(nextStepId(steps, o, path.length + 1), [...path, `${step.id}:${o.id}`]);
  };
  walk(steps[0]?.id ?? null, []);
  return out;
}
