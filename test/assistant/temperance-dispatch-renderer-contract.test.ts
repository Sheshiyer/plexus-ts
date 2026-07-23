import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('Temperance dispatch renderer contract', () => {
  it('surfaces dispatch recommendations in the Clio context drawer without raw skill dumps', () => {
    const assistantPanel = source('src/renderer/components/AssistantPanel.tsx');
    const contextDrawer = source('src/renderer/components/AssistantContextDrawer.tsx');

    expect(assistantPanel).toContain('window.plexus.thoughtseedDispatchLanes()');
    expect(assistantPanel).toContain("key: 'temperance'");
    expect(assistantPanel).toContain('temperanceRecommendations');
    expect(contextDrawer).toContain('temperance recommendations');
    expect(contextDrawer).toContain('recommendation.rationale');
    expect(contextDrawer).not.toMatch(/skillHints|sourcePath|repoRoot|spawn_agent|execute_document_command/);
  });

  // 'renders Agent Fabric lane diagnostics…' retired with AgentFabricPanel in
  // the Paperclip retirement (PR #116). Temperance dispatch recommendations
  // now surface only through the Clio context drawer, asserted above.
});
