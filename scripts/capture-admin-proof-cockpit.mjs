import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const evidenceDir = process.env.PLEXUS_ADMIN_PROOF_EVIDENCE_DIR
  ? path.resolve(process.env.PLEXUS_ADMIN_PROOF_EVIDENCE_DIR)
  : path.join(root, 'docs/evidence/2026-07-10-batch19-proof-cockpit-closeout');
const vitePort = Number(process.env.PLEXUS_SCREENSHOT_PORT || 5180);
const debugPort = Number(process.env.PLEXUS_CHROME_DEBUG_PORT || 9328);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeProfile = path.join(os.tmpdir(), `plexus-admin-chrome-${process.pid}`);
const now = '2026-07-10T00:40:00.000Z';
const date = '2026-07-10';
const longEmployeeEmail = 'avery.long.employee.identity.requiring.predictable.truncation@thoughtseed.space';

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
      identityId: 'identity_shesh',
      employeeId: 'employee_shesh',
      email: longEmployeeEmail,
      displayName: 'Shesh With A Long Ledger Name',
      role: 'employee',
      projectVisibility: 'assigned',
      capabilities: {},
      onboarding: {
        steps: [
          { stepId: 'profile', label: 'Profile', requirement: 'required', state: 'completed', updatedAt: '2026-07-10T00:25:00.000Z', metadata: {} },
          { stepId: 'repo', label: 'Repo', requirement: 'required', state: 'required', updatedAt: '2026-07-10T00:37:00.000Z', metadata: {} },
          { stepId: 'welcome', label: 'Welcome docs', requirement: 'optional', state: 'deferred', updatedAt: '2026-07-10T00:32:00.000Z', metadata: {} },
          { stepId: 'avatar', label: 'Avatar photo', requirement: 'optional', state: 'optional', updatedAt: '2026-07-10T00:21:00.000Z', metadata: {} },
        ],
      },
    },
    {
      identityId: 'identity_founder',
      employeeId: null,
      email: 'founder@thoughtseed.space',
      displayName: 'Founder',
      role: 'admin',
      projectVisibility: 'all',
      capabilities: {},
      onboarding: { steps: [{ stepId: 'profile', label: 'Profile', requirement: 'required', state: 'completed', updatedAt: now, metadata: {} }] },
    },
  ],
};

const testModeContext = {
  identityId: 'identity_shesh',
  displayName: 'Shesh With A Long Ledger Name',
  email: longEmployeeEmail,
  role: 'employee',
  startedAt: now,
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
    { key: 'verified', label: 'Verified', count: 3, projectIds: [project.id, 'project_reports_ready', 'project_release_ready'] },
    { key: 'needs_repo', label: 'Needs repo', count: 1, projectIds: ['project_needs_repo'] },
    { key: 'inaccessible', label: 'Inaccessible', count: 1, projectIds: ['project_private_repo'] },
    { key: 'missing_proof', label: 'Missing proof', count: 1, projectIds: ['project_missing_proof'] },
  ],
  identities: { total: 2, admins: 1, employees: 1, onboardingComplete: 1, onboardingAttention: 1 },
  identityRows: [
    {
      identityId: 'identity_shesh',
      displayName: 'Shesh With A Long Ledger Name',
      email: longEmployeeEmail,
      role: 'employee',
      onboardingDone: 2,
      onboardingTotal: 4,
      requiredDone: 1,
      requiredTotal: 2,
      optionalDone: 1,
      optionalTotal: 2,
      setupState: 'attention',
      proofState: 'attention',
      lastUpdatedAt: '2026-07-10T00:37:00.000Z',
      testModeAvailable: true,
    },
    {
      identityId: 'identity_founder',
      displayName: 'Founder',
      email: 'founder@thoughtseed.space',
      role: 'admin',
      onboardingDone: 1,
      onboardingTotal: 1,
      requiredDone: 1,
      requiredTotal: 1,
      optionalDone: 0,
      optionalTotal: 0,
      setupState: 'ready',
      proofState: 'ready',
      lastUpdatedAt: now,
      testModeAvailable: false,
    },
  ],
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
  blockers: { count: 2, taskBlockers: 1, missingEvidence: 1, syncFailures: 0, topBlocker: 'P4 blocker report: Waiting on founder review.' },
  blockerReport: {
    generatedAt: now,
    visibleWithinMs: 5000,
    topBlocker: 'P4 blocker report: Waiting on founder review.',
    topBlockerTaskId: 'P4-W3-T022',
    topBlockerTitle: 'P4 blocker report',
    nextAction: 'Open Reports with blocker context.',
    nextActionDetail: 'Review the blocked Fabric task, explain the blocker, then export the read-only cockpit snapshot for founder follow-up.',
    nextActionRouteKey: 'reports',
  },
  actions: [
    { id: 'review-proof-blockers', title: 'Review proof blockers', detail: 'P4 blocker report: Waiting on founder review.', tone: 'warning', routeKey: 'reports' },
    { id: 'inspect-fabric-assignments', title: 'Inspect Fabric assignments', detail: '2 active task(s) need founder-visible proof movement.', tone: 'mint', routeKey: 'bridge' },
    { id: 'review-active-rooms', title: 'Review room health', detail: '1 room(s) are open without presence or a live call.', tone: 'warning', routeKey: 'realtime' },
    { id: 'generate-daily-proof', title: 'Generate daily proof packet', detail: '1 daily proof event(s) failed delivery.', tone: 'warning', routeKey: 'reports' },
    { id: 'review-bridge-fabric-hermes', title: 'Review bridge/Fabric/Hermes health', detail: 'Health is degraded; inspect the degraded/manual source before dispatch.', tone: 'warning', routeKey: 'admin' },
  ],
  taskProofQueue: [
    {
      taskId: 'P4-W2-T015',
      title: 'Add Fabric/task proof queue preview',
      projectName: 'Plexus Production Roadmap',
      status: 'blocked',
      proofStatus: 'missing',
      evidenceStrength: 'weak_evidence',
      source: 'hermes',
      updatedAt: '2026-07-10T00:38:00.000Z',
    },
    {
      taskId: 'P4-W2-T012',
      title: 'Upgrade identity ledger',
      projectName: 'Plexus Production Roadmap',
      status: 'in_progress',
      proofStatus: 'partial',
      evidenceStrength: 'weak_evidence',
      source: 'cambium',
      updatedAt: '2026-07-10T00:36:00.000Z',
    },
    {
      taskId: 'P4-W2-T016',
      title: 'Add ops/release drill-through actions',
      projectName: 'Plexus Production Roadmap',
      status: 'assigned',
      proofStatus: 'pending',
      evidenceStrength: 'weak_evidence',
      source: 'manual',
      updatedAt: '2026-07-10T00:35:00.000Z',
    },
  ],
  opsDrilldowns: [
    {
      id: 'release_docs',
      title: 'Open release docs',
      detail: 'CI workflow, release workflow, evidence policy, and release gate evidence are present.',
      target: 'docs/RELEASE_EVIDENCE.md',
      tone: 'mint',
      routeKey: 'diagnostics',
    },
    {
      id: 'ci_evidence',
      title: 'Open CI evidence',
      detail: 'CI workflow is present; review the latest run receipt before release.',
      target: '.github/workflows/ci.yml',
      tone: 'accent',
      routeKey: 'diagnostics',
    },
    {
      id: 'issue_hub',
      title: 'Open issue hub',
      detail: 'Production roadmap hub carries the selected phase checklist and sync receipts.',
      target: 'GitHub issue #49',
      tone: 'accent',
      routeKey: 'reports',
    },
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
  const testModeContext = ${JSON.stringify(testModeContext)};
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
    adminProofCockpitOpenDrilldown: async (id) => ({ ok: true, id, target: id }),
    adminDemoOnboardingUpdate: async () => ({ ok: true, overview }),
    projectsSync: async () => ({ ok: true, count: 1 }),
    onTimerTick: () => () => {},
    onIdleDetected: () => () => {},
    onAssistantEvent: () => () => {},
    onUpdatesStatus: () => () => {}
  };
  window.localStorage.setItem('plexus:clio-sidechat', 'closed');
  window.localStorage.setItem('plexus.adminEmployeeModeContext', JSON.stringify(testModeContext));
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

async function capture(viewport, fileName, options = {}) {
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
    await page.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/${options.route ?? '?splash=0&tab=admin'}` });
    await waitForProbe(page, `${fileName}:base`, viewport, ['founder proof cockpit']);
    if (options.setupExpression) {
      await page.send('Runtime.evaluate', {
        expression: options.setupExpression,
        awaitPromise: true,
        returnByValue: true,
      });
      await delay(350);
    }
    await waitForProbe(page, fileName, viewport, options.markers ?? DEFAULT_MARKERS, options.forbiddenMarkers ?? []);
    if (options.assertNoHorizontalOverflow) {
      const overflow = await page.send('Runtime.evaluate', {
        expression: `(() => {
          const selectors = ${JSON.stringify(options.overflowSelectors ?? ['.px-main', '.pxds-ledger-rail', '.px-ledger-meta-wrap'])};
          const viewportWidth = ${viewport.width};
          return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
            const rect = element.getBoundingClientRect();
            const scrollOverflow = element.scrollWidth - element.clientWidth;
            const viewportOverflow = Math.max(0, rect.right - viewportWidth) + Math.max(0, -rect.left);
            return {
              selector,
              text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 100),
              scrollOverflow,
              viewportOverflow,
            };
          })).filter((item) => item.scrollOverflow > 2 || item.viewportOverflow > 2);
        })()`,
        returnByValue: true,
      });
      const rows = overflow.result.value ?? [];
      if (rows.length) {
        throw new Error(`Horizontal overflow detected for ${fileName}: ${JSON.stringify(rows.slice(0, 5))}`);
      }
    }
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(path.join(evidenceDir, fileName), Buffer.from(shot.data, 'base64'));
  } finally {
    page.ws.close();
  }
}

const DEFAULT_MARKERS = [
  'founder proof cockpit',
  'admin employee test mode',
  'testing as shesh with a long ledger name',
  'tasks & evidence',
  'active rooms',
  'blockers',
  'reports today',
  'bridge health',
  'release health',
  'project proof coverage',
  'coverage groups',
  'next founder actions',
  'blocker report fixture',
  'top blocker',
  'p4 blocker report',
  'next action',
  'open reports',
  'export snapshot',
  'verified',
  'needs repo',
  'inaccessible',
  'missing proof',
];

async function waitForProbe(page, fileName, viewport, markers, forbiddenMarkers = []) {
  const deadline = Date.now() + 8000;
  const markerProbe = `(() => {
    const markers = ${JSON.stringify(markers)};
    const forbiddenMarkers = ${JSON.stringify(forbiddenMarkers)};
    const isPainted = (node) => {
      for (let element = node.parentElement; element; element = element.parentElement) {
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    const isInViewport = (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= 0 &&
      rect.bottom <= ${viewport.height} &&
      rect.left >= 0 &&
      rect.right <= ${viewport.width};
    const visibleElementContains = (marker) =>
      Array.from(document.querySelectorAll('body *')).some((element) => {
        const text = (element.innerText || element.textContent || '').trim().toLowerCase().replace(/\\s+/g, ' ');
        if (!text.includes(marker) || !isPainted(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.height <= 140 && isInViewport(rect);
      });
    const findTextRect = (marker) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = (node.nodeValue || '').trim().toLowerCase().replace(/\\s+/g, ' ');
        if (!text.includes(marker) || !isPainted(node)) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = Array.from(range.getClientRects());
        range.detach();
        if (rects.some(isInViewport)) return true;
      }
      return visibleElementContains(marker);
    };
    const missing = markers.filter((marker) => !findTextRect(marker));
    const presentForbidden = forbiddenMarkers.filter((marker) => findTextRect(marker));
    return { ok: missing.length === 0 && presentForbidden.length === 0, missing, presentForbidden };
  })()`;
  while (Date.now() < deadline) {
    const probe = await page.send('Runtime.evaluate', {
      expression: markerProbe,
      returnByValue: true,
    });
    if (probe.result.value?.ok === true) return;
    await delay(250);
  }
  const missing = await page.send('Runtime.evaluate', {
    expression: markerProbe,
    returnByValue: true,
  });
  const body = await page.send('Runtime.evaluate', {
    expression: 'document.body.innerText.slice(0, 1000)',
    returnByValue: true,
  });
  throw new Error(`Admin proof cockpit probe failed for ${fileName}; missing ${JSON.stringify(missing.result.value?.missing ?? [])}; forbidden ${JSON.stringify(missing.result.value?.presentForbidden ?? [])}: ${body.result.value ?? ''}`);
}

function clickProofButtonExpression(label, destinationMarker) {
  return `
    (() => new Promise((resolve) => {
      const deadline = Date.now() + 4000;
      const targetLabel = ${JSON.stringify(label)};
      const destinationMarker = ${JSON.stringify(destinationMarker)};
      const scrollToDestination = () => {
        const target = Array.from(document.querySelectorAll('.pxds-panel, .px-panel, section, div')).find((element) =>
          (element.textContent || '').toLowerCase().replace(/\\s+/g, ' ').includes(destinationMarker)
        );
        target?.scrollIntoView({ block: 'start', inline: 'nearest' });
        document.querySelector('.px-main')?.scrollBy({ top: -12, left: 0 });
      };
      const attempt = () => {
        const button = Array.from(document.querySelectorAll('.px-proof-blocker-report button, button')).find((element) =>
          (element.textContent || '').toLowerCase().replace(/\\s+/g, ' ').includes(targetLabel)
        );
        if (button) {
          button.scrollIntoView({ block: 'center', inline: 'nearest' });
          button.click();
          setTimeout(() => {
            scrollToDestination();
            resolve(true);
          }, 500);
          return;
        }
        if (Date.now() > deadline) {
          resolve(false);
          return;
        }
        setTimeout(attempt, 100);
      };
      attempt();
    }))()
  `;
}

mkdirSync(evidenceDir, { recursive: true });
const vite = await launchVite();
const chrome = await launchChrome();
try {
  await capture({ width: 1536, height: 1024 }, 'desktop-1536.png', {
    markers: DEFAULT_MARKERS,
    forbiddenMarkers: ['admin diagnostics', 'worker base url', 'raw endpoints'],
  });
  await capture({ width: 1280, height: 800 }, 'degraded-health-1280.png', {
    markers: [
      'founder proof cockpit',
      'bridge health',
      'degraded',
      'reports today',
      'blocked',
      'attention',
    ],
    setupExpression: `(() => {
      const signal = Array.from(document.querySelectorAll('*')).find((element) =>
        (element.textContent || '').toLowerCase().includes('bridge health') &&
        (element.textContent || '').toLowerCase().includes('degraded')
      );
      signal?.scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    })()`,
    assertNoHorizontalOverflow: true,
    overflowSelectors: ['.px-main', '.px-proof-blocker-report', '.pxds-metric-grid', '.pxds-command-dock'],
  });
  await capture({ width: 1280, height: 800 }, 'reports-context-1280.png', {
    markers: [
      'proof cockpit report context',
      'p4 blocker report',
      'open reports with blocker context',
      'reports',
    ],
    setupExpression: clickProofButtonExpression('open reports', 'proof cockpit report context'),
    assertNoHorizontalOverflow: true,
    overflowSelectors: ['.px-main', '.px-proof-blocker-report', '.px-proof-blocker-copy', '.pxds-command-dock'],
  });
  await capture({ width: 1280, height: 800 }, 'export-context-1280.png', {
    markers: [
      'read-only proof snapshot context',
      'snapshot preserved',
      'p4 blocker report',
      'export',
    ],
    setupExpression: clickProofButtonExpression('export snapshot', 'read-only proof snapshot context'),
    assertNoHorizontalOverflow: true,
    overflowSelectors: ['.px-main', '.px-proof-blocker-report', '.px-proof-blocker-copy', '.pxds-command-dock'],
  });
  await capture({ width: 1280, height: 800 }, 'diagnostics-subtab.png', {
    route: '?splash=0&tab=admin&adminSection=diagnostics',
    markers: [
      'admin diagnostics',
      'raw endpoints',
      'worker',
      'bridge',
      'assistant',
    ],
    setupExpression: `(() => new Promise((resolve) => {
      const deadline = Date.now() + 2500;
      const tick = () => {
        const list = document.querySelector('.px-admin-diagnostics-list');
        if (list || Date.now() > deadline) {
          const panel = Array.from(document.querySelectorAll('*')).find((element) =>
            (element.textContent || '').toLowerCase().includes('admin diagnostics') &&
            (element.textContent || '').toLowerCase().includes('raw endpoints')
          );
          panel?.scrollIntoView({ block: 'start', inline: 'nearest' });
          resolve(true);
          return;
        }
        setTimeout(tick, 100);
      };
      tick();
    }))()`,
  });
  await capture({ width: 1280, height: 800 }, 'long-email-1280.png', {
    markers: [
      'identity proof ledger',
      'shesh with a long ledger name',
      'avery.long.employee.identity.requiring.predictable.truncation',
      'required',
      'optional',
      'proof attention',
    ],
    setupExpression: `(() => {
      document.querySelector('[aria-label="Identity proof ledger"], .px-admin-layout:last-of-type')?.scrollIntoView({ block: 'end', inline: 'nearest' });
      const ledger = Array.from(document.querySelectorAll('*')).find((element) =>
        (element.textContent || '').toLowerCase().includes('identity proof ledger')
      );
      ledger?.scrollIntoView({ block: 'start', inline: 'nearest' });
      return true;
    })()`,
    assertNoHorizontalOverflow: true,
    overflowSelectors: ['.px-main', '.pxds-ledger-rail', '.px-ledger-meta-wrap', '.px-ledger-title-inline'],
  });
  writeFileSync(path.join(evidenceDir, 'capture.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${vitePort}/?splash=0&tab=admin`,
    viewports: ['1536x1024', '1280x800'],
    captures: [
      {
        file: 'desktop-1536.png',
        markers: ['Founder proof cockpit', 'Admin employee test mode', 'Testing as Shesh With A Long Ledger Name', 'Tasks & evidence', 'Active rooms', 'Blockers', 'Reports today', 'Bridge health', 'Release health', 'Project proof coverage', 'Coverage groups', 'Next founder actions', 'Blocker report fixture', 'Top blocker', 'P4 blocker report', 'Next action', 'Open Reports', 'Export snapshot', 'Verified', 'Needs repo', 'Inaccessible', 'Missing proof'],
        forbiddenMarkers: ['Admin diagnostics', 'worker base URL', 'raw endpoints'],
      },
      {
        file: 'degraded-health-1280.png',
        markers: ['Founder proof cockpit', 'Bridge health', 'degraded', 'Reports today', 'blocked', 'attention'],
      },
      {
        file: 'reports-context-1280.png',
        markers: ['Proof cockpit report context', 'P4 blocker report', 'Open Reports with blocker context', 'Reports'],
      },
      {
        file: 'export-context-1280.png',
        markers: ['Read-only proof snapshot context', 'snapshot preserved', 'P4 blocker report', 'Export'],
      },
      {
        file: 'diagnostics-subtab.png',
        markers: ['Admin diagnostics', 'raw endpoints', 'worker', 'bridge', 'assistant'],
      },
      {
        file: 'long-email-1280.png',
        markers: ['Identity proof ledger', 'Shesh With A Long Ledger Name', 'avery.long.employee.identity.requiring.predictable.truncation', 'Required', 'Optional', 'proof attention'],
      },
    ],
  }, null, 2));
  writeFileSync(path.join(evidenceDir, 'README.md'), `# Batch19 Proof Cockpit Closeout Evidence

Captured on ${new Date().toISOString()} against the mocked admin proof cockpit harness.

- desktop-1536.png: all six cockpit signals, coverage groups, blocker report fixture, and next actions above fold without raw diagnostics.
- degraded-health-1280.png: degraded bridge/report health stays visible as an explicit screenshot matrix state.
- reports-context-1280.png: cockpit -> Reports handoff preserves the blocker report context.
- export-context-1280.png: cockpit -> Export handoff preserves a read-only proof snapshot context.
- diagnostics-subtab.png: raw diagnostics behind the diagnostics subtab.
- long-email-1280.png: identity proof ledger with long employee name/email wrapping or truncating predictably at 1280x800.
`);
} finally {
  await stopChild(chrome);
  await stopChild(vite);
  rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
