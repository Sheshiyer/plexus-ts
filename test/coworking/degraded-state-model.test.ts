import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveCoWorkingDegradedStates } from '../../src/renderer/lib/coworkingModel';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking independent degraded states', () => {
  it('renders floor, room, room detail, device, lounge, and transport states independently', () => {
    const states = deriveCoWorkingDegradedStates({
      floorError: 'floor down',
      roomsError: 'rooms down',
      roomDetailError: 'detail down',
      deviceError: 'permission denied',
      loungeError: 'lounge down',
      transportState: 'degraded',
    });

    expect(states.title).toBe('Independent degraded states');
    expect(states.activeIssueCount).toBe(6);
    expect(states.signals.map((signal) => signal.kind)).toEqual([
      'floor',
      'rooms',
      'room_detail',
      'devices',
      'lounge',
      'transport',
    ]);
    expect(states.signals).toContainEqual(expect.objectContaining({
      kind: 'floor',
      level: 'blocked',
      message: 'Floor presence is unavailable; room controls remain available below.',
    }));
    expect(states.signals).toContainEqual(expect.objectContaining({
      kind: 'rooms',
      message: 'Project rooms are unavailable; lounge remains available.',
    }));
    expect(states.signals).toContainEqual(expect.objectContaining({
      kind: 'devices',
      message: 'Media device error; you can still leave or save closeout.',
    }));
    expect(states.signals).toContainEqual(expect.objectContaining({
      kind: 'transport',
      message: 'Live SFU transport unavailable; presence and metadata are still available.',
    }));
  });

  it('keeps transport deferred as its own non-global degraded state', () => {
    const states = deriveCoWorkingDegradedStates({ transportState: 'deferred' });

    expect(states.activeIssueCount).toBe(1);
    expect(states.signals.find((signal) => signal.kind === 'transport')).toMatchObject({
      level: 'deferred',
      message: 'Project media transport deferred; controls stay gated.',
    });
    expect(states.signals.filter((signal) => signal.kind !== 'transport')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'floor', level: 'ok' }),
        expect.objectContaining({ kind: 'rooms', level: 'ok' }),
        expect.objectContaining({ kind: 'room_detail', level: 'ok' }),
        expect.objectContaining({ kind: 'devices', level: 'ok' }),
        expect.objectContaining({ kind: 'lounge', level: 'ok' }),
      ]),
    );
  });

  it('wires the independent degraded state strip above local panels', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');
    const css = source('src/renderer/theme.css');

    expect(panel).toContain('deriveCoWorkingDegradedStates');
    expect(panel).toContain('<IndependentDegradedStatesPanel');
    expect(stage).toContain('Independent degraded states');
    expect(stage).toContain('px-degraded-signal');
    expect(css).toContain('.px-independent-degraded');
  });
});
