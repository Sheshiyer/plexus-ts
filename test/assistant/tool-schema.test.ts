import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_CONFIRM_REQUIRED_TOOLS,
  ASSISTANT_READ_ONLY_TOOLS,
  type AssistantToolId,
} from '../../src/shared/native-assistant';
import { buildAssistantToolSchemas } from '../../src/main/assistant-runtime';

describe('assistant tool schema builder', () => {
  it('includes only read-only tools for model answer generation by default', () => {
    const schemas = buildAssistantToolSchemas();

    expect(schemas.map((schema) => schema.id)).toEqual([...ASSISTANT_READ_ONLY_TOOLS]);
    expect(schemas.every((schema) => schema.safety === 'read_only')).toBe(true);
  });

  it('can include confirm-required tools for suggestion construction', () => {
    const schemas = buildAssistantToolSchemas({ includeActions: true });
    const ids = schemas.map((schema) => schema.id);
    const known = new Set<AssistantToolId>([
      ...ASSISTANT_READ_ONLY_TOOLS,
      ...ASSISTANT_CONFIRM_REQUIRED_TOOLS,
    ]);

    expect(ids).toEqual([...ASSISTANT_READ_ONLY_TOOLS, ...ASSISTANT_CONFIRM_REQUIRED_TOOLS]);
    expect(ids.every((id) => known.has(id))).toBe(true);
    expect(schemas.find((schema) => schema.id === 'app.generateStandup')).toMatchObject({
      safety: 'confirm_required',
      parameters: { type: 'object', additionalProperties: false },
    });
  });
});
