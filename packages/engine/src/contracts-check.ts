// Compile-time guard: the engine's exports must match the EngineApi contract exactly (names + types).
// If this file fails to typecheck, a module renamed or re-typed an export: fix the module, not this file.
import type { EngineApi } from './contracts.ts';
import * as engine from './index.ts';

const api: EngineApi = engine;
export default api;
