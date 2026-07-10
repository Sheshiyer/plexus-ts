import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const evidenceDir = process.env.PLEXUS_ASSISTANT_MATRIX_EVIDENCE_DIR
  ? path.resolve(process.env.PLEXUS_ASSISTANT_MATRIX_EVIDENCE_DIR)
  : path.join(root, 'docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix/assistant-matrix');
const vitePort = Number(process.env.PLEXUS_SCREENSHOT_PORT || 5234);
const debugPort = Number(process.env.PLEXUS_CHROME_DEBUG_PORT || 9384);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeProfile = path.join(os.tmpdir(), `plexus-assistant-matrix-chrome-${process.pid}`);
const now = '2026-07-10T04:45:00.000Z';
const date = '2026-07-10';

const project = {
  id: 'project_batch30_assistant',
  name: 'Clio Assistant Screenshot Matrix',
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

const entries = [
  entry('entry_assistant_1', 'Capture full Clio assistant panel', 3600),
  entry('entry_assistant_2', 'Capture Clio sidechat and confirmation modal', 3000),
  entry('entry_assistant_3', 'Capture bounded context drawer', 2400),
];

const session = {
  ok: true,
  email: 'shesh@thoughtseed.space',
  role: 'employee',
  identityId: 'identity_shesh',
  onboarding: { completed: true, requiredComplete: true, steps: [] },
};

const todaySnapshot = {
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
    taskId: 'P7-W3-T022',
    directiveId: 'directive_assistant_matrix',
    correlationId: 'corr_assistant_matrix',
    projectId: project.id,
    projectName: project.name,
    title: 'Capture Clio and assistant screenshot matrix',
    description: 'Full panel, sidechat, confirm modal, and context drawer are documented.',
    status: 'in_progress',
    priority: 'high',
    proofStatus: 'partial',
    proofRequired: 'screenshot evidence plus renderer contract',
    evidenceStrength: 'strong',
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
    evidencedEntries: entries.length,
    legacyUnverifiedEntries: 0,
    syncFailedEntries: 0,
    unverifiedProjectCount: 0,
    verifiedProjectCount: 1,
    summary: {
      proofStatus: 'partial',
      totalEntries: entries.length,
      evidencedEntries: entries.length,
      missingEvidenceEntries: 0,
      legacyUnverifiedEntries: 0,
      evidencedSeconds: entries.reduce((sum, item) => sum + item.durationSeconds, 0),
      missingEvidenceSeconds: 0,
      projectRepoCoverage: { [project.id]: 'verified' },
    },
  },
  standup: { state: 'needed', compliant: false, todaySeconds: 9000, weekSeconds: 32400, source: 'member_kpi' },
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
  sessions: { enabled: true, pending: 2, ready: 2, matched: 1, needsProject: 0 },
  assignments: {
    activeCount: 1,
    current: {
      taskId: 'P7-W3-T022',
      title: 'Capture Clio and assistant screenshot matrix',
      status: 'in_progress',
      source: 'cambium',
      proofRequired: 'screenshot evidence plus renderer contract',
      proofStatus: 'partial',
      nextAction: 'Capture the full Clio panel, sidechat, confirm modal, and context drawer.',
      projectId: project.id,
      projectName: project.name,
      workMode: 'direct',
      evidenceStrength: 'strong',
      updatedAt: now,
    },
  },
  rooms: {
    activeCount: 1,
    current: {
      roomId: 'room_assistant_matrix',
      roomType: 'project_room',
      name: 'Clio proof room',
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
  suggestions: [],
  sourceHealth: {
    core: source('ready', 'Core Today snapshot loaded.'),
    fabricTasks: source('ready', 'Fabric assignments loaded.'),
    standup: source('ready', 'Member KPI loaded.'),
    assistant: source('ready', 'Assistant runtime ready.'),
    agentSessions: source('ready', 'Local session scanner ready.'),
    realtimeRooms: source('ready', 'Realtime room state loaded.'),
    recommendations: source('ready', 'Temperance recommendations loaded.'),
  },
  nextActions: [],
};

const assistantStatus = {
  ok: true,
  state: 'ready',
  enabled: true,
  availability: 'ready',
  checkedAt: now,
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
    hasNvidiaKey: false,
  },
  offlineSuggestionsAvailable: true,
  needsModelKey: false,
  message: 'Assistant runtime ready.',
};

const assistantSuggestions = [{
  id: 'assistant_matrix_founder_update',
  type: 'standup',
  title: 'Queue founder update',
  body: 'Prepare the Batch 30 screenshot proof packet after confirmation.',
  confidence: 0.94,
  safety: 'confirm_required',
  date,
  intent: {
    intentId: 'intent_batch30_founder_update',
    expiresAt: '2026-07-10T05:00:00.000Z',
    toolId: 'daily.sendEvent',
    title: 'Queue founder update',
    body: 'Prepare the Batch 30 screenshot proof packet after confirmation.',
    payload: {
      date,
      memberId: 'shesh',
      taskId: 'P7-W3-T022',
      evidenceRoot: 'docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix',
    },
  },
}];

const dispatchLanes = {
  recommendations: [{
    id: 'rec_batch30_matrix',
    taskId: 'P7-W3-T022',
    label: 'Capture assistant matrix',
    rationale: 'Matrix proof stays useful only if confirmation stays explicit.',
    safety: 'confirm_required',
    confidence: 0.91,
    source: 'temperance',
  }],
};

function entry(id, description, durationSeconds) {
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
    evidenceStatus: 'matched',
    evidenceCheckedAt: now,
    githubActivityIds: [`activity_${id}`],
    evidenceProvenance: [],
  };
}

function source(state, message) {
  return { state, checkedAt: now, ...(message ? { message } : {}) };
}

function makeMockSource({ sidechatOpen = false } = {}) {
  return `
(() => {
  const project = ${JSON.stringify(project)};
  const entries = ${JSON.stringify(entries)};
  const session = ${JSON.stringify(session)};
  const todaySnapshot = ${JSON.stringify(todaySnapshot)};
  const assistantStatus = ${JSON.stringify(assistantStatus)};
  const assistantSuggestions = ${JSON.stringify(assistantSuggestions)};
  const dispatchLanes = ${JSON.stringify(dispatchLanes)};
  const settings = { memberId: 'shesh', theme: 'dark', defaultProjectId: null, reminderIntervalMinutes: 15, syncEnabled: true, assistantEnabled: true };
  const api = {
    authSession: async () => session,
    authRefreshSession: async () => ({ ok: true, session }),
    todaySnapshot: async () => todaySnapshot,
    projectList: async () => [project],
    entryList: async () => entries,
    timerGetState: async () => todaySnapshot.timer.raw,
    settingsGet: async () => settings,
    workerStatus: async () => ({ connected: true, message: 'Worker reachable.' }),
    assistantStatus: async () => assistantStatus,
    assistantModelStatus: async () => assistantStatus.model,
    assistantSuggestions: async () => assistantSuggestions,
    assistantConfirmIntent: async (intentId) => ({ ok: true, intentId }),
    assistantCancelIntent: async (intentId) => ({ ok: true, intentId }),
    assistantAsk: async () => ({ message: 'Batch 30 assistant proof is ready for local review.', provider: 'google' }),
    agentSessionStatus: async () => ({ ok: true, enabled: true, scanned: 2, imported: 2, totalPending: 2, matchedPending: 1, readyPending: 2, candidates: [], roots: [] }),
    thoughtseedBridgeStatus: async () => ({ configured: true, connected: true, bridgeApiUrl: 'https://curious.thoughtseed.space', tenantId: 'cambium', memberId: 'shesh', tokenExpiresAt: '2026-07-21T00:00:00.000Z', lastSeenAt: todaySnapshot.generatedAt, lastError: null }),
    fabricStatus: async () => ({ checkedAt: todaySnapshot.generatedAt, bridge: { reachable: true }, summary: { healthy: 2, total: 2 }, ports: [{ port: 3100, reachable: true }, { port: 31337, reachable: true }] }),
    thoughtseedDispatchLanes: async () => dispatchLanes,
    projectsSync: async () => ({ ok: true, count: 1 }),
    handoffRecord: async () => ({ ok: true }),
    onTimerTick: () => () => {},
    onIdleDetected: () => () => {},
    onAssistantEvent: () => () => {},
    onUpdatesStatus: () => () => {}
  };
  window.localStorage.setItem('plexus:clio-sidechat', ${JSON.stringify(sidechatOpen ? 'open' : 'closed')});
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
  await waitForHttp(`http://127.0.0.1:${vitePort}/?splash=0&tab=assistant`);
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
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: makeMockSource({ sidechatOpen: options.sidechatOpen }) });
    await page.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/${options.route}` });
    await delay(1800);
    if (options.setupExpression) {
      await page.send('Runtime.evaluate', {
        expression: options.setupExpression,
        awaitPromise: true,
        returnByValue: true,
      });
      await delay(500);
    }
    await waitForProbe(page, fileName, viewport, options.markers, options.selectors ?? []);
    await assertNoHorizontalOverflow(page, fileName, viewport);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(path.join(evidenceDir, fileName), Buffer.from(shot.data, 'base64'));
  } finally {
    page.ws.close();
  }
}

async function waitForProbe(page, fileName, viewport, markers, selectors) {
  const deadline = Date.now() + 9000;
  const markerProbe = `(() => {
    const markers = ${JSON.stringify(markers)};
    const selectors = ${JSON.stringify(selectors)};
    const text = document.body.innerText.toLowerCase().replace(/\\s+/g, ' ');
    const missing = markers.filter((marker) => !text.includes(marker));
    const missingSelectors = selectors.filter((selector) => !document.querySelector(selector));
    const painted = document.body.getBoundingClientRect().width >= ${Math.min(1040, viewport.width)};
    return { ok: painted && missing.length === 0 && missingSelectors.length === 0, missing, missingSelectors };
  })()`;
  while (Date.now() < deadline) {
    const probe = await page.send('Runtime.evaluate', { expression: markerProbe, returnByValue: true });
    if (probe.result.value?.ok === true) return;
    await delay(250);
  }
  const missing = await page.send('Runtime.evaluate', { expression: markerProbe, returnByValue: true });
  const body = await page.send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0, 1800)', returnByValue: true });
  throw new Error(`Assistant matrix probe failed for ${fileName}; missing ${JSON.stringify(missing.result.value ?? {})}: ${body.result.value ?? ''}`);
}

async function assertNoHorizontalOverflow(page, fileName, viewport) {
  const overflow = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const selectors = ['.px-main', '.px-assistant-page', '.px-assistant-layout', '.px-clio-sidechat.open', '.px-modal'];
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
  await capture({ width: 1536, height: 1024 }, 'full-panel-1536.png', {
    route: '?splash=0&tab=assistant',
    markers: ['assistant', 'native work runtime', 'work threads', 'bounded local context', 'next useful actions', 'queue founder update'],
    selectors: ['.px-assistant-page.surface-page', '.px-assistant-hero-metrics', '.px-assistant-layout', '.px-assistant-thread-panel', '.px-assistant-right-rail'],
  });
  await capture({ width: 1040, height: 700 }, 'sidechat-1040.png', {
    route: '?splash=0&tab=today',
    sidechatOpen: true,
    markers: ['clio', 'side chat', 'assistant thread', 'bounded local context'],
    selectors: ['aside.px-clio-sidechat.open[aria-label="Clio assistant side chat"]', '.px-shell.with-sidechat', '.px-main.sidechat-open', '.px-assistant-page.surface-sidechat'],
  });
  await capture({ width: 1280, height: 800 }, 'confirm-modal-1280.png', {
    route: '?splash=0&tab=assistant',
    setupExpression: `(() => {
      const button = Array.from(document.querySelectorAll('.px-assistant-suggestion-actions .px-btn')).find((element) =>
        !(element.className || '').includes('ghost') && (element.textContent || '').toLowerCase().includes('confirm')
      );
      button?.scrollIntoView({ block: 'center', inline: 'nearest' });
      button?.click();
      return true;
    })()`,
    markers: ['confirm assistant action', 'daily.sendevent', 'payload summary', 'queue founder update', 'cancel', 'confirm'],
    selectors: ['.px-backdrop .px-modal .px-assistant-confirm', '[role="dialog"][aria-modal="true"]'],
  });
  await capture({ width: 1280, height: 800 }, 'context-drawer-1280.png', {
    route: '?splash=0&tab=assistant',
    setupExpression: `(() => {
      document.querySelector('.px-assistant-right-rail')?.scrollIntoView({ block: 'start', inline: 'nearest' });
      return true;
    })()`,
    markers: ['bounded local context', 'today work log', 'projects', 'bridge assignments', 'temperance dispatch', 'co-working room', 'session groups', 'infra status', 'temperance recommendations', 'optional helpers'],
    selectors: ['.px-assistant-context-metrics', '.px-assistant-right-rail'],
  });

  writeFileSync(path.join(evidenceDir, 'capture.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    viewports: ['1536x1024', '1280x800', '1040x700'],
    captures: [
      { file: 'full-panel-1536.png', state: 'full Clio assistant workbench route' },
      { file: 'sidechat-1040.png', state: 'Clio sidechat open beside Today' },
      { file: 'confirm-modal-1280.png', state: 'assistant action confirmation modal' },
      { file: 'context-drawer-1280.png', state: 'bounded local context drawer' },
    ],
    selectors: ['.px-assistant-page.surface-page', '.px-assistant-page.surface-sidechat', '.px-assistant-confirm', '.px-assistant-context-metrics'],
    geometryProbes: ['horizontal overflow'],
  }, null, 2));
  writeFileSync(path.join(evidenceDir, 'README.md'), `# Batch30 Clio Assistant Screenshot Matrix

Captured on ${new Date().toISOString()} against the mocked Clio assistant harness.

- full-panel-1536.png: real App route for the full Clio workbench using \`?tab=assistant\`.
- sidechat-1040.png: Clio sidechat open beside Today with sidechat layout guards active.
- confirm-modal-1280.png: confirmation-required assistant action modal with redacted payload summary surface.
- context-drawer-1280.png: bounded local context drawer with Temperance recommendation and optional helper status.
`);
} finally {
  await stopChild(chrome);
  await stopChild(vite);
  rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
