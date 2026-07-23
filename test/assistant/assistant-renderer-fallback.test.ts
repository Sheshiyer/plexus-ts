import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const modalSource = readFileSync(
  path.resolve(process.cwd(), 'src/renderer/components/AssistantActionConfirmModal.tsx'),
  'utf8',
);

describe('assistant renderer action confirmation', () => {
  it('does not run write-capable fallbacks without a persisted assistant intent', () => {
    expect(modalSource).toContain('Assistant action requires a persisted intent');
    expect(modalSource).not.toContain('runLocalFallback');
    for (const forbiddenCall of [
      'standupGenerate(',
      'agentSessionAccept(',
      'timerStart(',
      'projectsSync(',
      'dispatchEvent(new CustomEvent',
    ]) {
      expect(modalSource).not.toContain(forbiddenCall);
    }
  });
});
