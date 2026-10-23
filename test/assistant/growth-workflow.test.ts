import { describe, expect, it, vi } from 'vitest';
import { executeAssistantTool, validateGrowthHandoff } from '../../src/main/assistant-tools';
import { growthRequestFromResult } from '../../src/renderer/lib/assistant-thread-model';

const request = { requestId: 'growth_123', scope: 'org-growth', role: 'synthesist', objective: 'Draft an internal launch brief', contextRefs: ['20-operations/growth/README.md'] };
function confirmed(payload: Record<string, unknown>) { return { id: 'intent1', conversationId: 'clio', toolId: 'org.handoff', status: 'confirmed', payload, consumedAt: null, expiresAt: '2099-01-01', createdAt: '', updatedAt: '', result: {} } as any; }
describe('employee growth workflow', () => {
  it('rejects project, tenant and private context injection', () => {
    for (const extra of [{ tenantId: 'other' }, { memberId: 'other' }, { projectId: 'client' }]) expect(() => validateGrowthHandoff({ ...request, ...extra })).toThrow('unsupported');
    expect(() => validateGrowthHandoff({ ...request, contextRefs: ['20-operations/growth/../../private.md'] })).toThrow('references');
    expect(() => validateGrowthHandoff({ ...request, role: 'shell' })).toThrow('role');
    expect(() => validateGrowthHandoff({ ...request, requestId: '../../x' })).toThrow('requestId');
  });
  it('requires confirmation before sending', async () => {
    const send = vi.fn();
    await expect(executeAssistantTool('org.handoff', request, {}, { growthRequest: send })).rejects.toThrow('confirmed');
    expect(send).not.toHaveBeenCalled();
  });
  it('claims once and sends only server contract fields', async () => {
    let intent = confirmed({ ...request, _growthAuthority: 'tenant/member' });
    const send = vi.fn(async () => ({ ok: true, request: { id: 'server1', status: 'queued' } }));
    const dependencies = { getIntent: async () => intent, claimIntent: async () => { if (intent.consumedAt) throw new Error('already consumed'); intent = { ...intent, consumedAt: 'now', status: 'running' }; return intent; }, updateIntent: async (_id: string, patch: any) => (intent = { ...intent, ...patch }), recordToolAudit: vi.fn(async () => ({} as any)), growthAuthority: async () => 'tenant/member', growthRequest: send };
    await executeAssistantTool('org.handoff', intent.payload, { intentId: 'intent1' }, dependencies);
    expect(send).toHaveBeenCalledWith('requests', request);
    await expect(executeAssistantTool('org.handoff', intent.payload, { intentId: 'intent1' }, dependencies)).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('blocks a member change after proposal and records failure', async () => {
    const intent = confirmed({ ...request, _growthAuthority: 'old' });
    const send = vi.fn(); const audit = vi.fn(async () => ({} as any));
    await expect(executeAssistantTool('org.handoff', intent.payload, { intentId: 'intent1' }, { getIntent: async () => intent, claimIntent: async () => intent, updateIntent: async () => intent, recordToolAudit: audit, growthAuthority: async () => 'new', growthRequest: send })).rejects.toThrow('authority changed');
    expect(send).not.toHaveBeenCalled(); expect(audit).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
  it('uses scoped status and does not mask server errors', async () => {
    const send = vi.fn(async () => { throw new Error('Request not found'); });
    await expect(executeAssistantTool('context.orgWork', { requestId: 'id1' }, {}, { growthRequest: send })).rejects.toThrow('not found');
    expect(send).toHaveBeenCalledWith('requests/id1');
  });
  it('extracts status/result cards from streamed and confirmation envelopes', () => {
    const row = { id: 'id1', status: 'completed', result: { summary: 'Draft ready', artifactRefs: ['agent-outputs/draft.md'] } };
    expect(growthRequestFromResult({ request: row })).toEqual(row);
    expect(growthRequestFromResult({ status: 'succeeded', result: { request: row } })).toEqual(row);
    expect(growthRequestFromResult({ status: 'confirmation_required' })).toBeNull();
  });
});
