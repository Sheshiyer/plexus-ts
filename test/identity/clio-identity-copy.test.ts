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
});
