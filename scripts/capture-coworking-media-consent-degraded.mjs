import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const evidenceDir = process.env.PLEXUS_COWORKING_BATCH21_EVIDENCE_DIR
  ? path.resolve(process.env.PLEXUS_COWORKING_BATCH21_EVIDENCE_DIR)
  : path.join(root, 'docs/evidence/2026-07-10-batch21-coworking-media-consent-degraded');
const vitePort = Number(process.env.PLEXUS_SCREENSHOT_PORT || 5182);
const debugPort = Number(process.env.PLEXUS_CHROME_DEBUG_PORT || 9330);
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromeProfile = path.join(os.tmpdir(), `plexus-coworking-batch21-chrome-${process.pid}`);
const now = '2026-07-10T03:10:00.000Z';

const project = {
  id: 'project_coworking_truth',
  name: 'Co-working Truth Layer',
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

const projectRoom = room('room_project_truth', 'project_room', 'Truth layer room', project.id, project.name, 'call_project_truth', {
  participants: 2,
  screenShares: 1,
});
const loungeRoom = room('room_lounge', 'workspace_lobby', 'Lounge', null, null, 'call_lounge', {
  participants: 2,
  screenShares: 0,
});
const rooms = [
  projectRoom,
  room('room_project_quiet', 'project_room', 'Quiet fallback room', 'project_quiet', 'Quiet fallback', null, {
    participants: 0,
    screenShares: 0,
  }),
  loungeRoom,
];

const projectParticipants = [
  participant('participant_maya', projectRoom.id, 'Maya Patel', 'call_project_truth', { audio: true }),
  participant('participant_ravi', projectRoom.id, 'Ravi Menon', 'call_project_truth', { screen: true }),
];
const loungeParticipants = [
  participant('participant_shesh', loungeRoom.id, 'Shesh Iyer', 'call_lounge', { audio: true }),
  participant('participant_anya', loungeRoom.id, 'Anya Rao', 'call_lounge', {}),
];
const projectTracks = [
  track('track_project_audio_maya', projectRoom.id, 'call_project_truth', 'participant_maya', 'audio', 'Maya project mic'),
  track('track_project_screen_ravi', projectRoom.id, 'call_project_truth', 'participant_ravi', 'screen', 'Truth board share'),
];
const floor = [
  floorPresence('participant_maya', 'Maya Patel', 'timing', projectRoom.id, projectRoom.name, project.name.toUpperCase(), true),
  floorPresence('participant_ravi', 'Ravi Menon', 'online', projectRoom.id, projectRoom.name, project.name.toUpperCase(), false),
  floorPresence('participant_shesh', 'Shesh Iyer', 'lounge', loungeRoom.id, loungeRoom.name, 'LOUNGE', true),
  floorPresence('participant_anya', 'Anya Rao', 'online', loungeRoom.id, loungeRoom.name, 'LOUNGE', false),
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
  rooms: { activeCount: 2, current: { roomId: projectRoom.id, roomType: projectRoom.roomType, name: projectRoom.name, projectId: projectRoom.projectId, projectName: projectRoom.projectName, observedState: 'live_call', joinState: 'unknown', participantCount: 2, screenShareCount: 1, activeCall: true, lastActivityAt: now } },
  suggestions: [],
  sourceHealth: {},
  nextActions: [],
};

function makeMockSource(options = {}) {
  const deviceScript = options.deviceError
    ? `Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
        enumerateDevices: async () => { throw new Error('Media device permission denied for Batch21 proof.'); },
        addEventListener: () => {},
        removeEventListener: () => {}
      }});`
    : `Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
        enumerateDevices: async () => [
          { kind: 'audioinput', deviceId: 'mic_1', label: 'Batch21 mic' },
          { kind: 'audiooutput', deviceId: 'speaker_1', label: 'Batch21 speaker' },
          { kind: 'videoinput', deviceId: 'camera_1', label: 'Batch21 camera' }
        ],
        addEventListener: () => {},
        removeEventListener: () => {}
      }});`;
  return `
(() => {
  ${deviceScript}
  const floor = ${JSON.stringify(floor)};
  const rooms = ${JSON.stringify(rooms)};
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
    coworkingFloor: async () => (${options.floorError ? "{ ok: false, message: 'Floor presence unavailable for Batch21 proof.' }" : "{ ok: true, floor }"}),
    coworkingLounge: async () => (${options.loungeError ? "{ ok: false, message: 'Lounge unavailable for Batch21 proof.' }" : "{ ok: true, room: loungeRoom }"}),
    realtimeRooms: async () => (${options.roomsError ? "{ ok: false, message: 'Project rooms unavailable for Batch21 proof.' }" : "{ ok: true, rooms }"}),
    realtimeRoomDetail: async (roomId) => {
      if (${JSON.stringify(Boolean(options.roomDetailError))}) return { ok: false, message: 'Focused room detail unavailable for Batch21 proof.' };
      if (roomId === projectRoom.id) return { ok: true, detail: { room: projectRoom, call: call('call_project_truth', projectRoom.id), participants: projectParticipants, tracks: projectTracks } };
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
}

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
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: makeMockSource(options.mock ?? {}) });
    await page.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/?splash=0&tab=realtime` });
    try {
      await waitForProbe(page, `${fileName}:base`, viewport, ['co-working']);
    } catch {
      await page.send('Page.reload', { ignoreCache: true });
      await delay(700);
      await waitForProbe(page, `${fileName}:base`, viewport, ['co-working']);
    }
    if (options.setupExpression) {
      await page.send('Runtime.evaluate', {
        expression: options.setupExpression,
        awaitPromise: true,
        returnByValue: true,
      });
      await delay(700);
    }
    await waitForProbe(page, fileName, viewport, options.markers);
    await assertNoHorizontalOverflow(page, fileName, viewport);
    await assertNoCriticalOverlap(page, fileName, viewport);
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
    const isPainted = (node) => {
      for (let element = node.parentElement; element; element = element.parentElement) {
        const style = window.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    const inViewport = (rect) =>
      rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= ${viewport.height} && rect.left >= 0 && rect.right <= ${viewport.width};
    const visibleElementContains = (marker) =>
      Array.from(document.querySelectorAll('body *')).some((element) => {
        const text = (element.innerText || element.textContent || '').trim().toLowerCase().replace(/\\s+/g, ' ');
        if (!text.includes(marker) || !isPainted(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.height <= 220 && inViewport(rect);
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
        if (rects.some(inViewport)) return true;
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
    expression: 'document.body.innerText.slice(0, 1800)',
    returnByValue: true,
  });
  throw new Error(`Batch21 capture probe failed for ${fileName}; missing ${JSON.stringify(missing.result.value?.missing ?? [])}: ${body.result.value ?? ''}`);
}

async function assertNoHorizontalOverflow(page, fileName, viewport) {
  const overflow = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const selectors = ['.px-main', '.px-independent-degraded', '.px-room-stage-shell', '.px-room-stage', '.px-project-media-controls', '.px-recording-consent-shell', '.px-lounge-strip'];
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

async function assertNoCriticalOverlap(page, fileName, viewport) {
  const result = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const selectors = ['.px-room-stage-actions', '.px-project-media-controls', '.px-recording-consent-shell', '.px-room-member-strip', '.px-lounge-strip', '.px-stage-fullscreen-shell', '.pxds-degraded'];
      const elements = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((element) => ({ selector, element })));
      const visible = elements.map(({ selector, element }) => {
        const rect = element.getBoundingClientRect();
        return { selector, element, rect };
      }).filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < ${viewport.height});
      const overlaps = [];
      for (let i = 0; i < visible.length; i += 1) {
        for (let j = i + 1; j < visible.length; j += 1) {
          const left = visible[i];
          const right = visible[j];
          if (left.element.contains(right.element) || right.element.contains(left.element)) continue;
          const x = Math.max(0, Math.min(left.rect.right, right.rect.right) - Math.max(left.rect.left, right.rect.left));
          const y = Math.max(0, Math.min(left.rect.bottom, right.rect.bottom) - Math.max(left.rect.top, right.rect.top));
          if (x * y > 8) overlaps.push({ left: left.selector, right: right.selector, area: Math.round(x * y) });
        }
      }
      const occluded = visible.flatMap(({ selector, element, rect }) => {
        const x = Math.max(1, Math.min(${viewport.width - 1}, rect.left + rect.width / 2));
        const y = Math.max(1, Math.min(${viewport.height - 1}, rect.top + rect.height / 2));
        const top = document.elementFromPoint(x, y);
        return top && !element.contains(top) && !top.contains(element)
          ? [{ selector, top: top.className || top.tagName, x: Math.round(x), y: Math.round(y) }]
          : [];
      });
      return { ok: overlaps.length === 0 && occluded.length === 0, overlaps, occluded };
    })()`,
    returnByValue: true,
  });
  const value = result.result.value ?? { ok: false };
  if (!value.ok) {
    throw new Error(`Critical overlap/occlusion detected for ${fileName}: ${JSON.stringify(value)}`);
  }
}

function clickButtonExpression(label) {
  return `
    (() => {
      const button = Array.from(document.querySelectorAll('button')).find((element) =>
        (element.textContent || '').toLowerCase().includes(${JSON.stringify(label)})
      );
      button?.click();
      return true;
    })()
  `;
}

mkdirSync(evidenceDir, { recursive: true });
const vite = await launchVite();
const chrome = await launchChrome();
try {
  await capture({ width: 1366, height: 768 }, 'media-consent-1366.png', {
    setupExpression: `
      (async () => {
        ${clickButtonExpression('drop in')};
        await new Promise((resolve) => setTimeout(resolve, 400));
        document.querySelector('.px-project-media-controls')?.scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
      })()
    `,
    markers: [
      'project media',
      'mic',
      'camera',
      'screen',
      'live sfu media is not connected',
      'leave room',
      'closeout',
      'transport diagnostics',
      'stage evidence and closeout',
    ],
  });

  await capture({ width: 1366, height: 768 }, 'permission-denied-1366.png', {
    mock: {
      deviceError: true,
    },
    markers: [
      'media device error',
      'you can still leave or save closeout',
      'independent degraded states',
      'project media transport deferred',
    ],
  });

  await capture({ width: 1366, height: 768 }, 'sfu-unavailable-1366.png', {
    setupExpression: `
      (async () => {
        ${clickButtonExpression('drop in')};
        await new Promise((resolve) => setTimeout(resolve, 400));
        document.querySelector('.px-project-media-diagnostics')?.setAttribute('open', '');
        document.querySelector('.px-project-media-controls')?.scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
      })()
    `,
    markers: [
      'live sfu media is not connected',
      'true live sfu proof',
      'local visual fallback is not live proof',
      'controls gated',
      'no hidden publish',
    ],
  });

  await capture({ width: 1366, height: 768 }, 'degraded-states-1366.png', {
    mock: {
      floorError: true,
      roomDetailError: true,
      loungeError: true,
      deviceError: true,
    },
    setupExpression: `
      (async () => {
        ${clickButtonExpression('drop in')};
        await new Promise((resolve) => setTimeout(resolve, 400));
        return true;
      })()
    `,
    markers: [
      'independent degraded states',
      'floor presence is unavailable',
      'focused room detail unavailable',
      'media device error',
      'lounge unavailable',
      'live sfu media is not connected',
    ],
  });

  await capture({ width: 1040, height: 700 }, 'rooms-offline-1040.png', {
    mock: { roomsError: true },
    markers: [
      'independent degraded states',
      'project rooms are unavailable',
      'lounge remains available',
    ],
  });

  writeFileSync(path.join(evidenceDir, 'capture.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: `http://127.0.0.1:${vitePort}/?splash=0&tab=realtime`,
    viewports: ['1366x768', '1040x700'],
    captures: [
      {
        file: 'media-consent-1366.png',
        markers: ['Project media', 'Mic', 'Camera', 'Screen', 'live SFU media is not connected', 'Leave room', 'Closeout', 'Transport diagnostics', 'Stage evidence and closeout'],
      },
      {
        file: 'permission-denied-1366.png',
        markers: ['Media device error', 'you can still leave or save closeout', 'Independent degraded states', 'Project media transport deferred'],
      },
      {
        file: 'sfu-unavailable-1366.png',
        markers: ['live SFU media is not connected', 'True live SFU proof', 'local visual fallback is not live proof', 'controls gated', 'no hidden publish'],
      },
      {
        file: 'degraded-states-1366.png',
        markers: ['Independent degraded states', 'Floor presence is unavailable', 'Focused room detail unavailable', 'Media device error', 'Lounge unavailable', 'live SFU media is not connected'],
      },
      {
        file: 'rooms-offline-1040.png',
        markers: ['Independent degraded states', 'Project rooms are unavailable', 'lounge remains available'],
      },
    ],
    geometryProbes: ['horizontal overflow', 'critical selector overlap', 'elementFromPoint occlusion'],
    criticalSelectors: ['.px-room-stage-actions', '.px-project-media-controls', '.px-recording-consent-shell', '.px-room-member-strip', '.px-lounge-strip', '.px-stage-fullscreen-shell', '.pxds-degraded'],
  }, null, 2));
  writeFileSync(path.join(evidenceDir, 'README.md'), `# Batch21 Co-working Media, Consent, and Degraded-State Evidence

Captured on ${new Date().toISOString()} against the mocked co-working Batch21 harness.

- media-consent-1366.png: joined project stage with gated project media, leave/closeout controls, and collapsed transport and stage-evidence drawers.
- permission-denied-1366.png: device permission denied state is explicit in the independent degraded-state strip.
- sfu-unavailable-1366.png: SFU-unavailable fallback states live-proof boundaries without claiming live media.
- degraded-states-1366.png: floor, room-detail, device, lounge, and transport states render independently while the project stage remains usable.
- rooms-offline-1040.png: rooms-offline state remains isolated and the lounge availability copy stays visible.
- capture.json: marker, overflow, overlap, and elementFromPoint occlusion probe manifest.
`);
} finally {
  await stopChild(chrome);
  await stopChild(vite);
  rmSync(chromeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
