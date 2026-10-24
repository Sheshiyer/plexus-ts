import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import AssistantGrowthRequest from '../src/renderer/components/AssistantGrowthRequest';
import AssistantActionConfirmModal from '../src/renderer/components/AssistantActionConfirmModal';
import '../src/renderer/theme.css';

const states = ['queued', 'running', 'retrying', 'draft_ready', 'failed'];
const result = {
  schema: 'thoughtseed.growth.result.v1', requestId: 'fixture_launch_01', role: 'synthesist',
  content: 'Launch brief: employee growth workflow\n\nAudience\nInternal teammates coordinating an early product launch.\n\nObjective\nPrepare a clear announcement draft and a short review checklist.\n\nDraft announcement\nOur team can now ask Clio for a scoped growth draft, review the proposed handoff, and follow Hermes progress in Plexus. This demonstration uses synthetic content only.\n\nReview before sharing\nConfirm the audience, product claims, and owner. Publication requires a separate approval.\n\nSource: 20-operations/growth/README.md',
  sources: [{ path: '20-operations/growth/README.md', digest: `sha256:${'a'.repeat(64)}` }, { path: '20-operations/growth/department/workflows.md', digest: `sha256:${'b'.repeat(64)}` }],
  approvalState: 'draft', externalAction: 'none',
};
const requestFor = (status: string) => ({ id: 'growth_fixture_01', requestId: 'fixture_launch_01', scope: 'org-growth', role: 'synthesist', status, createdAt: '2026-10-23T12:00:00.000Z', updatedAt: '2026-10-23T12:01:00.000Z', result: status === 'draft_ready' ? result : null });
function Fixture() {
  const [status, setStatus] = useState('queued');
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [action, setAction] = useState('No fixture action taken.');
  const [loseResponse, setLoseResponse] = useState(false);
  const lostResponse = React.useRef(false);
  // In-memory fixture only: no network, credentials, IPC, persistent state or external action.
  const fixtureBridge = { assistantGrowthRetry: async () => ({ intentId: 'fixture_retry_intent' }), assistantConfirmIntent: async () => { setStatus('queued'); if (loseResponse && !lostResponse.current) { lostResponse.current = true; throw new Error('Fixture: response lost after acceptance'); } return { intentId: 'fixture_intent', status: 'succeeded', toolId: 'org.handoff', result: { ok: true, request: requestFor('queued') } }; }, assistantCancelIntent: async () => ({ status: 'cancelled' }) };
  Object.assign(window, { plexus: fixtureBridge });
  return <main style={{ maxWidth: 980, margin: '24px auto', padding: 24 }}>
    <aside style={{ border: '1px solid var(--warn)', padding: 14, marginBottom: 24 }}><strong>DEVELOPER FIXTURE · synthetic data · no API calls</strong><p>This page reviews real Plexus components. It does not prove deployed identity, Phloem inference, or Hermes execution.</p></aside>
    <h1>Clio employee growth workflow</h1><p>Choose a request state. Refresh advances to the next synthetic state; failed refresh restarts at queued.</p>
    <nav aria-label="Fixture states" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '20px 0' }}>{states.map(state => <button key={state} aria-pressed={status === state} onClick={() => setStatus(state)}>{state}</button>)}<button onClick={() => setModal(true)}>Review handoff confirmation</button><label><input type="checkbox" checked={loseResponse} onChange={event => { setLoseResponse(event.target.checked); lostResponse.current = false; }} /> Simulate lost acceptance response</label></nav>
    <AssistantGrowthRequest request={requestFor(status)} refreshing={refreshing} onRefresh={() => { setRefreshing(true); window.setTimeout(() => { setStatus(states[(states.indexOf(status) + 1) % states.length]); setRefreshing(false); }, 350); }} />
    <p aria-live="polite">{action}</p>
    {modal && <AssistantActionConfirmModal intent={{ id: 'fixture_intent', intentId: 'fixture_intent', toolId: 'org.handoff', title: 'Prepare an internal launch brief', body: 'Send this scoped draft request to Hermes. No publishing or external action is authorized.', payload: { requestId: 'fixture_launch_01', scope: 'org-growth', role: 'synthesist', objective: 'Draft an internal launch brief for the employee workflow', contextRefs: ['20-operations/growth/README.md', '20-operations/growth/department/workflows.md'] }, safety: 'confirm_required' }} onClose={() => setModal(false)} onResult={value => setAction(`${value.message} (Synthetic fixture only.)`)} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
