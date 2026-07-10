import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const evidenceDir = process.env.PLEXUS_TODAY_MATRIX_EVIDENCE_DIR
  ? path.resolve(process.env.PLEXUS_TODAY_MATRIX_EVIDENCE_DIR)
  : path.join(root, 'docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix/today-matrix');
const vitePort = Number(process.env.PLEXUS_SCREENSHOT_PORT || 5230);
const debugPort = Number(process.env.PLEXUS_CHROME_DEBUG_PORT || 9380);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeProfile = path.join(os.tmpdir(), `plexus-today-matrix-chrome-${process.pid}`);
const now = '2026-07-10T04:20:00.000Z';
const date = '2026-07-10';

const project = {
  id: 'project_batch30_today',
  name: 'Plexus Production Roadmap',
  clientName: 'Thoughtseed',
  color: '#7dd3fc',
  archived: false,
  createdAt: now,
  githubRepoUrl: 'https://github.com/Sheshiyer/plexus-ts',
  githubRepoFullName: 'Sheshiyer/plexus-ts',
  repoFullName: 'Sheshiyer/plexus-ts',
  repoVerifiedAt: now,
  repoEvidenceStatus: 'verified',
  evidenceStatus: 'matched',
};

const session = {
  ok: true,
  email: 'shesh@thoughtseed.space',
  role: 'employee',
  identityId: 'identity_shesh',
  onboarding: { completed: true, requiredComplete: true, steps: [] },
};

const baseEntries = [
  entry('entry_batch30_idle_1', 'Capture Today idle matrix proof', 3600, 'matched'),
  entry('entry_batch30_idle_2', 'Review screenshot QA acceptance rows', 2400, 'matched'),
  entry('entry_batch30_idle_3', 'Prepare accessibility contract notes', 1800, 'matched'),
];

const sourceHealthReady = {
  core: source('ready', 'Core Today snapshot loaded.'),
  fabricTasks: source('ready', 'Fabric assignments loaded.'),
  standup: source('ready', 'Member KPI loaded.'),
  assistant: source('ready', 'Assistant runtime ready.'),
  agentSessions: source('ready', 'Local session scanner ready.'),
  realtimeRooms: source('ready', 'Realtime room state loaded.'),
  recommendations: source('ready', 'Recommendations loaded.'),
};

function makeSnapshot(variant) {
  const longTitle = 'Batch 30 screenshot matrix with intentionally long proof-ledger text that must wrap without horizontal overflow';
  const entries = variant === 'missing-proof'
    ? [
      entry('entry_missing_1', 'Missing proof entry awaiting attached evidence screenshot', 2700, 'missing'),
      entry('entry_missing_2', 'Legacy unverified record imported before proof policy', 2100, 'legacy_unverified'),
      entry('entry_missing_3', 'Matched reference entry', 1800, 'matched'),
    ]
    : variant === 'long-text'
      ? [
        entry('entry_long_1', longTitle, 4920, 'matched'),
        entry('entry_long_2', 'An extra long branch and issue sync receipt title should stay readable in the Today proof ledger', 3180, 'matched'),
      ]
      : baseEntries;
  const running = variant === 'running-session';
  const degradedAssistant = variant === 'assistant-degraded';
  const missingProof = variant === 'missing-proof';
  const totalTracked = entries.reduce((sum, item) => sum + item.durationSeconds, 0);
  const activeSeconds = running ? 1875 : 0;
  const proofRisk = missingProof ? 'needs_evidence' : 'clear';
  const sourceHealth = {
    ...sourceHealthReady,
    assistant: degradedAssistant
      ? source('unavailable', 'Clio runtime needs a model key before live assistant calls resume.')
      : sourceHealthReady.assistant,
  };

  return {
    date,
    generatedAt: now,
    timer: {
      running,
      paused: false,
      entryId: running ? 'entry_running_now' : null,
      projectId: running ? project.id : null,
      projectName: running ? project.name : null,
      description: running ? 'Running session screenshot matrix proof' : null,
      activeSeconds,
      targetSeconds: running ? 7200 : null,
      raw: {
        running,
        paused: false,
        entryId: running ? 'entry_running_now' : null,
        projectId: running ? project.id : null,
        description: running ? 'Running session screenshot matrix proof' : null,
        startTime: running ? '2026-07-10T03:48:45.000Z' : null,
        targetSeconds: running ? 7200 : null,
      },
    },
    entries,
    projects: [project],
    tasks: [{
      taskId: 'P7-W3-T019',
      directiveId: 'directive_batch30_today_matrix',
      correlationId: 'corr_batch30_today_matrix',
      projectId: project.id,
      projectName: project.name,
      title: variant === 'long-text' ? longTitle : 'Capture Today screenshot matrix',
      description: 'Capture idle, running, long text, degraded assistant, and missing proof Today states.',
      status: running ? 'in_progress' : 'assigned',
      priority: 'high',
      proofStatus: missingProof ? 'missing' : 'partial',
      proofRequired: 'screenshot matrix plus renderer contract',
      evidenceStrength: missingProof ? 'weak' : 'strong',
      source: 'cambium',
      workMode: 'direct',
      assigneeMemberId: 'shesh',
      tenantId: 'cambium',
      history: [],
      createdAt: now,
      updatedAt: now,
    }],
    totals: {
      trackedSeconds: totalTracked,
      activeSeconds,
      entryCount: entries.length,
      projectCount: 1,
      activeTaskCount: 1,
    },
    proof: {
      status: missingProof ? 'partial' : 'verified',
      risk: proofRisk,
      missingEvidenceEntries: missingProof ? 1 : 0,
      evidencedEntries: missingProof ? 1 : entries.length,
      legacyUnverifiedEntries: missingProof ? 1 : 0,
      syncFailedEntries: 0,
      unverifiedProjectCount: 0,
      verifiedProjectCount: 1,
      summary: {
        proofStatus: missingProof ? 'partial' : 'verified',
        totalEntries: entries.length,
        evidencedEntries: missingProof ? 1 : entries.length,
        missingEvidenceEntries: missingProof ? 1 : 0,
        legacyUnverifiedEntries: missingProof ? 1 : 0,
        evidencedSeconds: missingProof ? entries[2].durationSeconds : totalTracked,
        missingEvidenceSeconds: missingProof ? entries[0].durationSeconds : 0,
        projectRepoCoverage: { [project.id]: 'verified' },
      },
    },
    standup: {
      state: missingProof ? 'needed' : 'ready',
      compliant: !missingProof,
      todaySeconds: totalTracked + activeSeconds,
      weekSeconds: 28800,
      source: 'member_kpi',
    },
    assistant: {
      availability: degradedAssistant ? 'needs_model_key' : 'ready',
      enabled: true,
      state: degradedAssistant ? 'needs_model_key' : 'ready',
      modelProvider: degradedAssistant ? 'auto' : 'google',
      selectedModelId: degradedAssistant ? null : 'google:gemini-2.5-flash',
      configuredProviderCount: degradedAssistant ? 0 : 1,
      degraded: degradedAssistant,
      message: degradedAssistant ? 'Clio needs a model key before live calls resume.' : 'Assistant runtime ready.',
    },
    sessions: { enabled: true, pending: 1, ready: 1, matched: 1, needsProject: 0 },
    assignments: {
      activeCount: 1,
      current: {
        taskId: 'P7-W3-T019',
        title: variant === 'long-text' ? longTitle : 'Capture Today screenshot matrix',
        status: running ? 'in_progress' : 'assigned',
        source: 'cambium',
        proofRequired: 'screenshot matrix plus renderer contract',
        proofStatus: missingProof ? 'missing' : 'partial',
        nextAction: 'Capture the Today command center state matrix.',
        projectId: project.id,
        projectName: project.name,
        workMode: 'direct',
        evidenceStrength: missingProof ? 'weak' : 'strong',
        updatedAt: now,
      },
    },
    rooms: {
      activeCount: 1,
      current: {
        roomId: 'room_batch30_today',
        roomType: 'project_room',
        name: 'Screenshot QA room',
        projectId: project.id,
        projectName: project.name,
        observedState: running ? 'live_call' : 'presence',
        joinState: 'unknown',
        participantCount: 2,
        screenShareCount: running ? 1 : 0,
        activeCall: running,
        lastActivityAt: now,
      },
    },
    suggestions: [{
      id: `batch30_today_${variant}`,
      title: missingProof ? 'Repair missing proof' : degradedAssistant ? 'Open Clio settings' : 'Prepare founder update',
      detail: missingProof
        ? 'Attach proof to the missing entry before the day is founder-ready.'
        : degradedAssistant
          ? 'Add a model key or choose a local model before live assistant calls resume.'
          : 'Queue the daily proof packet after confirmation.',
      source: 'assistant',
      safety: 'confirm_required',
      confidence: degradedAssistant ? 0.71 : 0.92,
      rationale: 'Batch 30 screenshot matrix fixture.',
      toolId: 'daily.sendEvent',
      routeKey: degradedAssistant ? 'settings' : 'assistant',
    }],
    sourceHealth,
    nextActions: [
      { id: 'batch30-today-matrix', title: 'Capture Today matrix state', detail: variant, tone: missingProof || degradedAssistant ? 'warning' : 'accent', routeKey: 'today' },
      { id: 'prepare-founder-update', title: 'Prepare founder update', detail: 'Queue the proof packet after confirmation.', tone: 'mint', routeKey: 'assistant' },
      { id: 'review-proof-records', title: 'Review work records', detail: 'Inspect evidence status before founder review.', tone: missingProof ? 'warning' : 'idle', routeKey: 'entries' },
    ],
  };
}

function entry(id, description, durationSeconds, evidenceStatus) {
  return {
    id,
    projectId: project.id,
    description,
    startTime: '2026-07-10T08:00:00.000Z',
    endTime: '2026-07-10T09:00:00.000Z',
    durationSeconds,
    tags: ['batch30'],
    source: 'timer',
    syncedAt: null,
    githubRepoUrl: project.githubRepoUrl,
    githubRepoFullName: project.githubRepoFullName,
    evidenceStatus,
    evidenceCheckedAt: now,
    githubActivityIds: evidenceStatus === 'matched' ? [`activity_${id}`] : [],
    evidenceProvenance: [],
  };
}

function source(state, message) {
  return { state, checkedAt: now, ...(message ? { message } : {}) };
}

function makeMockSource(variant) {
  const snapshot = makeSnapshot(variant);
  return `
(() => {
  const snapshot = ${JSON.stringify(snapshot)};
  const session = ${JSON.stringify(session)};
  const settings = { memberId: 'shesh', theme: 'dark', defaultProjectId: null, reminderIntervalMinutes: 15, syncEnabled: true, assistantEnabled: true };
  const api = {
    todaySnapshot: async () => snapshot,
    projectList: async () => snapshot.projects,
    entryList: async () => snapshot.entries,
    timerGetState: async () => snapshot.timer.raw,
    authSession: async () => session,
    settingsGet: async () => settings,
    workerStatus: async () => ({ connected: true, message: 'Worker reachable.' }),
    assistantStatus: async () => ({ ok: !snapshot.assistant.degraded, state: snapshot.assistant.state, enabled: true, availability: snapshot.assistant.availability, message: snapshot.assistant.message }),
    assistantModelStatus: async () => ({ provider: 'auto', selectedProvider: snapshot.assistant.modelProvider, selectedModelId: snapshot.assistant.selectedModelId, configuredProviders: snapshot.assistant.configuredProviderCount ? ['google'] : [], hasGoogleKey: snapshot.assistant.configuredProviderCount > 0, hasNvidiaKey: false }),
    assistantSuggestions: async () => [],
    agentSessionStatus: async () => ({ ok: true, enabled: true, scanned: 1, imported: 1, totalPending: 1, matchedPending: 1, readyPending: 1, candidates: [], roots: [] }),
    thoughtseedBridgeStatus: async () => ({ configured: true, connected: true, bridgeApiUrl: 'https://curious.thoughtseed.space', tenantId: 'cambium', memberId: 'shesh', tokenExpiresAt: '2026-07-21T00:00:00.000Z', lastSeenAt: snapshot.generatedAt, lastError: null }),
    fabricStatus: async () => ({ checkedAt: snapshot.generatedAt, bridge: { reachable: true }, summary: { healthy: 2, total: 2 }, ports: [{ port: 3100, reachable: true }, { port: 31337, reachable: true }] }),
    memberKpi: async () => ({ todaySeconds: snapshot.standup.todaySeconds, weekSeconds: snapshot.standup.weekSeconds, projectBreakdown: { [snapshot.projects[0].id]: snapshot.standup.todaySeconds }, standupCompliant: snapshot.standup.compliant }),
    reportDaily: async () => ({ entryCount: snapshot.entries.length, totalSeconds: snapshot.totals.trackedSeconds, evidenceSummary: snapshot.proof.summary, projectBreakdown: { [snapshot.projects[0].id]: snapshot.totals.trackedSeconds } }),
    evidenceStatus: async () => snapshot.proof.summary,
    onTimerTick: () => () => {},
    onIdleDetected: () => () => {},
    onAssistantEvent: () => () => {},
    onUpdatesStatus: () => () => {}
  };
  window.localStorage.setItem('plexus:clio-sidechat', 'closed');
  window.plexus = new Proxy(api, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'string' && prop.startsWith('on')) return () => () => {};
      return async () => null;
    }
  });
})();
`;
}

async function waitForHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    })) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 2000).unref();
  });
}

async function launchVite() {
  const viteBin = path.join(root, 'node_modules/.bin/vite');
  const child = spawn(viteBin, ['--configLoader', 'native', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHttp(`http://127.0.0.1:${vitePort}/?splash=0&tab=today`);
  return child;
}

async function launchChrome() {
  rmSync(chromeProfile, { recursive: true, force: true });
  const child = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${chromeProfile}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
  return child;
}

async function newPage() {
  const target = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' }).then((res) => res.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const nextId = ++id;
    pending.set(nextId, { resolve, reject });
    ws.send(JSON.stringify({ id: nextId, method, params }));
  });
  return { ws, send };
}

async function capture(viewport, fileName, options) {
  const page = await newPage();
  try {
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: makeMockSource(options.variant) });
    await page.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/?splash=0&tab=today` });
    await delay(1500);
    if (options.setupExpression) {
      await page.send('Runtime.evaluate', {
        expression: options.setupExpression,
        awaitPromise: true,
        returnByValue: true,
      });
      await delay(350);
    }
    await waitForProbe(page, fileName, viewport, options.markers);
    await assertNoHorizontalOverflow(page, fileName, viewport);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(path.join(evidenceDir, fileName), Buffer.from(shot.data, 'base64'));
  } finally {
    page.ws.close();
  }
}

async function waitForProbe(page, fileName, viewport, markers) {
  const deadline = Date.now() + 9000;
  const markerProbe = `(() => {
    const markers = ${JSON.stringify(markers)};
    const text = document.body.innerText.toLowerCase().replace(/\\s+/g, ' ');
    const missing = markers.filter((marker) => !text.includes(marker));
    const painted = document.body.getBoundingClientRect().width >= ${Math.min(1040, viewport.width)};
    return { ok: painted && missing.length === 0, missing };
  })()`;
  while (Date.now() < deadline) {
    const probe = await page.send('Runtime.evaluate', { expression: markerProbe, returnByValue: true });
    if (probe.result.value?.ok === true) return;
    await delay(250);
  }
  const missing = await page.send('Runtime.evaluate', { expression: markerProbe, returnByValue: true });
  const body = await page.send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0, 1600)', returnByValue: true });
  throw new Error(`Today matrix probe failed for ${fileName}; missing ${JSON.stringify(missing.result.value?.missing ?? [])}: ${body.result.value ?? ''}`);
}

async function assertNoHorizontalOverflow(page, fileName, viewport) {
  const overflow = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const selectors = ['.px-main', '.px-today-command-panel', '.px-today-hero-grid', '.px-today-section-grid', '.px-ledger-row'];
      const viewportWidth = ${viewport.width};
      return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
        const rect = element.getBoundingClientRect();
        const scrollOverflow = element.scrollWidth - element.clientWidth;
        const viewportOverflow = Math.max(0, rect.right - viewportWidth) + Math.max(0, -rect.left);
        return { selector, text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120), scrollOverflow, viewportOverflow };
      })).filter((item) => item.scrollOverflow > 2 || item.viewportOverflow > 2);
    })()`,
    returnByValue: true,
  });
  const rows = overflow.result.value ?? [];
  if (rows.length) {
    throw new Error(`Horizontal overflow detected for ${fileName}: ${JSON.stringify(rows.slice(0, 5))}`);
  }
}

mkdirSync(evidenceDir, { recursive: true });
const vite = await launchVite();
const chrome = await launchChrome();
try {
  await capture({ width: 1536, height: 1024 }, 'idle-ready-1536.png', {
    variant: 'idle-ready',
    markers: ['daily command center', 'proof ready', 'today is founder-ready', 'prepare founder update'],
  });
  await capture({ width: 1536, height: 1024 }, 'running-session-1536.png', {
    variant: 'running-session',
    markers: ['working', 'running session screenshot matrix proof', 'screenshot qa room', 'daily command center'],
  });
  await capture({ width: 1040, height: 700 }, 'long-text-1040.png', {
    variant: 'long-text',
    markers: ['batch 30 screenshot matrix with intentionally long proof-ledger text', 'daily command center'],
  });
  await capture({ width: 1040, height: 700 }, 'assistant-degraded-1040.png', {
    variant: 'assistant-degraded',
    markers: ['needs_model_key', 'clio runtime needs a model key', 'daily command center'],
  });
  await capture({ width: 1536, height: 1024 }, 'missing-proof-1536.png', {
    variant: 'missing-proof',
    markers: ['evidence needed', 'today has proof gaps', 'missing proof entry awaiting attached evidence screenshot'],
  });

  writeFileSync(path.join(evidenceDir, 'capture.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${vitePort}/?splash=0&tab=today`,
    viewports: ['1536x1024', '1040x700'],
    captures: [
      { file: 'idle-ready-1536.png', state: 'idle / proof ready' },
      { file: 'running-session-1536.png', state: 'running timer session' },
      { file: 'long-text-1040.png', state: 'long text wrapping' },
      { file: 'assistant-degraded-1040.png', state: 'degraded assistant runtime' },
      { file: 'missing-proof-1536.png', state: 'missing proof evidence' },
    ],
    geometryProbes: ['horizontal overflow'],
  }, null, 2));
  writeFileSync(path.join(evidenceDir, 'README.md'), `# Batch30 Today Screenshot Matrix

Captured on ${new Date().toISOString()} against the mocked Today command center harness.

- idle-ready-1536.png: idle timer, proof-ready banner, and Clio suggestion rail.
- running-session-1536.png: active timer/session state with co-working room context.
- long-text-1040.png: long assignment and ledger copy wrapping at compact width.
- assistant-degraded-1040.png: Clio needs-model-key state without layout drift.
- missing-proof-1536.png: missing/legacy proof state with evidence repair prompt.
`);
} finally {
  await stopChild(chrome);
  await stopChild(vite);
  rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
