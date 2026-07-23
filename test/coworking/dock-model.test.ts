import { describe, expect, it } from 'vitest';
import { deriveDockState, type DockJoinInput } from '../../src/renderer/lib/dock-model';

const loungeJoin = (over: Partial<DockJoinInput> = {}): DockJoinInput => ({
  scope: 'lounge', roomId: 'r-lounge', roomName: 'Ambient Lounge',
  hasSession: true, cloudflareConfigured: true, participantCount: 2,
  joinedAt: '2026-07-23T09:00:00.000Z', ...over,
});
const roomJoin = (over: Partial<DockJoinInput> = {}): DockJoinInput => ({
  scope: 'project_room', roomId: 'r-hz', roomName: 'HeyZack Landing',
  hasSession: true, cloudflareConfigured: false, participantCount: 3,
  joinedAt: '2026-07-23T09:05:00.000Z', ...over,
});

describe('deriveDockState', () => {
  it('is hidden when no join owns a session', () => {
    const state = deriveDockState({ joins: [roomJoin({ hasSession: false })], busy: null, wiringEnabled: true });
    expect(state.visible).toBe(false);
    expect(state.scope).toBeNull();
  });

  it('shows lounge context with transport ready', () => {
    const state = deriveDockState({ joins: [loungeJoin()], busy: null, wiringEnabled: true });
    expect(state).toMatchObject({
      visible: true, scope: 'lounge', contextLabel: 'Ambient Lounge',
      transportReady: true, participantCount: 2, joinedAt: '2026-07-23T09:00:00.000Z',
    });
    expect(state.micDisabled).toBe(false);
  });

  it('shows a project room with transport NOT ready when cloudflare is unconfigured', () => {
    const state = deriveDockState({ joins: [roomJoin()], busy: null, wiringEnabled: true });
    expect(state.visible).toBe(true);
    expect(state.contextLabel).toBe('HeyZack Landing');
    expect(state.transportReady).toBe(false);
  });

  it('kill switch forces transport not ready', () => {
    const state = deriveDockState({ joins: [loungeJoin()], busy: null, wiringEnabled: false });
    expect(state.transportReady).toBe(false);
  });

  it('busy keys disable only the matching control', () => {
    const state = deriveDockState({ joins: [loungeJoin()], busy: 'camera', wiringEnabled: true });
    expect(state.micDisabled).toBe(false);
    expect(state.cameraDisabled).toBe(true);
    expect(state.screenDisabled).toBe(false);
  });

  it('picks the session-owning join when multiple entries exist', () => {
    const state = deriveDockState({
      joins: [roomJoin({ hasSession: false }), loungeJoin()],
      busy: null, wiringEnabled: true,
    });
    expect(state.scope).toBe('lounge');
  });
});
