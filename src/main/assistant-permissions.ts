import {
  ASSISTANT_ADMIN_ONLY_TOOLS,
  ASSISTANT_CONFIRM_REQUIRED_TOOLS,
  ASSISTANT_READ_ONLY_TOOLS,
  type AssistantToolId,
  type AssistantToolSafety,
} from '../shared/native-assistant.js';

export interface AssistantToolPermission {
  toolId: AssistantToolId;
  safety: AssistantToolSafety;
  requiresConfirmation: boolean;
  adminOnly: boolean;
}

const TOOL_SAFETY = new Map<AssistantToolId, AssistantToolSafety>([
  ...ASSISTANT_READ_ONLY_TOOLS.map((toolId) => [toolId, 'read_only'] as const),
  ...ASSISTANT_CONFIRM_REQUIRED_TOOLS.map((toolId) => [toolId, 'confirm_required'] as const),
  ...ASSISTANT_ADMIN_ONLY_TOOLS.map((toolId) => [toolId, 'admin_only'] as const),
]);

export function getAssistantToolSafety(toolId: AssistantToolId): AssistantToolSafety {
  const safety = TOOL_SAFETY.get(toolId);
  if (!safety) throw new Error(`Unknown assistant tool: ${toolId}`);
  return safety;
}

export function getAssistantToolPermission(toolId: AssistantToolId): AssistantToolPermission {
  const safety = getAssistantToolSafety(toolId);
  return {
    toolId,
    safety,
    requiresConfirmation: safety === 'confirm_required',
    adminOnly: safety === 'admin_only',
  };
}

export function listAssistantToolPermissions(): AssistantToolPermission[] {
  return [...TOOL_SAFETY.keys()].map(getAssistantToolPermission);
}

export function isAssistantReadOnlyTool(toolId: AssistantToolId): boolean {
  return getAssistantToolSafety(toolId) === 'read_only';
}

export function isAssistantConfirmRequiredTool(toolId: AssistantToolId): boolean {
  return getAssistantToolSafety(toolId) === 'confirm_required';
}

export function isAssistantAdminOnlyTool(toolId: AssistantToolId): boolean {
  return getAssistantToolSafety(toolId) === 'admin_only';
}
