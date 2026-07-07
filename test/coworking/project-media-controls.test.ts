import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('project media controls (transport-deferred shell)', () => {
  it('renders mic, camera, and screen affordances with an honest deferred hint', () => {
    const controls = source('src/renderer/components/coworking/ProjectMediaControls.tsx');

    // The three deferred media affordances are present.
    expect(controls).toContain('Mic');
    expect(controls).toContain('Camera');
    expect(controls).toContain('Screen');

    // They gate on both an active project join and transport readiness.
    expect(controls).toContain('activeProjectJoin');
    expect(controls).toContain('transportReady');
    expect(controls).toMatch(/disabled=\{mediaDisabled\}/);

    // Honest hint copy for the deferred-transport state.
    expect(controls).toContain('ship with realtime media transport');
  });

  it('wires the controls into the focused stage behind the transport flag', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).toContain("from './coworking/ProjectMediaControls'");
    expect(panel).toContain('<ProjectMediaControls');
    expect(panel).toContain('PROJECT_MEDIA_TRANSPORT_READY');
    // Flag defaults to false until project-room media transport lands.
    expect(panel).toMatch(/PROJECT_MEDIA_TRANSPORT_READY\s*=\s*false/);
  });
});
