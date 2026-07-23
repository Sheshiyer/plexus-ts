#!/usr/bin/env node

const startedAt = Date.now();

await import('./smoke-assistant-context.mjs');
await import('./smoke-assistant-models.mjs');
await import('./smoke-assistant-daily-memory.mjs');
await import('./smoke-thoughtseed-bridge.mjs');

console.log(`assistant production smoke passed: runtime, model fallback, daily outbox, and bridge contracts deterministic in ${Date.now() - startedAt}ms`);
