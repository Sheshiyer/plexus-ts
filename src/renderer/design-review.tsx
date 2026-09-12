import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PlexusSettings, Project, Session } from '../shared/types';
import IdentityPanel from './components/IdentityPanel';
import WorkspaceStudies from './design/WorkspaceStudies';
import SupportStudies from './design/SupportStudies';
import './theme.css';
import './design-review.css';
import './design/studies.css';

type Scenario = 'populated' | 'empty' | 'offline' | 'partial failure' | 'cached after refresh' | 'long name';
type Plan = { name: string; job: string; action: string; authority: string; gap: string; primary: string; inspector: string; source: string };
const plans: Plan[] = [
  { name: 'Today', job: 'Choose and continue today’s work.', action: 'Start or resume', authority: 'Timer and TodaySnapshot', gap: 'No selected project', primary: 'Now · Next · Recent work', inspector: 'Project context and proof', source: 'components/Timer.tsx' },
  { name: 'Projects', job: 'Choose a ready work surface.', action: 'Open project', authority: 'Verified repository binding', gap: 'Repository needs connection', primary: 'Searchable project list', inspector: 'Readiness, records, assignments', source: 'components/ProjectManager.tsx:428' },
  { name: 'Work records', job: 'Review or add attributable work.', action: 'Add work record', authority: 'Local record and project binding', gap: 'Unresolved project', primary: 'Date-filtered ledger', inspector: 'Selected record and proof', source: 'components/TimeEntryList.tsx:408' },
  { name: 'Work context', job: 'Review consented imported context.', action: 'Accept context', authority: 'Source, retention and destination', gap: 'No accepted context', primary: 'Context inbox', inspector: 'Provenance and destination', source: 'components/AgentSessionsPanel.tsx' },
  { name: 'Clio', job: 'Ask about current work and act deliberately.', action: 'Send question', authority: 'Action preview and confirmation', gap: 'No project scope', primary: 'Persistent conversation', inspector: 'Scope and action preview', source: 'components/AssistantPanel.tsx:340' },
  { name: 'Co-working', job: 'Work together without losing task context.', action: 'Join room', authority: 'Room purpose and media state', gap: 'Media permission unavailable', primary: 'Room purpose and people', inspector: 'Health and closeout', source: 'components/CoWorkingPanel.tsx:789' },
  { name: 'Settings', job: 'Change one preference with clear save state.', action: 'Save preference', authority: 'Typed settings bridge', gap: 'Connection setup incomplete', primary: 'Profile / Connections / Privacy / App', inspector: 'Advanced diagnostics', source: 'components/Settings.tsx:70' },
  { name: 'Team', job: 'Resolve a role-scoped review blocker.', action: 'Open review item', authority: 'Admin session and proof queue', gap: 'Member session has no access', primary: 'Review queue', inspector: 'Reports and diagnostics', source: 'components/AdminDemoPanel.tsx' },
  { name: 'Sign in', job: 'Enter the authorized workspace.', action: 'Continue sign in', authority: 'Access session', gap: 'No authorized session', primary: 'Welcome and required step', inspector: 'Access help', source: 'components/Login.tsx' },
  { name: 'Setup', job: 'Complete required setup without losing progress.', action: 'Continue setup', authority: 'Onboarding completion state', gap: 'Required step unfinished', primary: 'One required step at a time', inspector: 'Durable checklist', source: 'components/Onboarding.tsx' },
];
function nameFor(s: Scenario) { return s === 'long name' ? 'Avery Chen · Research and Operations Partnership' : 'Avery Chen'; }
function fixtureSession(s: Scenario): Session { const name = nameFor(s); return { employee: { id: 'review-employee', displayName: name, email: 'avery@example.com', monthlyQuotaHours: 160 }, identityId: 'review-identity', employeeId: 'review-employee', adminId: null, workspaceId: 'review-workspace', email: 'avery@example.com', role: 'employee', displayName: name, projectVisibility: 'active', capabilities: {}, onboarding: { steps: [], requiredComplete: true, completed: true }, signedInAt: '2026-09-12T00:00:00.000Z' }; }
const project: Project = { id: 'review-project', name: 'Example workspace', color: '#E0FF4F', archived: false, createdAt: '2026-09-12T00:00:00.000Z', githubRepoId: '42', githubRepoUrl: 'https://example.com/workspace', githubRepoFullName: 'example/workspace', repoVerifiedAt: '2026-09-12T00:00:00.000Z', repoEvidenceStatus: 'verified' };
function installBridge(s: Scenario) {
  let preferenceReads = 0;
  const offline = s === 'offline';
  const empty = s === 'empty';
  const settings = { profile: { displayName: nameFor(s) }, syncEnabled: true } as PlexusSettings;
  const bridge: Pick<Window['plexus'], 'memberPreferencesGet' | 'settingsGet' | 'projectList'> = {
    memberPreferencesGet: async () => {
      preferenceReads += 1;
      if (offline || s === 'partial failure' || (s === 'cached after refresh' && preferenceReads > 2)) {
        throw new Error('Illustrative preferences are offline');
      }
      return empty ? {} : { focusAreas: 'Product systems, team clarity', workingHours: '09:30–18:00 IST', weeklyVisibility: 'team' };
    },
    settingsGet: async () => {
      if (offline) throw new Error('Illustrative settings are offline');
      return settings;
    },
    projectList: async () => {
      if (offline) throw new Error('Illustrative projects are offline');
      return empty ? [] : [project];
    },
  };
  // Only this development entry installs an illustrative bridge; production never imports it.
  (window as unknown as { plexus: typeof bridge }).plexus = bridge;
}
function Review() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark'); const [width, setWidth] = useState('960'); const [scenario, setScenario] = useState<Scenario>('populated'); const [selected, setSelected] = useState('Identity');
  const [selectedProject, setSelectedProject] = useState('Plexus native redesign');
  document.documentElement.dataset.theme = theme;
  useMemo(() => installBridge(scenario), [scenario]);
  const candidate = useMemo(() => <React.StrictMode><IdentityPanel key={scenario} session={fixtureSession(scenario)} onOpenSettings={() => setSelected('Settings')} onOpenProjects={() => setSelected('Projects')} /></React.StrictMode>, [scenario]);
  const plan = plans.find(item => item.name === selected);
  return (
    <main className="review-shell">
      <header className="review-header">
        <div><p>Design review · illustrative data · no live workspace actions</p><h1>Plexus workspace review</h1></div>
        <div className="review-controls">
          <label>Theme<select value={theme} onChange={e => setTheme(e.target.value as 'dark' | 'light')}><option value="dark">Dark</option><option value="light">Light</option></select></label>
          <label>Content width<select value={width} onChange={e => setWidth(e.target.value)}><option>960</option><option>680</option><option>420</option></select></label>
          <label>Identity scenario<select value={scenario} disabled={selected !== 'Identity'} onChange={e => setScenario(e.target.value as Scenario)}>{(['populated', 'empty', 'offline', 'partial failure', 'cached after refresh', 'long name'] as Scenario[]).map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
      </header>
      <div className="review-layout">
        <aside aria-label="Design review navigation">
          <b>Implemented candidate</b>
          <button aria-current={selected === 'Identity' ? 'page' : undefined} className={selected === 'Identity' ? 'selected' : ''} onClick={() => setSelected('Identity')}>Identity · rendered</button>
          <b>Design studies</b>
          {plans.map(item => <button aria-current={selected === item.name ? 'page' : undefined} className={selected === item.name ? 'selected' : ''} onClick={() => setSelected(item.name)} key={item.name}>{item.name}</button>)}
        </aside>
        <section className="review-canvas" style={{ width: `${width}px` }}>
          {selected === 'Identity' ? candidate : plan && <>
            <p className="review-study-label">Design study · proposed page changes · illustrative interactions</p>
            {['Today', 'Projects', 'Work records', 'Work context', 'Clio'].includes(selected)
              ? <WorkspaceStudies key={selected} page={selected} onNavigate={setSelected} selectedProject={selectedProject} onSelectProject={setSelectedProject} />
              : <SupportStudies key={selected} page={selected} onNavigate={setSelected} />}
            <details className="review-notes"><summary>Design rationale and source</summary><dl>
              <div><dt>Member job</dt><dd>{plan.job}</dd></div>
              <div><dt>Next action</dt><dd>{plan.action}</dd></div>
              <div><dt>Existing authority</dt><dd>{plan.authority}</dd></div>
              <div><dt>Recovery to design</dt><dd>{plan.gap}</dd></div>
              <div><dt>Source</dt><dd>{plan.source}</dd></div>
            </dl></details>
          </>}
        </section>
      </div>
    </main>
  );
}
const reviewRoot = createRoot(document.getElementById('root')!);
reviewRoot.render(<Review />);
import.meta.hot?.dispose(() => reviewRoot.unmount());
