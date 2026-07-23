import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const evidenceDir = process.env.PLEXUS_TODAY_EVIDENCE_DIR
  ? path.resolve(process.env.PLEXUS_TODAY_EVIDENCE_DIR)
  : path.join(root, 'docs/evidence/2026-07-10-p3-w3-today-founder-update');
const vitePort = Number(process.env.PLEXUS_SCREENSHOT_PORT || 5179);
const debugPort = Number(process.env.PLEXUS_CHROME_DEBUG_PORT || 9327);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeProfile = path.join(os.tmpdir(), `plexus-chrome-${process.pid}`);
const now = '2026-07-10T00:00:00.000Z';
const date = '2026-07-10';

const project = {
  id: 'project_founder_ready',
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

const entries = [
  entry('entry_today_1', 'Ship Today founder update action', 3720, 'matched'),
  entry('entry_today_2', 'Refresh command center screenshot proof', 2940, 'matched'),
  entry('entry_today_3', 'Review roadmap issue sync receipts', 1800, 'matched'),
  entry('entry_today_4', 'Prepare release evidence notes', 1260, 'pending'),
];

const snapshot = {
  date,
  generatedAt: now,
  timer: {
    running: false,
    paused: false,
    entryId: null,
    projectId: null,
    projectName: null,
    description: null,
    activeSeconds: 0,
    targetSeconds: null,
    raw: { running: false },
  },
  entries,
  projects: [project],
  tasks: [{
    taskId: 'P3-W2-T018',
    directiveId: 'directive_founder_update',
    correlationId: 'corr_founder_update',
    projectId: project.id,
    projectName: project.name,
    title: 'Add prepare-founder-update action',
    description: 'Queue the daily proof packet after explicit assistant confirmation.',
    status: 'in_progress',
    priority: 'high',
    proofStatus: 'partial',
    proofRequired: 'local verify plus screenshot evidence',
    evidenceStrength: 'weak',
    source: 'cambium',
    workMode: 'direct',
    assigneeMemberId: 'shesh',
    tenantId: 'cambium',
    history: [],
    createdAt: now,
    updatedAt: now,
  }],
  totals: {
    trackedSeconds: entries.reduce((sum, item) => sum + item.durationSeconds, 0),
    activeSeconds: 0,
    entryCount: entries.length,
    projectCount: 1,
    activeTaskCount: 1,
  },
  proof: {
    status: 'partial',
    risk: 'needs_evidence',
    missingEvidenceEntries: 0,
    evidencedEntries: 3,
    legacyUnverifiedEntries: 0,
    syncFailedEntries: 0,
    unverifiedProjectCount: 0,
    verifiedProjectCount: 1,
    summary: {
      proofStatus: 'partial',
      totalEntries: entries.length,
      evidencedEntries: 3,
      missingEvidenceEntries: 0,
      legacyUnverifiedEntries: 0,
      evidencedSeconds: entries.slice(0, 3).reduce((sum, item) => sum + item.durationSeconds, 0),
      missingEvidenceSeconds: 0,
      projectRepoCoverage: { [project.id]: 'verified' },
    },
  },
  standup: {
    state: 'needed',
    compliant: false,
    todaySeconds: entries.reduce((sum, item) => sum + item.durationSeconds, 0),
    weekSeconds: 24600,
    source: 'member_kpi',
  },
  assistant: {
    availability: 'ready',
    enabled: true,
    state: 'ready',
    modelProvider: 'google',
    selectedModelId: 'google:gemini-2.5-flash',
    configuredProviderCount: 1,
    degraded: false,
    message: 'Assistant runtime ready.',
  },
  sessions: {
    enabled: true,
    pending: 1,
    ready: 1,
    matched: 1,
    needsProject: 0,
  },
  assignments: {
    activeCount: 1,
    current: {
      taskId: 'P3-W2-T018',
      title: 'Add prepare-founder-update action',
      status: 'in_progress',
      source: 'cambium',
      proofRequired: 'local verify plus screenshot evidence',
      proofStatus: 'partial',
      nextAction: 'Confirm the daily proof packet before sending founder review.',
      projectId: project.id,
      projectName: project.name,
      workMode: 'direct',
      evidenceStrength: 'weak',
      updatedAt: now,
    },
  },
  rooms: {
    activeCount: 1,
    current: {
      roomId: 'room_founder_ready',
      roomType: 'project_room',
      name: 'Production readiness room',
      projectId: project.id,
      projectName: project.name,
      observedState: 'presence',
      joinState: 'unknown',
      participantCount: 2,
      screenShareCount: 0,
      activeCall: false,
      lastActivityAt: now,
    },
  },
  suggestions: [{
    id: `offline_founder_update_${date}`,
    title: 'Prepare founder update',
    detail: "Queue today's proof packet for founder review after confirmation.",
    source: 'assistant',
    safety: 'confirm_required',
    confidence: 0.93,
    rationale: 'Assistant recommendation derived from the Today context.',
    toolId: 'daily.sendEvent',
    routeKey: 'assistant',
  }],
  sourceHealth: {
    core: source('ready'),
    fabricTasks: source('ready', 'Fabric assignments loaded.'),
    standup: source('ready', 'Member KPI loaded.'),
    assistant: source('ready', 'Assistant runtime ready.'),
    agentSessions: source('ready', 'Local session scanner ready.'),
    realtimeRooms: source('ready', 'Realtime room state loaded.'),
    recommendations: source('ready', 'Founder update recommendation loaded.'),
  },
  nextActions: [
    { id: 'start-today-session', title: 'Start today from a verified project', detail: 'Choose the project and capture the next work block with proof attached.', tone: 'accent', routeKey: 'today' },
    { id: 'review-fabric-tasks', title: 'Review active Fabric assignment', detail: 'cambium · in_progress · Confirm the daily proof packet before sending founder review.', tone: 'mint', routeKey: 'bridge' },
    { id: 'open-active-room', title: 'Open active co-working room', detail: 'Production readiness room has 2 present and 0 screen share(s).', tone: 'mint', routeKey: 'realtime' },
    { id: 'prepare-founder-update', title: 'Prepare founder update', detail: "Queue today's proof packet for founder review after confirmation.", tone: 'warning', routeKey: 'assistant' },
    { id: 'review-temperance-suggestion', title: 'Prepare confirmed work packet', detail: 'Add prepare-founder-update action is in_progress; confirm scope and proof before dispatch.', tone: 'mint', routeKey: 'bridge' },
  ],
};

const session = {
  ok: true,
  email: 'shesh@thoughtseed.space',
  role: 'employee',
  identityId: 'identity_shesh',
  onboarding: { completed: true, steps: [] },
};

const mockSource = `
(() => {
  const snapshot = ${JSON.stringify(snapshot)};
  const projects = snapshot.projects;
  const entries = snapshot.entries;
  const session = ${JSON.stringify(session)};
  const settings = { memberId: 'shesh', theme: 'dark', defaultProjectId: null, reminderIntervalMinutes: 15, syncEnabled: true, assistantEnabled: true };
  const fabric = {
    checkedAt: snapshot.generatedAt,
    bridge: { reachable: true },
    summary: { healthy: 2, total: 2 },
    ports: [{ port: 3100, reachable: true }, { port: 31337, reachable: true }]
  };
  const assistantStatus = {
    ok: true,
    state: 'ready',
    enabled: true,
    availability: 'ready',
    checkedAt: snapshot.generatedAt,
    model: {
      provider: 'auto',
      selectedProvider: 'google',
      selectedModelId: 'google:gemini-2.5-flash',
      configuredProviders: ['google'],
      googleModel: 'gemini-2.5-flash',
      nvidiaModel: 'nvidia/llama-3.1-nemotron',
      localModel: 'llama3.2',
      localBaseUrl: null,
      mockModel: 'mock-assistant',
      hasGoogleKey: true,
      hasNvidiaKey: false
    },
    offlineSuggestionsAvailable: true,
    needsModelKey: false,
    message: 'Assistant runtime ready.'
  };
  const assistantSuggestions = [{
    id: 'offline_founder_update_${date}',
    type: 'standup',
    title: 'Prepare founder update',
    body: "Queue today's proof packet for founder review after confirmation.",
    confidence: 0.93,
    safety: 'confirm_required',
    date: '${date}',
    intent: {
      intentId: 'intent_founder_update_${date.replaceAll('-', '_')}',
      expiresAt: '2026-07-10T00:15:00.000Z',
      toolId: 'daily.sendEvent',
      title: 'Queue founder update',
      payload: { date: '${date}', memberId: 'shesh', standupRecordId: null }
    }
  }];
  const api = {
    todaySnapshot: async () => snapshot,
    projectList: async () => projects,
    entryList: async () => entries,
    timerGetState: async () => snapshot.timer.raw,
    authSession: async () => session,
    settingsGet: async () => settings,
    workerStatus: async () => ({ connected: true, message: 'Worker reachable.' }),
    assistantStatus: async () => assistantStatus,
    assistantModelStatus: async () => assistantStatus.model,
    assistantSuggestions: async () => assistantSuggestions,
    agentSessionStatus: async () => ({ ok: true, enabled: true, scanned: 1, imported: 1, totalPending: 1, matchedPending: 1, readyPending: 1, candidates: [], roots: [] }),
    thoughtseedBridgeStatus: async () => ({ configured: true, connected: true, bridgeApiUrl: 'https://curious.thoughtseed.space', tenantId: 'cambium', memberId: 'shesh', tokenExpiresAt: '2026-07-21T00:00:00.000Z', lastSeenAt: snapshot.generatedAt, lastError: null }),
    fabricStatus: async () => fabric,
    memberKpi: async () => ({ todaySeconds: snapshot.standup.todaySeconds, weekSeconds: snapshot.standup.weekSeconds, projectBreakdown: { [projects[0].id]: snapshot.standup.todaySeconds }, standupCompliant: false }),
    reportDaily: async () => ({ entryCount: entries.length, totalSeconds: snapshot.totals.trackedSeconds, evidenceSummary: snapshot.proof.summary, projectBreakdown: { [projects[0].id]: snapshot.totals.trackedSeconds } }),
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

function entry(id, description, durationSeconds, evidenceStatus) {
  return {
    id,
    projectId: project.id,
    description,
    startTime: '2026-07-10T08:00:00.000Z',
    endTime: '2026-07-10T09:00:00.000Z',
    durationSeconds,
    tags: ['roadmap'],
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

async function capture(viewport, fileName) {
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
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: mockSource });
    await page.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/?splash=0&tab=today` });
    await delay(1800);
    const probe = await page.send('Runtime.evaluate', {
      expression: `document.body.innerText.includes('Prepare founder update') && document.body.innerText.includes('Daily command center')`,
      returnByValue: true,
    });
    if (probe.result.value !== true) throw new Error(`Today viewport probe failed for ${fileName}`);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(path.join(evidenceDir, fileName), Buffer.from(shot.data, 'base64'));
  } finally {
    page.ws.close();
  }
}

mkdirSync(evidenceDir, { recursive: true });
const vite = await launchVite();
const chrome = await launchChrome();
try {
  await capture({ width: 1536, height: 1024 }, 'desktop.png');
  await capture({ width: 1040, height: 700 }, 'compact.png');
  writeFileSync(path.join(evidenceDir, 'capture.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${vitePort}/?splash=0&tab=today`,
    viewports: ['1536x1024', '1040x700'],
    marker: 'Prepare founder update',
  }, null, 2));
} finally {
  await stopChild(chrome);
  await stopChild(vite);
  rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
