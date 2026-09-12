import { useState } from 'react';

type SupportStudiesProps = {
  page: string;
  onNavigate: (page: string) => void;
};

type SpecimenButtonProps = {
  children: string;
  primary?: boolean;
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaPressed?: boolean;
  onClick?: () => void;
};

function SpecimenButton({ children, primary = false, type = 'button', disabled = false, ariaPressed, onClick }: SpecimenButtonProps) {
  return (
    <button className={primary ? 'exp-primary' : 'exp-button'} type={type} disabled={disabled} aria-pressed={ariaPressed} onClick={onClick}>
      {children}
    </button>
  );
}

function CoWorkingStudy({ onNavigate }: Pick<SupportStudiesProps, 'onNavigate'>) {
  const [controls, setControls] = useState({ mic: false, camera: false });
  const [room, setRoom] = useState('Project review');

  return (
    <main className="exp-page" aria-labelledby="coworking-title">
      <header className="exp-toolbar">
        <div><p className="exp-kicker">Collaborate</p><h1 className="exp-title" id="coworking-title">Co-working</h1><p className="exp-subtitle">A room should support the work already in progress.</p></div>
        <span className="exp-status">Design specimen · no media capture</span>
      </header>
      <div className="exp-split">
        <section className="exp-main" aria-label="Current co-working room">
          <div className="exp-section">
            <div className="exp-inline"><div><p className="exp-kicker">Current room</p><h2>{room}</h2></div><span className="exp-status">3 present</span></div>
            <p className="exp-subtitle">Project: Plexus experience design · return to current work on leave.</p>
            <div className="exp-stack" aria-label="Simulated media controls">
              <SpecimenButton ariaPressed={controls.mic} onClick={() => setControls((value) => ({ ...value, mic: !value.mic }))}>{controls.mic ? 'Microphone on · specimen' : 'Microphone off · specimen'}</SpecimenButton>
              <SpecimenButton ariaPressed={controls.camera} onClick={() => setControls((value) => ({ ...value, camera: !value.camera }))}>{controls.camera ? 'Camera on · specimen' : 'Camera off · specimen'}</SpecimenButton>
              <SpecimenButton disabled>Share screen · unavailable in specimen</SpecimenButton>
              <SpecimenButton onClick={() => onNavigate('Today')}>Leave room · return to Today</SpecimenButton>
            </div>
            <p className="exp-note">These controls only change this illustration. They do not request permissions, start capture, or join a room.</p>
          </div>
          <div className="exp-section">
            <p className="exp-kicker">Room purpose</p><h2>Review the identity foundation</h2>
            <p className="exp-subtitle">Keep decisions and next actions visible without turning the room into a dashboard.</p>
            <ul className="exp-list" aria-label="Room agenda">
              <li className="exp-row"><span>Review factual profile states</span><span className="exp-meta">10 min</span></li>
              <li className="exp-row"><span>Confirm return path to Today</span><span className="exp-meta">5 min</span></li>
            </ul>
          </div>
        </section>
        <aside className="exp-inspector" aria-label="Room participants and alternatives">
          <p className="exp-kicker">People in this room · 3 present</p>
          <ul className="exp-list">
            <li className="exp-row exp-row-selected"><span><strong>MK</strong> Current member</span><span className="exp-status">speaking</span></li>
            <li className="exp-row"><span><strong>RS</strong> Project reviewer</span><span className="exp-meta">present</span></li>
            <li className="exp-row"><span><strong>AL</strong> Design partner</span><span className="exp-meta">present</span></li>
          </ul>
          <p className="exp-kicker">Other rooms</p>
          <div className="exp-stack">
            <SpecimenButton onClick={() => setRoom('Project review')}>Project review</SpecimenButton>
            <SpecimenButton onClick={() => setRoom('Quiet focus')}>Quiet focus</SpecimenButton>
          </div>
        </aside>
      </div>
    </main>
  );
}

function SettingsStudy() {
  const [saved, setSaved] = useState(false);
  const [focus, setFocus] = useState('Product design');
  return (
    <main className="exp-page" aria-labelledby="settings-title">
      <header className="exp-toolbar"><div><p className="exp-kicker">Personal</p><h1 className="exp-title" id="settings-title">Settings</h1><p className="exp-subtitle">Profile, connections, privacy and app preferences in one predictable place.</p></div><span className="exp-status">{saved ? 'Draft saved in specimen' : 'Specimen draft'}</span></header>
      <div className="exp-split">
        <section className="exp-main">
          <form className="exp-stack" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
            <section className="exp-section" aria-labelledby="profile-settings"><p className="exp-kicker" id="profile-settings">Profile</p><label>Focus areas<input className="exp-input" value={focus} onChange={(event) => { setFocus(event.target.value); setSaved(false); }} /></label><label>Work hours<input className="exp-input" defaultValue="09:30–18:30" onChange={() => setSaved(false)} /></label><p className="exp-note">This draft remains inside the design specimen and does not update account settings.</p></section>
            <section className="exp-section" aria-labelledby="privacy-settings"><p className="exp-kicker" id="privacy-settings">Privacy</p><label><input type="checkbox" defaultChecked onChange={() => setSaved(false)} /> Show accepted work context in Today</label><p className="exp-note">Imported context stays reviewable before it has a destination.</p></section>
            <SpecimenButton primary type="submit">Save specimen draft</SpecimenButton>
          </form>
        </section>
        <aside className="exp-inspector"><p className="exp-kicker">Connections</p><ul className="exp-list"><li className="exp-row"><span>Repository proof</span><span className="exp-status">available</span></li><li className="exp-row"><span>Clio</span><span className="exp-meta">optional</span></li><li className="exp-row"><span>Member bridge</span><span className="exp-meta">not checked</span></li></ul><p className="exp-note">Connection states are illustrative; this view performs no check.</p><p className="exp-kicker">App</p><p className="exp-value">System text · reduced motion follows system preference</p></aside>
      </div>
    </main>
  );
}

function TeamStudy({ onNavigate }: Pick<SupportStudiesProps, 'onNavigate'>) {
  const [selected, setSelected] = useState('Project details need review');
  const [detailOpen, setDetailOpen] = useState(false);
  return (
    <main className="exp-page" aria-labelledby="team-title">
      <header className="exp-toolbar"><div><p className="exp-kicker">Team workspace · admin-only scope</p><h1 className="exp-title" id="team-title">Review queue</h1><p className="exp-subtitle">Resolve a specific proof blocker, then return to member work.</p></div><SpecimenButton onClick={() => onNavigate('Today')}>Return to Today</SpecimenButton></header>
      <div className="exp-split">
        <section className="exp-main"><p className="exp-note">Design-only role presentation. This page does not check or grant administrator access.</p><ul className="exp-list" aria-label="Illustrative review queue"><li className={selected === 'Project details need review' ? 'exp-row exp-row-selected' : 'exp-row'}><button type="button" onClick={() => { setSelected('Project details need review'); setDetailOpen(false); }}>Project details need review</button><span className="exp-status">attention</span></li><li className={selected === 'Daily report needs a recipient' ? 'exp-row exp-row-selected' : 'exp-row'}><button type="button" onClick={() => { setSelected('Daily report needs a recipient'); setDetailOpen(false); }}>Daily report needs a recipient</button><span className="exp-meta">pending</span></li></ul></section>
        <aside className="exp-inspector"><p className="exp-kicker">Selected review</p><h2>{selected}</h2><dl className="exp-table"><div><dt>Member</dt><dd>Member record</dd></div><div><dt>Project</dt><dd>Plexus experience design</dd></div><div><dt>Status</dt><dd>Not checked in specimen</dd></div></dl><SpecimenButton onClick={() => setDetailOpen((value) => !value)}>{detailOpen ? 'Hide illustrative detail' : 'Show illustrative detail'}</SpecimenButton>{detailOpen && <p className="exp-note" role="status">Illustrative detail: a member can review project context before taking any real action.</p>}<p className="exp-note">No review decision, export, backup, or report action is performed.</p></aside>
      </div>
    </main>
  );
}

function SignInStudy() {
  const [shown, setShown] = useState(false);
  return <main className="exp-page" aria-labelledby="signin-title"><header className="exp-toolbar"><span className="exp-kicker">Plexus</span><span className="exp-status">Focused entry</span></header><section className="exp-main exp-section"><p className="exp-kicker">Member workspace</p><h1 className="exp-title" id="signin-title">Sign in to continue</h1><p className="exp-subtitle">Your current work returns after a valid session.</p><div className="exp-stack"><label>Work email<input className="exp-input" type="email" placeholder="name@company.com" /></label><SpecimenButton primary onClick={() => setShown(true)}>Continue · specimen</SpecimenButton>{shown && <p className="exp-note" role="status">No sign-in was attempted. Authentication remains outside this design specimen.</p>}</div></section></main>;
}

function SetupStudy({ onNavigate }: Pick<SupportStudiesProps, 'onNavigate'>) {
  const [step, setStep] = useState(1);
  return <main className="exp-page" aria-labelledby="setup-title"><header className="exp-toolbar"><div><p className="exp-kicker">Design journey · {step} of 3</p><h1 className="exp-title" id="setup-title">Set up your workspace</h1><p className="exp-subtitle">One required decision at a time; optional preferences can wait.</p></div><span className="exp-status">Illustrative progress</span></header><div className="exp-split"><section className="exp-main exp-section"><p className="exp-kicker">{step === 2 ? 'Optional preference' : step === 3 ? 'Ready' : 'Required next step'}</p><h2>{step === 1 ? 'Choose a first project' : step === 2 ? 'Set a work preference' : 'Ready for Today'}</h2><p className="exp-subtitle">{step === 1 ? 'A selected project keeps timer, records and Clio context aligned.' : step === 2 ? 'You can adjust this later in Settings, or skip it for now.' : 'This navigation demonstrates the intended journey only.'}</p><div className="exp-stack">{step < 3 && <SpecimenButton primary onClick={() => setStep((value) => Math.min(3, value + 1))}>{step === 2 ? 'Save preference · specimen' : 'Continue specimen'}</SpecimenButton>}{step === 2 && <SpecimenButton onClick={() => setStep(3)}>Skip preference for now</SpecimenButton>}{step === 3 && <SpecimenButton primary onClick={() => onNavigate('Today')}>Go to Today · design journey</SpecimenButton>}</div></section><aside className="exp-inspector"><p className="exp-kicker">Setup checklist</p><ol className="exp-list"><li className="exp-row"><span>Workspace access</span><span className="exp-status">shown</span></li><li className="exp-row"><span>First project</span><span className="exp-meta">{step > 1 ? 'illustrated' : 'next'}</span></li><li className="exp-row"><span>Preferences</span><span className="exp-meta">optional</span></li></ol><p className="exp-note">No setup data is read or saved.</p></aside></div></main>;
}

export default function SupportStudies({ page, onNavigate }: SupportStudiesProps) {
  if (page === 'Co-working') return <CoWorkingStudy onNavigate={onNavigate} />;
  if (page === 'Settings') return <SettingsStudy />;
  if (page === 'Team') return <TeamStudy onNavigate={onNavigate} />;
  if (page === 'Sign in') return <SignInStudy />;
  return <SetupStudy onNavigate={onNavigate} />;
}
