import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Clio identity copy', () => {
  it('keeps the Identity page Clio-first with optional helper language', () => {
    const identityPanel = source('src/renderer/components/IdentityPanel.tsx');

    expect(identityPanel).toContain('Clio identity');
    expect(identityPanel).toMatch(/optional local helpers/i);
    expect(identityPanel).not.toContain('Unlocked capabilities');
    expect(identityPanel).not.toContain('Fabric Command');
    expect(identityPanel).not.toContain('paperclip companions');
    expect(identityPanel).not.toMatch(/\b(?:locked|unlocked)\b/i);
  });

  it('renders the Identity model as an open floating stage instead of a bordered card', () => {
    const theme = source('src/renderer/theme.css');

    expect(theme).toContain('.px-identity-hero .px-character-viewport');
    expect(theme).toMatch(/\.px-identity-hero \.px-character-viewport\{[^}]*border:0/);
    expect(theme).toMatch(/\.px-identity-hero \.px-character-model-note\{[^}]*background:transparent/);
  });

  it('aligns shell and settings copy around Clio and optional helpers', () => {
    const app = source('src/renderer/App.tsx');
    const admin = source('src/renderer/components/AdminDemoPanel.tsx');
    const proofCockpit = source('src/renderer/components/AdminProofCockpitPanel.tsx');
    const connectionStatus = source('src/renderer/components/ConnectionStatus.tsx');
    const agentSessions = source('src/renderer/components/AgentSessionsPanel.tsx');
    const settings = source('src/renderer/components/Settings.tsx');

    expect(app).toContain("label: 'Clio Today'");
    expect(app).toContain('ADMIN_PROOF_ROUTE_TARGET');
    expect(app).toContain('Open admin proof cockpit');
    expect(app).not.toContain("label: 'Focus'");
    expect(app).toContain("label: 'Clio Memories'");
    expect(app).not.toContain("label: 'Agent Sessions'");
    expect(connectionStatus).toContain('Clio status');
    expect(connectionStatus).not.toContain('Assistant status');
    expect(agentSessions).toContain('title="Clio Memories"');
    expect(agentSessions).not.toContain('title="Agent Sessions"');
    expect(settings).toContain("state: error ? 'attention' : 'optional'");
    expect(settings).not.toContain("state: error ? 'blocked' : 'ready'");
    expect(settings).toContain('Clio runtime');
    expect(admin).toContain("AdminSection = 'proof'");
    expect(admin).toContain('Founder Proof Cockpit');
    expect(admin).toContain('Proof first, diagnostics second');
    expect(admin).toContain('Admin employee test mode');
    expect(admin).toContain('not a live employee session');
    expect(proofCockpit).toContain('Project proof coverage');
    expect(proofCockpit).toContain('Coverage groups');
    expect(proofCockpit).toContain('Next founder actions');
    expect(proofCockpit).toContain('px-proof-coverage-strip');
    expect(proofCockpit).toContain('px-proof-first-grid');
    expect(admin).not.toContain('title="Admin Workspace"');
  });
});
