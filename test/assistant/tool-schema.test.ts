import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_CONFIRM_REQUIRED_TOOLS,
  ASSISTANT_READ_ONLY_TOOLS,
  type AssistantToolId,
} from '../../src/shared/native-assistant';
import { buildAssistantCapabilityCatalog, buildAssistantToolSchemas, buildAssistantToolSet } from '../../src/main/assistant-runtime';

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

  it('builds a deterministic safety-aware capability catalog without secret fields', () => {
    const catalog = buildAssistantCapabilityCatalog(() => new Date('2026-07-22T10:00:00.000Z'));

    expect(catalog.schema).toBe('thoughtseed.plexus_assistant_capabilities.v1');
    expect(catalog.generatedAt).toBe('2026-07-22T10:00:00.000Z');
    expect(catalog.capabilities.map((item) => item.id)).toEqual([
      'admin.diagnostics',
      'admin.modelConfig',
      'app.acceptSession',
      'app.generateStandup',
      'app.navigate',
      'app.startTimer',
      'app.syncProjects',
      'context.entries',
      'context.infra',
      'context.projects',
      'context.reports',
      'context.sessions',
      'daily.sendEvent',
    ]);
    expect(catalog.capabilities.find((item) => item.id === 'app.startTimer')).toMatchObject({
      safety: 'confirm_required',
      requiresConfirmation: true,
      adminOnly: false,
      execution: 'intent',
      availability: 'available',
    });
    expect(catalog.capabilities.find((item) => item.id === 'admin.diagnostics')).toMatchObject({
      safety: 'admin_only',
      requiresConfirmation: false,
      adminOnly: true,
      execution: 'admin',
      availability: 'declared_only',
    });
    expect(catalog.capabilities.find((item) => item.id === 'daily.sendEvent')).toMatchObject({ availability: 'declared_only' });
    expect(JSON.stringify(catalog)).not.toMatch(/token|authorization|cookie|jwt|secret/i);
  });

  it('builds a keyed read-only ToolSet for the installed AI SDK', () => {
    const toolSet = buildAssistantToolSet();
    expect(Object.keys(toolSet)).toEqual([...ASSISTANT_READ_ONLY_TOOLS]);
    expect(toolSet['context.projects']).toMatchObject({
      description: 'Read bounded project metadata and repo verification state.',
    });
    expect((toolSet['context.projects'] as { inputSchema: { jsonSchema: unknown } }).inputSchema.jsonSchema).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
    });
    expect(typeof (toolSet['context.projects'] as { execute?: unknown }).execute).toBe('function');
    expect(toolSet['app.startTimer']).toBeUndefined();
    expect(toolSet['daily.sendEvent']).toBeUndefined();
    expect(toolSet['admin.diagnostics']).toBeUndefined();
  });
});
