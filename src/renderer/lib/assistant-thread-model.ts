import type { AssistantToolId } from '../../shared/native-assistant';

/**
 * Plain-language labels for tool activity in the Clio thread.
 * phase 'call' = in progress, phase 'result' = finished.
 * Unknown tools fall back to the raw id so nothing is ever hidden.
 */
const TOOL_COPY: Partial<Record<AssistantToolId, { call: string; result: string }>> = {
  'app.startTimer': { call: 'Starting the timer…', result: 'Timer started' },
  'app.navigate': { call: 'Opening a page…', result: 'Opened the page' },
  'app.generateStandup': { call: 'Drafting standup proof…', result: 'Standup draft ready' },
  'app.syncProjects': { call: 'Syncing projects…', result: 'Projects synced' },
  'app.acceptSession': { call: 'Accepting the session…', result: 'Session accepted' },
  'context.projects': { call: 'Checking projects…', result: 'Checked projects' },
  'context.entries': { call: 'Checking the work log…', result: 'Checked the work log' },
  'context.reports': { call: 'Checking reports…', result: 'Checked reports' },
  'context.sessions': { call: 'Checking sessions…', result: 'Checked sessions' },
  'context.growth': { call: 'Reading permitted growth playbooks…', result: 'Growth sources ready' },
  'context.orgWork': { call: 'Checking Hermes work…', result: 'Hermes status updated' },
  'org.handoff': { call: 'Preparing growth handoff…', result: 'Growth handoff ready for review' },
  'context.infra': { call: 'Checking infra status…', result: 'Checked infra status' },
  'daily.sendEvent': { call: 'Sending daily update…', result: 'Daily update sent' },
};

export function humanizeToolEvent(toolId: AssistantToolId, phase: 'call' | 'result'): string {
  const copy = TOOL_COPY[toolId];
  if (copy) return copy[phase];
  return phase === 'call' ? `Running ${toolId}…` : `Ran ${toolId}`;
}

export function growthRequestFromResult(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>;
  const raw = envelope.request ?? (envelope.result && typeof envelope.result === 'object' ? (envelope.result as Record<string, unknown>).request : null);
  if (!raw || typeof raw !== 'object') return null;
  const request = raw as Record<string, unknown>;
  return typeof request.id === 'string' && typeof request.status === 'string' ? request : null;
}
