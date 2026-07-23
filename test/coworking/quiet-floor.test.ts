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
    // DegradedStatePanel occurrences in the panel are the import plus the two
    // unrelated, non-connection surfaces (roomsError, closeoutError).
    // roomDetailError's DegradedStatePanel moved into coworking/StudioStage.tsx
    // with FocusedRoomStage, and floorError's moved into
    // coworking/TeamBenchRail.tsx with the bench rail (Task 6 decomposition)
    // — both checked separately below.
    const degradedCount = (panel().match(/DegradedStatePanel/g) ?? []).length;
    expect(degradedCount).toBe(3); // import + roomsError + closeoutError
    expect(panel()).toMatch(/roomsError\s*&&\s*!isConnectionError\(roomsError\)/);

    const stage = source('src/renderer/components/coworking/StudioStage.tsx');
    expect(stage).toContain('DegradedStatePanel');

    const rail = source('src/renderer/components/coworking/TeamBenchRail.tsx');
    expect(rail).toContain('DegradedStatePanel');
    expect(rail).toMatch(/floorError\s*&&\s*!isConnectionError\(floorError\)/);
  });

  it('keeps floor structure visible while offline (quiet floor)', () => {
    expect(panel()).toContain('px-floor-quiet');

    // Moved into coworking/TeamBenchRail.tsx with the bench rail (Task 6
    // decomposition).
    const rail = source('src/renderer/components/coworking/TeamBenchRail.tsx');
    expect(rail).toContain('Team benches appear when the floor connects.');
  });

  it('navigates via the existing selectTab pattern, not a bespoke custom event', () => {
    expect(panel()).toContain('onOpenSettings');
    expect(panel()).not.toContain("plexus:navigate");
  });
});
