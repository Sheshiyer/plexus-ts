#!/usr/bin/env node
process.env.PLEXUS_DB_PATH ||= ':memory:';

await import('./smoke-assistant-daily.mjs');
