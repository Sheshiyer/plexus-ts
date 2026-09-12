import React, { useMemo, useState } from 'react';

type Props = { page: string; onNavigate: (page: string) => void; selectedProject: string; onSelectProject: (name: string) => void };
type StatusTone = 'verified' | 'matched' | 'review' | 'held' | 'local';

const pageCopy: Record<string, { kicker: string; title: string; subtitle: string }> = {
  Today: { kicker: 'member workspace / today', title: 'Today', subtitle: 'Start, pause, and review today’s work.' },
  Projects: { kicker: 'member workspace / projects', title: 'Projects', subtitle: 'Find a project and see what is ready.' },
  'Work records': { kicker: 'member workspace / records', title: 'Work records', subtitle: 'Review the work logged for this day.' },
  'Work context': { kicker: 'member workspace / context', title: 'Work context', subtitle: 'Choose which local summaries to use.' },
  Clio: { kicker: 'member workspace / clio', title: 'Clio', subtitle: 'Ask for help with the work in front of you.' },
};

const rows = [
  ['Plexus native redesign', 'thoughtseed/plexus-ts', 'verified'],
  ['Member workspace acceptance', 'thoughtseed/wtfmedia', 'review'],
  ['Cambium source audit', 'thoughtseed/cambium', 'local'],
] as const;

function Status({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return <span className={`exp-status exp-status-${tone}`}>{children}</span>;
}

function Today({ onNavigate, selectedProject }: Pick<Props, 'onNavigate' | 'selectedProject'>) {
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState('Refine member workspace hierarchy');
  const project = rows.find((item) => item[0] === selectedProject) ?? rows[0];
  const ready = project[2] === 'verified';
  return <div className="exp-split">
    <main className="exp-main exp-stack">
      <section className="exp-primary exp-section">
        <div className="exp-inline"><div><p className="exp-kicker">illustrative session · {running ? 'running' : 'paused'}</p><strong className="exp-value">00:18:42</strong><p className="exp-meta">{selectedProject} · {ready ? 'project ready' : 'review project setup'}</p></div><Status tone={project[2]}>{ready ? 'ready' : 'needs review'}</Status></div>
        <label className="exp-stack"><span className="exp-meta">Today note</span><input className="exp-input" value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <div className="exp-inline"><button className="exp-primary" disabled={!ready} onClick={() => setRunning((value) => !value)}>{running ? 'Pause study' : 'Resume study'}</button><button className="exp-button" onClick={() => onNavigate('Projects')}>{ready ? 'Change project' : 'Review project'}</button></div>
      </section>
      <section className="exp-section"><p className="exp-kicker">recent work</p><div className="exp-list"><button className="exp-row" onClick={() => onNavigate('Work records')}><span><strong>09:10–10:05 · Navigation review</strong><small className="exp-meta">Plexus native redesign · 55m</small></span><Status tone="matched">matched</Status></button></div></section>
    </main>
    <aside className="exp-inspector exp-stack"><p className="exp-kicker">project context</p><strong>{selectedProject}</strong><p className="exp-meta">Selected project · member workspace</p><p className="exp-kicker">Next</p><button className="exp-button" onClick={() => onNavigate('Work context')}>Review suggested context</button><button className="exp-button" onClick={() => onNavigate('Clio')}>Prepare a handoff with Clio</button><div className="exp-note">Illustrative study: no timer, repository, or record API is called.</div></aside>
  </div>;
}

function Projects({ onNavigate, selectedProject, onSelectProject }: Pick<Props, 'onNavigate' | 'selectedProject' | 'onSelectProject'>) {
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const selectedRow = rows.find((item) => item[0] === selectedProject) ?? rows[0];
  const visibleRows = rows.filter((item) => (!readyOnly || item[2] === 'verified') && item.join(' ').toLowerCase().includes(query.toLowerCase()));
  const selectedVisible = visibleRows.some((item) => item[0] === selectedRow[0]);
  return <div className="exp-split"><main className="exp-main exp-stack"><section className="exp-toolbar"><input className="exp-input" aria-label="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" /><button className="exp-button" onClick={() => setReadyOnly((value) => !value)}>Filter · {readyOnly ? 'ready' : 'all'}</button></section><section className="exp-list" aria-label="Project list">{visibleRows.map((item) => <button key={item[0]} className={`exp-row${selectedRow[0] === item[0] ? ' exp-row-selected' : ''}`} onClick={() => onSelectProject(item[0])}><span><strong>{item[0]}</strong><small className="exp-meta">{item[1]}</small></span><Status tone={item[2]}>{item[2] === 'verified' ? 'ready' : item[2]}</Status></button>)}{visibleRows.length === 0 && <div className="exp-empty">No matching projects in this study.</div>}</section></main><aside className="exp-inspector exp-stack"><p className="exp-kicker">project details</p>{!selectedVisible && <p className="exp-meta">Selected project is outside these results.</p>}<strong>{selectedRow[0]}</strong><p className="exp-meta">{selectedRow[1]}</p><Status tone={selectedRow[2]}>{selectedRow[2] === 'verified' ? 'ready to use' : 'review needed'}</Status><button className="exp-button" onClick={() => { onSelectProject(selectedRow[0]); onNavigate('Today'); }}>Open in Today</button><div className="exp-note">Project selection only changes this study.</div></aside></div>;
}

function Records({ onNavigate }: Pick<Props, 'onNavigate'>) {
  const [selected, setSelected] = useState(0);
  const entries: [string, string, string, StatusTone][] = [['09:10–10:05', 'Plexus native redesign', '55m', 'matched'], ['10:18–10:42', 'Cambium source audit', '24m', 'local'], ['11:00–11:20', 'Member workspace acceptance', '20m', 'review']];
  const [reviewed, setReviewed] = useState(false);
  return <div className="exp-split"><main className="exp-main exp-stack"><section className="exp-toolbar"><p className="exp-kicker">12 September · 1h 39m logged</p><button className="exp-button" onClick={() => onNavigate('Today')}>View Today</button></section><table className="exp-table"><thead><tr><th>Time</th><th>Work</th><th>Duration</th><th>State</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={entry[1]} className={selected === index ? 'exp-row-selected' : ''}><td>{entry[0]}</td><td><button className="exp-button" aria-pressed={selected === index} onClick={() => { setSelected(index); setReviewed(false); }}>{entry[1]}</button></td><td>{entry[2]}</td><td><Status tone={entry[3]}>{entry[3]}</Status></td></tr>)}</tbody></table></main><aside className="exp-inspector exp-stack"><p className="exp-kicker">record detail</p><strong>{entries[selected][1]}</strong><p className="exp-meta">{entries[selected][0]} · {entries[selected][2]}</p><Status tone={entries[selected][3]}>{reviewed ? 'reviewed' : entries[selected][3]}</Status><button className="exp-button" onClick={() => setReviewed((value) => !value)}>{reviewed ? 'Clear review' : 'Review record'}</button><div className="exp-note">Review only changes this study.</div></aside></div>;
}

function Context({ onNavigate }: Pick<Props, 'onNavigate'>) {
  const [accepted, setAccepted] = useState(false);
  return <div className="exp-split"><main className="exp-main exp-stack"><section className="exp-primary exp-section"><p className="exp-kicker">local summary</p><strong>Codex design review summary</strong><p className="exp-subtitle">A short summary from this workspace. Full conversation text is not shown here.</p><div className="exp-inline"><Status tone="local">local source</Status><Status tone="review">review</Status></div></section><section className="exp-section exp-stack"><p className="exp-kicker">where it goes</p><div className="exp-row"><span>Source</span><span className="exp-meta">Local session summary</span></div><div className="exp-row"><span>Use in</span><span className="exp-meta">Today suggestions</span></div><div className="exp-inline"><button className="exp-button" onClick={() => setAccepted((value) => !value)}>{accepted ? 'Remove from review' : 'Use for review'}</button><button className="exp-button" onClick={() => onNavigate('Clio')}>Ask Clio first</button></div></section></main><aside className="exp-inspector exp-stack"><p className="exp-kicker">review state</p><Status tone={accepted ? 'verified' : 'held'}>{accepted ? 'ready to review' : 'not in use'}</Status><div className="exp-note">The toggle only changes this planning study.</div></aside></div>;
}

function Clio({ onNavigate, selectedProject }: Pick<Props, 'onNavigate' | 'selectedProject'>) {
  const [draft, setDraft] = useState('Prepare a handoff for the selected project.');
  const [queued, setQueued] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  return <div className="exp-split"><main className="exp-main exp-stack"><section className="exp-list"><article className="exp-section"><p className="exp-kicker">clio · local study</p><p>I can review today’s work, check project details, or help write a draft.</p><span className="exp-meta">09:24 · member workspace</span></article>{queued && <article className="exp-section exp-row-selected"><p className="exp-kicker">you · draft queued</p><p>{queued}</p><span className="exp-meta">Illustrative message only</span></article>}</section><section className="exp-stack"><label className="exp-stack"><span className="exp-meta">Message for Clio</span><textarea className="exp-input" aria-label="Message for Clio" value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} /></label><div className="exp-inline"><button className="exp-button" onClick={() => setQueued(draft)}>Queue draft</button><button className="exp-button" onClick={() => onNavigate('Work context')}>Inspect scope</button></div></section></main><aside className="exp-inspector exp-stack"><p className="exp-kicker">current scope</p><Status tone="local">{selectedProject} · today · sessions</Status><p className="exp-meta">This study does not send messages or take actions.</p><button className="exp-button" onClick={() => setPreviewOpen((value) => !value)}>{previewOpen ? 'Close preview' : 'Review proposed action'}</button>{previewOpen && <div className="exp-note">Illustrative preview: Clio would show the draft and ask before making any change.</div>}</aside></div>;
}

export default function WorkspaceStudies({ page, onNavigate, selectedProject, onSelectProject }: Props) {
  const current = pageCopy[page] ? page : 'Today';
  const content = useMemo(() => ({ Today: <Today onNavigate={onNavigate} selectedProject={selectedProject} />, Projects: <Projects onNavigate={onNavigate} selectedProject={selectedProject} onSelectProject={onSelectProject} />, 'Work records': <Records onNavigate={onNavigate} />, 'Work context': <Context onNavigate={onNavigate} />, Clio: <Clio onNavigate={onNavigate} selectedProject={selectedProject} /> })[current], [current, onNavigate, onSelectProject, selectedProject]);
  const copy = pageCopy[current];
  return <section className="exp-page" aria-label={`${current} workspace study`}>
    <header className="exp-toolbar"><div><p className="exp-kicker">{copy.kicker}</p><h1 className="exp-title">{copy.title}</h1><p className="exp-subtitle">{copy.subtitle}</p></div><Status tone="local">illustrative study</Status></header>
    {content}
  </section>;
}
