import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_ADMIN_ONLY_TOOLS,
  ASSISTANT_CONFIRM_REQUIRED_TOOLS,
  ASSISTANT_READ_ONLY_TOOLS,
  type AssistantToolId,
} from '../../src/shared/native-assistant';
import {
  getAssistantToolPermission,
  getAssistantToolSafety,
  listAssistantToolPermissions,
} from '../../src/main/assistant-permissions';

describe('assistant permission registry', () => {
  it('maps every known assistant tool to exactly one safety level', () => {
    const allTools = [
      ...ASSISTANT_READ_ONLY_TOOLS,
      ...ASSISTANT_CONFIRM_REQUIRED_TOOLS,
      ...ASSISTANT_ADMIN_ONLY_TOOLS,
    ];

    expect(new Set(allTools).size).toBe(allTools.length);
    expect(listAssistantToolPermissions().map((permission) => permission.toolId)).toEqual(allTools);
  });

  it('classifies context, app action, and admin tools', () => {
    expect(getAssistantToolSafety('context.projects')).toBe('read_only');
    expect(getAssistantToolPermission('app.startTimer')).toMatchObject({
      safety: 'confirm_required',
      requiresConfirmation: true,
      adminOnly: false,
    });
    expect(getAssistantToolPermission('admin.modelConfig')).toMatchObject({
      safety: 'admin_only',
      requiresConfirmation: false,
      adminOnly: true,
    });
  });

  it('rejects unknown tool ids defensively', () => {
    expect(() => getAssistantToolSafety('app.nope' as AssistantToolId)).toThrow('Unknown assistant tool');
  });
});
