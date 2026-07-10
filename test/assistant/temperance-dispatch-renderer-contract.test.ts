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

  it('renders Agent Fabric lane diagnostics from the typed dispatch result', () => {
    const agentFabric = source('src/renderer/components/AgentFabricPanel.tsx');

    for (const marker of [
      'Temperance dispatch diagnostics',
      'dispatchLanes.diagnostics.activeTasks',
      'dispatchLanes.diagnostics.linkedSessionCount',
      'dispatchLanes.diagnostics.recommendationCount',
      'dispatchLanes.runtime.conflicts.length',
      'dispatchLanes.runtime.correlationIds.length',
      'dispatchLanes.runtime.localSmoke.ok',
      'dispatchLanes.runtime.conflicts.slice(0, 3)',
      'dispatchLanes.runtime.supportPacket.packetId',
      'redacted support packet',
      'Delegated conflict review',
      'local dispatch smoke',
      'Copy JSON',
      'Download JSON',
      'JSON.stringify(dispatchLanes.runtime.supportPacket, null, 2)',
      'dispatchLanes.sessionLinks.slice(0, 3)',
      'dispatchLanes.recentEvents.slice(0, 3)',
    ]) {
      expect(agentFabric).toContain(marker);
    }

    expect(agentFabric).not.toContain('JSON.stringify(dispatchLanes, null, 2)');
    expect(agentFabric).not.toContain('JSON.stringify(dispatchLanes.runtime, null, 2)');
    expect(agentFabric).not.toMatch(/sourcePath|repoRoot|skillHints|spawn_agent|secret/);
  });
});
