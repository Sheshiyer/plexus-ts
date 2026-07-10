import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const evidenceDir = path.join(root, 'docs/evidence/2026-07-10-batch15-proof-cockpit-signals');
const vitePort = Number(process.env.PLEXUS_SCREENSHOT_PORT || 5180);
const debugPort = Number(process.env.PLEXUS_CHROME_DEBUG_PORT || 9328);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeProfile = path.join(os.tmpdir(), `plexus-admin-chrome-${process.pid}`);
const now = '2026-07-10T00:40:00.000Z';
const date = '2026-07-10';

const project = {
  id: 'project_proof_cockpit',
  name: 'Plexus Production Roadmap',
  clientName: 'Thoughtseed',
  color: '#7dd3fc',
  archived: false,
  createdAt: now,
  githubRepoUrl: 'https://github.com/Sheshiyer/plexus-ts',
  githubRepoFullName: 'Sheshiyer/plexus-ts',
  repoVerifiedAt: now,
  repoEvidenceStatus: 'verified',
  evidenceStatus: 'matched',
};

const adminSession = {
  identityId: 'identity_founder',
  employeeId: null,
  email: 'founder@thoughtseed.space',
  displayName: 'Founder',
  role: 'admin',
  workspaceId: 'workspace_plexus',
  projectVisibility: 'all',
  onboarding: { completed: true, requiredComplete: true, steps: [] },
  signedInAt: now,
};

const overview = {
  workspaceId: 'workspace_plexus',
  viewer: { ...adminSession, access: true },
  projects: [project],
  identities: [
    {
      identityId: 'identity_founder',
      employeeId: null,
      email: 'founder@thoughtseed.space',
      displayName: 'Founder',
      role: 'admin',
      projectVisibility: 'all',
      capabilities: {},
      onboarding: { steps: [{ stepId: 'profile', label: 'Profile', requirement: 'required', state: 'completed', updatedAt: now }] },
    },
    {
      identityId: 'identity_shesh',
      employeeId: 'employee_shesh',
      email: 'shesh@thoughtseed.space',
      displayName: 'Shesh',
      role: 'employee',
      projectVisibility: 'assigned',
      capabilities: {},
      onboarding: { steps: [{ stepId: 'repo', label: 'Repo', requirement: 'required', state: 'pending', updatedAt: now }] },
    },
  ],
};

const proofCockpit = {
  date,
  generatedAt: now,
  workspaceId: 'workspace_plexus',
  viewer: {
    identityId: adminSession.identityId,
    email: adminSession.email,
    role: 'admin',
    projectVisibility: 'all',
  },
  signals: {
    tasksEvidence: signal('tasksEvidence', 'Tasks & evidence', '3/5', '2 active, 1 blocked, 1 missing proof.', 'attention', 'warning', 'Fabric task cache + evidence summary'),
    activeRooms: signal('activeRooms', 'Active rooms', '2', '3 participant(s), 1 live call(s), 1 screen share(s).', 'attention', 'warning', 'realtime room aggregate'),
    blockers: signal('blockers', 'Blockers', '2', '1 Fabric task(s) are blocked.', 'attention', 'warning', 'task/evidence blocker model'),
    reports: signal('reports', 'Reports today', '2', '1 failed, 1 queued, 2 submitted.', 'blocked', 'warning', 'proof custody records + daily outbox'),
    bridgeHealth: signal('bridgeHealth', 'Bridge health', 'degraded', 'connected bridge, 2/2 ports Fabric, 5 task(s) Hermes.', 'attention', 'warning', 'Thoughtseed bridge + Fabric health + Hermes task source'),
    releaseHealth: signal('releaseHealth', 'Release health', 'green', 'CI workflow, release workflow, evidence policy, and release gate evidence are present.', 'ready', 'mint', 'local release policy files'),
  },
  tasksEvidence: {
    assigned: 1,
    active: 2,
    blocked: 1,
    done: 2,
    verified: 3,
    weak: 1,
    missingProof: 1,
    total: 5,
  },
  activeRooms: {
    openRooms: 2,
    liveCalls: 1,
    participants: 3,
    screenShares: 1,
    staleRooms: 1,
    topRoomName: 'Founder proof room',
    sourceState: 'ready',
    sourceMessage: '2 room(s) loaded at 2026-07-10T00:40:00.000Z.',
  },
  projectGroups: [
    { key: 'verified', label: 'Verified', count: 1, projectIds: [project.id] },
    { key: 'needs_repo', label: 'Needs repo', count: 0, projectIds: [] },
    { key: 'inaccessible', label: 'Inaccessible', count: 0, projectIds: [] },
    { key: 'missing_proof', label: 'Missing proof', count: 0, projectIds: [] },
  ],
  identities: { total: 2, admins: 1, employees: 1, onboardingComplete: 1, onboardingAttention: 1 },
  reports: {
    dailyPackets: 1,
    assistantDailyEvents: 1,
    submitted: 2,
    queued: 1,
    failed: 1,
    missing: 0,
    latestStatus: 'partial',
    latestUpdatedAt: '2026-07-10T00:35:00.000Z',
  },
  bridgeFabricHermes: {
    bridge: { state: 'ready', value: 'connected', detail: 'member shesh', checkedAt: now },
    fabric: {
      state: 'ready',
      value: '2/2 ports',
      detail: '2/2 Fabric agent(s) healthy; Paperclip bridge reachable.',
      checkedAt: now,
      reachablePorts: 2,
      totalPorts: 2,
      healthyAgents: 2,
      totalAgents: 2,
    },
    hermes: {
      state: 'attention',
      value: '5 task(s)',
      detail: '1 blocked Hermes-assigned task(s).',
      checkedAt: now,
      tasks: 5,
      blocked: 1,
    },
    overallState: 'attention',
    overallValue: 'degraded',
  },
  releaseHealth: {
    gate: 'green',
    source: 'local release policy files',
    checkedAt: now,
    detail: 'CI workflow, release workflow, evidence policy, and release gate evidence are present.',
    ciWorkflow: true,
    releaseWorkflow: true,
    releaseEvidencePolicy: true,
    releaseGateEvidence: true,
  },
  blockers: { count: 2, taskBlockers: 1, missingEvidence: 1, syncFailures: 0, topBlocker: '1 Fabric task(s) are blocked.' },
  actions: [
    { id: 'review-proof-blockers', title: 'Review proof blockers', detail: '1 Fabric task(s) are blocked.', tone: 'warning', routeKey: 'reports' },
    { id: 'inspect-fabric-assignments', title: 'Inspect Fabric assignments', detail: '2 active task(s) need founder-visible proof movement.', tone: 'mint', routeKey: 'bridge' },
    { id: 'review-active-rooms', title: 'Review room health', detail: '1 room(s) are open without presence or a live call.', tone: 'warning', routeKey: 'realtime' },
    { id: 'generate-daily-proof', title: 'Generate daily proof packet', detail: '1 daily proof event(s) failed delivery.', tone: 'warning', routeKey: 'reports' },
    { id: 'review-bridge-fabric-hermes', title: 'Review bridge/Fabric/Hermes health', detail: 'Health is degraded; inspect the degraded/manual source before dispatch.', tone: 'warning', routeKey: 'admin' },
  ],
};

const todaySnapshot = {
  date,
  generatedAt: now,
  timer: { running: false, paused: false, entryId: null, projectId: null, projectName: null, description: null, activeSeconds: 0, targetSeconds: null, raw: { running: false } },
  entries: [],
  projects: [project],
  tasks: [],
  totals: { trackedSeconds: 0, activeSeconds: 0, entryCount: 0, projectCount: 1, activeTaskCount: 0 },
  proof: { status: 'partial', risk: 'ready', missingEvidenceEntries: 0, evidencedEntries: 0, legacyUnverifiedEntries: 0, syncFailedEntries: 0, unverifiedProjectCount: 0, verifiedProjectCount: 1, summary: { proofStatus: 'partial', totalEntries: 0, evidencedEntries: 0, missingEvidenceEntries: 0, legacyUnverifiedEntries: 0, evidencedSeconds: 0, missingEvidenceSeconds: 0, projectRepoCoverage: { [project.id]: 'verified' } } },
  standup: { state: 'needed', compliant: false, todaySeconds: 0, weekSeconds: 0, source: 'member_kpi' },
  assistant: { availability: 'ready', enabled: true, state: 'ready', modelProvider: 'google', selectedModelId: 'google:gemini-2.5-flash', configuredProviderCount: 1, degraded: false, message: 'Assistant runtime ready.' },
  sessions: { enabled: true, pending: 0, ready: 0, matched: 0, needsProject: 0 },
  assignments: { activeCount: 0, current: null },
  rooms: { activeCount: 2, current: null },
  suggestions: [],
  sourceHealth: {},
  nextActions: [],
};

const mockSource = `
(() => {
  const project = ${JSON.stringify(project)};
  const adminSession = ${JSON.stringify(adminSession)};
  const overview = ${JSON.stringify(overview)};
  const proofCockpit = ${JSON.stringify(proofCockpit)};
  const todaySnapshot = ${JSON.stringify(todaySnapshot)};
  const settings = { memberId: 'shesh', theme: 'dark', defaultProjectId: null, reminderIntervalMinutes: 15, syncEnabled: true, assistantEnabled: true };
  const assistantStatus = { ok: true, state: 'ready', enabled: true, availability: 'ready', checkedAt: proofCockpit.generatedAt, model: { provider: 'auto', selectedProvider: 'google', selectedModelId: 'google:gemini-2.5-flash', configuredProviders: ['google'], googleModel: 'gemini-2.5-flash', nvidiaModel: 'nvidia/llama-3.1-nemotron', localModel: 'llama3.2', localBaseUrl: null, mockModel: 'mock-assistant', hasGoogleKey: true, hasNvidiaKey: false }, offlineSuggestionsAvailable: true, needsModelKey: false, message: 'Assistant runtime ready.' };
  const api = {
    authSession: async () => adminSession,
    authRefreshSession: async () => ({ ok: true, session: adminSession }),
    todaySnapshot: async () => todaySnapshot,
    projectList: async () => [project],
    entryList: async () => [],
    timerGetState: async () => ({ running: false }),
    settingsGet: async () => settings,
    workerStatus: async () => ({ connected: true, message: 'Worker reachable.' }),
    assistantStatus: async () => assistantStatus,
    assistantModelStatus: async () => assistantStatus.model,
    adminDemoOverview: async () => ({ ok: true, overview }),
    adminProofCockpitSnapshot: async () => proofCockpit,
    adminDemoOnboardingUpdate: async () => ({ ok: true, overview }),
    projectsSync: async () => ({ ok: true, count: 1 }),
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

function signal(key, label, value, detail, state, tone, source) {
  return { key, label, value: String(value), detail, state, tone, source, checkedAt: now };
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
  await waitForHttp(`http://127.0.0.1:${vitePort}/?splash=0&tab=admin`);
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
    await page.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/?splash=0&tab=admin` });
    await waitForProbe(page, fileName);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(path.join(evidenceDir, fileName), Buffer.from(shot.data, 'base64'));
  } finally {
    page.ws.close();
  }
}

async function waitForProbe(page, fileName) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const probe = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const body = document.body.innerText.toLowerCase();
        return ['founder proof cockpit','room health','daily proof packets','bridge/fabric/hermes','release gate'].every((text) => body.includes(text));
      })()`,
      returnByValue: true,
    });
    if (probe.result.value === true) return;
    await delay(250);
  }
  const body = await page.send('Runtime.evaluate', {
    expression: 'document.body.innerText.slice(0, 1000)',
    returnByValue: true,
  });
  throw new Error(`Admin proof cockpit probe failed for ${fileName}: ${body.result.value ?? ''}`);
}

mkdirSync(evidenceDir, { recursive: true });
const vite = await launchVite();
const chrome = await launchChrome();
try {
  await capture({ width: 1536, height: 1024 }, 'desktop.png');
  await capture({ width: 1280, height: 800 }, 'compact.png');
  writeFileSync(path.join(evidenceDir, 'capture.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${vitePort}/?splash=0&tab=admin`,
    viewports: ['1536x1024', '1280x800'],
    markers: ['Founder proof cockpit', 'Room health', 'Daily proof packets', 'Bridge/Fabric/Hermes', 'Release gate'],
  }, null, 2));
} finally {
  await stopChild(chrome);
  await stopChild(vite);
  rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
