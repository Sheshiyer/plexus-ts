import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveProjectMediaHonesty } from '../../src/renderer/lib/coworkingModel';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('project media controls (transport-deferred shell)', () => {
  it('derives unjoined, deferred, and ready media honesty states', () => {
    expect(deriveProjectMediaHonesty()).toMatchObject({
      controlsVisible: true,
      activeProjectJoin: false,
      transportState: 'deferred',
      gated: true,
      audioEnabled: false,
      cameraEnabled: false,
      screenEnabled: false,
      primaryCopy: 'Drop in to enable project media.',
    });

    expect(deriveProjectMediaHonesty({ activeProjectJoin: true, transportReady: false })).toMatchObject({
      transportState: 'deferred',
      gated: true,
      primaryCopy: 'Project mic, camera & screen ship with realtime media transport.',
      gateCopy: 'Controls gated; no hidden publish until live SFU transport is connected.',
    });

    expect(deriveProjectMediaHonesty({ activeProjectJoin: true, transportReady: true })).toMatchObject({
      transportState: 'ready',
      gated: false,
      audioEnabled: true,
      cameraEnabled: true,
      screenEnabled: true,
      primaryCopy: 'Project media ready.',
    });

    expect(deriveProjectMediaHonesty({ activeProjectJoin: true, transportState: 'unavailable' })).toMatchObject({
      transportState: 'unavailable',
      gated: true,
      primaryCopy: 'Presence and track metadata recorded; live SFU media is not connected.',
      proofCopy: 'SFU live proof pending; local visual fallback is not live proof.',
    });
  });

  it('renders mic, camera, and screen affordances with an honest deferred hint', () => {
    const controls = source('src/renderer/components/coworking/ProjectMediaControls.tsx');
    const model = source('src/renderer/lib/coworkingModel.ts');

    // The three deferred media affordances are present.
    expect(controls).toContain('Mic');
    expect(controls).toContain('Camera');
    expect(controls).toContain('Screen');

    // They gate on the explicit honesty model.
    expect(controls).toContain('CoWorkingProjectMediaHonesty');
    expect(controls).toContain('honesty.gated');
    expect(controls).toMatch(/disabled=\{mediaDisabled\}/);

    // Honest hint copy for the deferred-transport state.
    expect(controls).toContain('transport {honesty.transportState}');
    expect(controls).toContain('True live SFU proof');
    expect(model).toContain('Project mic, camera & screen ship with realtime media transport.');
    expect(model).toContain('no hidden publish');
    expect(model).toContain('local visual fallback is not live proof');
  });

  it('wires the controls into the focused stage behind the transport flag', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');

    expect(stage).toContain("from './ProjectMediaControls'");
    expect(stage).toContain('<ProjectMediaControls');
    expect(panel).toContain('deriveProjectMediaHonesty');
    expect(panel).toContain('mediaTransportState');
    expect(panel).toContain("return 'unavailable'");
    expect(stage).toContain('mediaHonesty');
    expect(panel).toContain('PROJECT_MEDIA_TRANSPORT_READY');
    // Flag defaults to false until project-room media transport lands.
    expect(panel).toMatch(/PROJECT_MEDIA_TRANSPORT_READY\s*=\s*false/);
    expect(panel).toMatch(/PROJECT_SFU_LIVE_PROOF_VERIFIED\s*=\s*false/);
  });
});
