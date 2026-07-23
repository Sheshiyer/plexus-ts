import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('AssistantPanel chat-first layout', () => {
  const panel = () => source('src/renderer/components/AssistantPanel.tsx');

  it('drops the metric rails, page header, and thread list', () => {
    expect(panel()).not.toContain('MetricRailGroup');
    expect(panel()).not.toContain('STARTER_CONVERSATIONS');
    expect(panel()).not.toContain('seedMessages');
    expect(panel()).not.toContain('PageHeader');
  });

  it('uses one stable conversation id and a Clio welcome', () => {
    expect(panel()).toContain("const CLIO_CONVERSATION_ID = 'clio'");
    expect(panel()).toContain("I'm Clio.");
  });

  it('renders status dot, context toggle, and suggestion chips', () => {
    expect(panel()).toContain('<AssistantStatusDot');
    expect(panel()).toContain('<AssistantSuggestionChips');
    expect(panel()).not.toContain('<AssistantSuggestionRail');
    expect(panel()).toContain('contextOpen');
  });

  it('humanizes tool events through the thread model', () => {
    expect(panel()).toContain("humanizeToolEvent(event.toolId, 'call')");
    expect(panel()).toContain("humanizeToolEvent(event.toolId, 'result')");
  });

  it('user-visible surface says Clio, not Assistant', () => {
    expect(panel()).not.toMatch(/title="Assistant"/);
    expect(panel()).toContain('<strong>Clio</strong>');
  });
});

describe('side chat sizing', () => {
  it('removes the display:none surface hacks and the 42vh cap', () => {
    const css = source('src/renderer/theme.css');
    expect(css).not.toContain('minmax(260px,42vh)');
    expect(css).not.toMatch(/surface-sidechat[^}]*\.pxds-panel:first-child\{display:none\}/);
  });
});

describe('message chrome', () => {
  it('drops per-message status chips and metadata lines', () => {
    const list = source('src/renderer/components/AssistantMessageList.tsx');
    expect(list).not.toContain('StatusChip');
    expect(list).not.toContain('metadataLine');
  });

  it('renders tool messages as compact rows with toolId tooltip', () => {
    const list = source('src/renderer/components/AssistantMessageList.tsx');
    expect(list).toContain('px-clio-tool-row');
    expect(list).toContain('title={message.toolId');
  });
});
