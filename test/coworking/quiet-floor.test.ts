import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('quiet floor / connection chip', () => {
  const panel = () => source('src/renderer/components/CoWorkingPanel.tsx');

  it('derives a single offline flag from connection-type errors', () => {
    expect(panel()).toContain('const floorOffline');
    expect(panel()).toContain('isConnectionError');
  });

  it('shows one amber chip in the telemetry bar instead of per-section panels', () => {
    expect(panel()).toContain('px-floor-offline-chip');
    // Worker-offline no longer renders a DegradedStatePanel for floorError/roomsError:
    // those two call sites now gate on `!isConnectionError(...)`. The remaining
    // DegradedStatePanel occurrences are the import plus the two unrelated,
    // non-connection surfaces (room-detail error, closeout error).
    const degradedCount = (panel().match(/DegradedStatePanel/g) ?? []).length;
    expect(degradedCount).toBe(5); // import + roomDetailError + roomsError + floorError + closeoutError
    expect(panel()).toMatch(/roomsError\s*&&\s*!isConnectionError\(roomsError\)/);
    expect(panel()).toMatch(/floorError\s*&&\s*!isConnectionError\(floorError\)/);
  });

  it('keeps floor structure visible while offline (quiet floor)', () => {
    expect(panel()).toContain('px-floor-quiet');
    expect(panel()).toContain('Team benches appear when the floor connects.');
  });

  it('navigates via the existing selectTab pattern, not a bespoke custom event', () => {
    expect(panel()).toContain('onOpenSettings');
    expect(panel()).not.toContain("plexus:navigate");
  });
});
