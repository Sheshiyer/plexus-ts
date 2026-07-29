#!/usr/bin/env node

function fail(message) {
  console.error(`[verify:omniroute-release] ${message}`);
  process.exitCode = 1;
}

const configured = process.env.PLEXUS_OMNIROUTE_RELAY_ORIGIN?.trim();
let origin;
try {
  origin = configured ? new URL(configured) : null;
} catch {
  origin = null;
}

if (
  !configured
  || !origin
  || origin.protocol !== 'https:'
  || configured !== origin.origin
  || origin.pathname !== '/'
  || origin.search
  || origin.hash
) {
  fail('PLEXUS_OMNIROUTE_RELAY_ORIGIN must be supplied as a canonical HTTPS origin before production packaging or smoke.');
} else {
  console.log('[verify:omniroute-release] OmniRoute production relay origin configured.');
}
