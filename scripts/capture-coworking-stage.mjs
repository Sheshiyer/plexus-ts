import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const evidenceDir = process.env.PLEXUS_COWORKING_STAGE_EVIDENCE_DIR
  ? path.resolve(process.env.PLEXUS_COWORKING_STAGE_EVIDENCE_DIR)
  : path.join(root, 'docs/evidence/2026-07-10-batch20-coworking-stage');
const vitePort = Number(process.env.PLEXUS_SCREENSHOT_PORT || 5181);
const debugPort = Number(process.env.PLEXUS_CHROME_DEBUG_PORT || 9329);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeProfile = path.join(os.tmpdir(), `plexus-coworking-chrome-${process.pid}`);
const now = '2026-07-10T01:10:00.000Z';

const project = {
  id: 'project_coworking_stage',
  name: 'Co-working Stage Foundation',
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

const projectRoom = room('room_project_stage', 'project_room', 'Stage foundation room', project.id, project.name, 'call_project_stage', {
  participants: 3,
  screenShares: 1,
});
const secondRoom = room('room_project_quiet', 'project_room', 'Quiet implementation room', 'project_quiet', 'Quiet implementation', null, {
  participants: 0,
  screenShares: 0,
});
const loungeRoom = room('room_lounge', 'workspace_lobby', 'Lounge', null, null, 'call_lounge', {
  participants: 2,
  screenShares: 0,
});

const projectParticipants = [
  participant('participant_maya', projectRoom.id, 'Maya Patel', 'call_project_stage', { audio: true }),
  participant('participant_ravi', projectRoom.id, 'Ravi Menon', 'call_project_stage', { screen: true }),
  participant('participant_lee', projectRoom.id, 'Lee Wong', 'call_project_stage', {}),
];

const loungeParticipants = [
  participant('participant_shesh', loungeRoom.id, 'Shesh Iyer', 'call_lounge', { audio: true }),
  participant('participant_anya', loungeRoom.id, 'Anya Rao', 'call_lounge', {}),
];

const projectTracks = [
  track('track_project_audio_maya', projectRoom.id, 'call_project_stage', 'participant_maya', 'audio', 'Maya project mic'),
  track('track_project_screen_ravi', projectRoom.id, 'call_project_stage', 'participant_ravi', 'screen', 'Roadmap board share'),
];

const floor = [
  floorPresence('participant_maya', 'Maya Patel', 'timing', projectRoom.id, projectRoom.name, project.name.toUpperCase(), true),
  floorPresence('participant_ravi', 'Ravi Menon', 'online', projectRoom.id, projectRoom.name, project.name.toUpperCase(), false),
  floorPresence('participant_shesh', 'Shesh Iyer', 'lounge', loungeRoom.id, loungeRoom.name, 'LOUNGE', true),
  floorPresence('participant_anya', 'Anya Rao', 'online', loungeRoom.id, loungeRoom.name, 'LOUNGE', false),
  floorPresence('participant_idle', 'Ida Idle', 'idle', null, null, null, false),
];

const session = {
  ok: true,
  email: 'shesh@thoughtseed.space',
  role: 'employee',
  identityId: 'identity_shesh',
  onboarding: { completed: true, steps: [] },
};

const todaySnapshot = {
  date: now.slice(0, 10),
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
  rooms: { activeCount: 2, current: { roomId: projectRoom.id, roomType: projectRoom.roomType, name: projectRoom.name, projectId: projectRoom.projectId, projectName: projectRoom.projectName, observedState: 'live_call', joinState: 'unknown', participantCount: 3, screenShareCount: 1, activeCall: true, lastActivityAt: now } },
  suggestions: [],
  sourceHealth: {},
  nextActions: [],
};

const mockSource = `
(() => {
  const floor = ${JSON.stringify(floor)};
  const rooms = ${JSON.stringify([projectRoom, secondRoom, loungeRoom])};
  const loungeRoom = ${JSON.stringify(loungeRoom)};
  const projectRoom = ${JSON.stringify(projectRoom)};
  const projectParticipants = ${JSON.stringify(projectParticipants)};
  const loungeParticipants = ${JSON.stringify(loungeParticipants)};
  const projectTracks = ${JSON.stringify(projectTracks)};
  const session = ${JSON.stringify(session)};
  const todaySnapshot = ${JSON.stringify(todaySnapshot)};
  const project = ${JSON.stringify(project)};
  const settings = { memberId: 'shesh', theme: 'dark', defaultProjectId: null, reminderIntervalMinutes: 15, syncEnabled: true, assistantEnabled: true };
  const cloudflare = { configured: false, appId: null, sessionId: null, sessionDescription: null, stunUrls: [], negotiation: 'metadata_only' };
  const call = (id, roomId) => ({ id, workspaceId: 'workspace_1', roomId, provider: 'cloudflare', providerCallId: null, state: 'active', startedAt: todaySnapshot.generatedAt, endedAt: null, metadata: {}, createdAt: todaySnapshot.generatedAt, updatedAt: todaySnapshot.generatedAt });
  const api = {
    authSession: async () => session,
    authRefreshSession: async () => ({ ok: true, session }),
    todaySnapshot: async () => todaySnapshot,
    projectList: async () => [project],
    entryList: async () => [],
    timerGetState: async () => ({ running: false }),
    settingsGet: async () => settings,
    workerStatus: async () => ({ connected: true, message: 'Worker reachable.' }),
    coworkingFloor: async () => ({ ok: true, floor }),
    coworkingLounge: async () => ({ ok: true, room: loungeRoom }),
    realtimeRooms: async () => ({ ok: true, rooms }),
    realtimeRoomDetail: async (roomId) => {
      if (roomId === projectRoom.id) return { ok: true, detail: { room: projectRoom, call: call('call_project_stage', projectRoom.id), participants: projectParticipants, tracks: projectTracks } };
      if (roomId === loungeRoom.id) return { ok: true, detail: { room: loungeRoom, call: call('call_lounge', loungeRoom.id), participants: loungeParticipants, tracks: [] } };
      return { ok: true, detail: { room: rooms.find((room) => room.id === roomId), call: null, participants: [], tracks: [] } };
    },
    realtimeJoinRoom: async (roomId) => {
      const targetRoom = rooms.find((room) => room.id === roomId) || loungeRoom;
      const isLounge = targetRoom.id === loungeRoom.id;
      const joined = isLounge ? loungeParticipants[0] : projectParticipants[0];
      return { ok: true, joined: { room: targetRoom, call: call(targetRoom.activeCallId || 'call_joined', targetRoom.id), participant: joined, cloudflare } };
    },
    realtimeLeaveCall: async () => ({ ok: true }),
    realtimeCloseout: async () => ({ ok: true, meeting: null }),
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

function room(id, roomType, name, projectId, projectName, activeCallId, presence) {
  return {
    id,
    workspaceId: 'workspace_1',
    projectId,
    projectName,
    name,
    slug: id.replaceAll('_', '-'),
    roomType,
    state: 'open',
    visibility: 'workspace',
    activeCallId,
    activeCall: null,
    presence,
    metadata: {},
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function participant(id, roomId, displayName, callSessionId, media) {
  return {
    id,
    workspaceId: 'workspace_1',
    roomId,
    callSessionId,
    identityId: `identity_${id}`,
    employeeId: null,
    displayName,
    role: 'participant',
    state: 'joined',
    clientInstanceId: `client_${id}`,
    cloudflareSessionId: null,
    media: { audio: false, video: false, screen: false, ...media },
    joinedAt: now,
    leftAt: null,
    lastSeenAt: now,
    metadata: {},
  };
}

function track(id, roomId, callSessionId, participantId, trackKind, label) {
  return {
    id,
    workspaceId: 'workspace_1',
    roomId,
    callSessionId,
    participantId,
    identityId: `identity_${participantId}`,
    trackKind,
    direction: 'publish',
    state: 'live',
    label,
    sourceId: null,
    cloudflareSessionId: null,
    cloudflareTrackId: null,
    targetTrackIds: [],
    metadata: {},
    startedAt: now,
    endedAt: null,
    updatedAt: now,
  };
}

function floorPresence(participantId, displayName, ringState, roomId, roomName, projectTag, isSpeaking) {
  return {
    participantId,
    displayName,
    initials: displayName.split(/\\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase(),
    ringState,
    roomId,
    roomName,
    projectTag,
    isSpeaking,
  };
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
  await waitForHttp(`http://127.0.0.1:${vitePort}/?splash=0&tab=realtime`);
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
    await page.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/?splash=0&tab=realtime` });
    await waitForProbe(page, `${fileName}:base`, viewport, ['co-working', 'presence map', 'project stage']);
    if (options.setupExpression) {
      await page.send('Runtime.evaluate', {
        expression: options.setupExpression,
        awaitPromise: true,
        returnByValue: true,
      });
      await delay(500);
    }
    await waitForProbe(page, fileName, viewport, options.markers ?? DEFAULT_MARKERS);
    if (options.assertNoHorizontalOverflow) {
      await assertNoHorizontalOverflow(page, fileName, viewport, options.overflowSelectors);
    }
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(path.join(evidenceDir, fileName), Buffer.from(shot.data, 'base64'));
  } finally {
    page.ws.close();
  }
}

const DEFAULT_MARKERS = [
  'co-working',
  'presence map',
  'focus-only project selection',
  'project stage',
  'meet-like focused project stage',
  'screen wall',
  'stage participants',
  'fullscreen stage shell',
  'persistent ambient layer',
  'drop-in lounge',
  'co-working stage foundation',
];

async function waitForProbe(page, fileName, viewport, markers) {
  const deadline = Date.now() + 8000;
  const markerProbe = `(() => {
    const markers = ${JSON.stringify(markers)};
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
        return rect.height <= 180 && isInViewport(rect);
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
    return { ok: missing.length === 0, missing };
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
    expression: 'document.body.innerText.slice(0, 1400)',
    returnByValue: true,
  });
  throw new Error(`Co-working capture probe failed for ${fileName}; missing ${JSON.stringify(missing.result.value?.missing ?? [])}: ${body.result.value ?? ''}`);
}

async function assertNoHorizontalOverflow(page, fileName, viewport, selectors) {
  const overflow = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const selectors = ${JSON.stringify(selectors ?? ['.px-main', '.px-presence-map', '.px-room-stage-shell', '.px-room-stage', '.px-lounge-strip'])};
      const viewportWidth = ${viewport.width};
      return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((element) => {
        const rect = element.getBoundingClientRect();
        const scrollOverflow = element.scrollWidth - element.clientWidth;
        const viewportOverflow = Math.max(0, rect.right - viewportWidth) + Math.max(0, -rect.left);
        return {
          selector,
          text: (element.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
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

mkdirSync(evidenceDir, { recursive: true });
const vite = await launchVite();
const chrome = await launchChrome();
try {
  await capture({ width: 1536, height: 1024 }, 'desktop-1536.png', {
    markers: [
      ...DEFAULT_MARKERS,
      'audit',
      'no rec',
      'no transcript',
    ],
    setupExpression: clickButtonExpression('join lounge'),
    assertNoHorizontalOverflow: true,
  });
  await capture({ width: 1536, height: 1024 }, 'fullscreen-pinned-1536.png', {
    markers: [
      'exit stage',
      'pinned screen',
      'stage participants',
      'project media',
      'roadmap board share',
    ],
    setupExpression: `(() => {
      document.querySelector('.px-room-stage')?.scrollIntoView({ block: 'center', inline: 'nearest' });
      const screenTile = Array.from(document.querySelectorAll('button')).find((element) =>
        (element.textContent || '').toLowerCase().includes('roadmap board share')
      );
      screenTile?.click();
      const fullscreen = Array.from(document.querySelectorAll('button')).find((element) =>
        (element.textContent || '').toLowerCase().includes('fullscreen')
      );
      fullscreen?.click();
      document.querySelector('.px-room-stage')?.scrollIntoView({ block: 'center', inline: 'nearest' });
      return true;
    })()`,
    assertNoHorizontalOverflow: true,
    overflowSelectors: ['.px-main', '.px-room-stage', '.px-screen-wall', '.px-room-member-strip'],
  });
  await capture({ width: 1040, height: 700 }, 'compact-1040.png', {
    markers: [
      'presence map',
      'focus-only project selection',
    ],
    assertNoHorizontalOverflow: true,
  });
  writeFileSync(path.join(evidenceDir, 'capture.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${vitePort}/?splash=0&tab=realtime`,
    viewports: ['1536x1024', '1040x700'],
    captures: [
      {
        file: 'desktop-1536.png',
        markers: ['Co-working', 'Presence map', 'Focus-only project selection', 'Project stage', 'Meet-like focused project stage', 'Screen wall', 'Stage participants', 'Fullscreen stage shell', 'persistent ambient layer', 'Drop-in lounge', 'AUDIT', 'NO REC', 'NO TRANSCRIPT'],
      },
      {
        file: 'fullscreen-pinned-1536.png',
        markers: ['Exit stage', 'Pinned screen', 'Stage participants', 'Project media', 'Roadmap board share'],
      },
      {
        file: 'compact-1040.png',
        markers: ['Presence map', 'Focus-only project selection'],
      },
    ],
    overflowSelectors: ['.px-main', '.px-presence-map', '.px-room-stage-shell', '.px-room-stage', '.px-lounge-strip'],
  }, null, 2));
  writeFileSync(path.join(evidenceDir, 'README.md'), `# Batch20 Co-working Stage Evidence

Captured on ${new Date().toISOString()} against the mocked co-working stage harness.

- desktop-1536.png: presence map, focus-only project selection, Meet-like stage, fullscreen shell contract, stage participants, and joined lounge privacy chips.
- fullscreen-pinned-1536.png: pinned screen wall inside the fullscreen stage shell with exit, stage participants, and project media controls visible.
- compact-1040.png: compact co-working viewport with presence map and focus-only rail visible without horizontal overflow; lounge remains a normal section below the fold.
- capture.json: marker and overflow probe manifest.
`);
} finally {
  await stopChild(chrome);
  await stopChild(vite);
  rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function clickButtonExpression(label) {
  return `(() => {
    const button = Array.from(document.querySelectorAll('button')).find((element) =>
      (element.textContent || '').toLowerCase().includes(${JSON.stringify(label)})
    );
    button?.click();
    return true;
  })()`;
}
