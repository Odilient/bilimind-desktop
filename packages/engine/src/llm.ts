// OpenAI-compatible JSON call, port of LlmClient::json (engine-port §3.0). The ONLY place that calls a model.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { CallJson } from './contracts.ts';

export const callJson: CallJson = async () => { throw new Error('not implemented: callJson'); };
