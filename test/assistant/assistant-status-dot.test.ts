import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('AssistantStatusDot', () => {
  it('renders a dot with three tones and a details popover', () => {
    const dot = source('src/renderer/components/AssistantStatusDot.tsx');
    expect(dot).toContain("'ready' | 'local' | 'error'");
    expect(dot).toContain('px-clio-status-dot');
    expect(dot).toContain('px-clio-status-pop');
    expect(dot).toContain('onRefresh');
    // Popover carries the telemetry the old metric rails showed.
    expect(dot).toContain('provider');
    expect(dot).toContain('capabilityCount');
    expect(dot).toContain('contextGeneratedAt');
  });
});
