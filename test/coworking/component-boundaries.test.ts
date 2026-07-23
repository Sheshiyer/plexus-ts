import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('Co-working component boundaries', () => {
  it('keeps lifecycle ownership in the controller while delegating presentation', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    // PR #116 Studio Floor decomposition: the panel composes StudioStage,
    // LoungeStrip, MediaDock, and TeamBenchRail (plus the grafted compact
    // CoWorkingCompanion and extracted CoWorkingCloseoutModal) rather than
    // main's FocusedRoomStage/CoWorkingLoungeSection surfaces.
    expect(panel).toContain('<CoWorkingCompanion');
    expect(panel).toContain('<LoungeStrip');
    expect(panel).toContain('<CoWorkingCloseoutModal');
    expect(panel).toContain('<TeamBenchRail');
    expect(panel).toContain('<MediaDock');
    expect(panel).not.toContain('<ProjectRoomRail');
    expect(panel).toContain('<StudioStage');
    expect(panel).not.toContain('className="px-lounge-active"');
    expect(panel).not.toContain('<Modal');
  });

  it('keeps extracted presentation components outside native and service authority', () => {
    const components = [
      source('src/renderer/components/coworking/CoWorkingCompanion.tsx'),
      source('src/renderer/components/coworking/CoWorkingCloseoutModal.tsx'),
      source('src/renderer/components/coworking/StudioStage.tsx'),
      source('src/renderer/components/coworking/LoungeStrip.tsx'),
      source('src/renderer/components/coworking/MediaDock.tsx'),
      source('src/renderer/components/coworking/TeamBenchRail.tsx'),
    ];

    for (const component of components) {
      expect(component).not.toContain("from 'electron'");
      expect(component).not.toContain('window.plexus');
      expect(component).not.toContain('navigator.mediaDevices');
      expect(component).not.toContain('teamforge');
      expect(component).not.toContain('/database');
    }
  });

  it('keeps authenticated app-presence heartbeat authority in Electron main only', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const preload = source('src/preload/preload.ts');

    for (const candidate of [panel, preload]) {
      expect(candidate).not.toMatch(/presence:heartbeat|heartbeatCoworkingPresence|coworkingPresenceHeartbeat/);
    }
    expect(panel).not.toContain("newLocalId('coworking')");
  });

  it('keeps compact presentation callback-only and free of implicit capture actions', () => {
    const companion = source('src/renderer/components/coworking/CoWorkingCompanion.tsx');
    for (const forbidden of ['getUserMedia', 'getDisplayMedia', 'timerStart', 'recordingStart', 'realtimeJoinRoom']) {
      expect(companion).not.toContain(forbidden);
    }
  });

  it('bounds the ambient team rail without changing floor authority', () => {
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');

    expect(stage).toContain('cap = 6');
    expect(stage).toContain('floor.slice(0, cap)');
    expect(stage).toContain('presenceMap.totalPresent');
  });

  it('keeps one remote-audio layer at the same sibling position across modes', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const lounge = source('src/renderer/components/coworking/LoungeStrip.tsx');

    expect(panel.match(/<RemoteAudioSinks/g)).toHaveLength(1);
    expect(panel).toContain('const remoteAudioLayer = (');
    expect(panel.match(/\{remoteAudioLayer\}/g)).toHaveLength(2);
    expect(lounge).not.toContain('<RemoteAudioSinks');
  });
});
