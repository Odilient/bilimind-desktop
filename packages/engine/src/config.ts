// Provider presets (deepseek default, openrouter fallback), key lookup (env, .env.local, %USERPROFILE%/.bilimind/config.json). Never print the key.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { LoadConfig } from './contracts.ts';

export const loadConfig: LoadConfig = () => { throw new Error('not implemented: loadConfig'); };
