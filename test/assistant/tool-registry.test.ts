import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_CONFIRM_REQUIRED_TOOLS,
  ASSISTANT_READ_ONLY_TOOLS,
  type AssistantToolId,
} from '../../src/shared/native-assistant';

const ALL_TOOLS: AssistantToolId[] = [
  'context.projects',
  'context.entries',
  'context.reports',
  'context.sessions',
  'context.infra',
  'app.navigate',
  'app.generateStandup',
  'app.acceptSession',
  'app.startTimer',
  'app.syncProjects',
  'daily.sendEvent',
];

describe('assistant tool registry', () => {
  it('assigns every tool id to exactly one safety bucket', () => {
    const readOnly = new Set<AssistantToolId>(ASSISTANT_READ_ONLY_TOOLS);
    const confirmRequired = new Set<AssistantToolId>(ASSISTANT_CONFIRM_REQUIRED_TOOLS);

    for (const toolId of ALL_TOOLS) {
      const bucketCount = Number(readOnly.has(toolId)) + Number(confirmRequired.has(toolId));
      expect(bucketCount, toolId).toBe(1);
    }
  });
});
