import { app, BrowserWindow, ipcMain } from 'electron';
import { createTray, updateTrayMenu, destroyTray } from './tray.js';
import { registerShortcuts, unregisterShortcuts } from './shortcuts.js';
import { startIdleDetection, stopIdleDetection, handleIdleAction } from './idle.js';
import { startApiServer, stopApiServer } from './api-server.js';
import { startAutoBackup, stopAutoBackup } from './backup.js';
import { getFabricStatus } from './fabric.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import {
  getDb, listProjects, insertProject, updateProject, deleteProject,
  listEntries, insertEntry, updateEntry, deleteEntry, getRunningEntry,
  getSetting, setSetting
} from '../db/database.js';
import { archiveToR2 } from '../bridge/r2.js';
import type { TimeEntry, Project, PlexusSettings, TimerState } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else if (app.isReady()) {
      createWindow();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await getDb();
  createWindow();
  startTimerTicker();
  if (mainWindow) {
    createTray(mainWindow);
    registerShortcuts(mainWindow);
    startIdleDetection(mainWindow);
  }
  await startApiServer();
  startAutoBackup();
  setInterval(() => { import('./teamforge.js').then(m => m.flushTimeEntries()).catch(() => {}); }, 5 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (timerInterval) clearInterval(timerInterval);
  destroyTray();
  unregisterShortcuts();
  stopIdleDetection();
  stopApiServer();
  stopAutoBackup();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  const running = await getRunningEntry();
  if (running) {
    const now = new Date().toISOString();
    const duration = Math.floor((new Date(now).getTime() - new Date(running.startTime).getTime()) / 1000);
    await updateEntry(running.id, { endTime: now, durationSeconds: duration });
  }
});

let sessionStartTime: number | null = null;
let activeProjectId: string | null = null;

function startTimerTicker() {
  timerInterval = setInterval(async () => {
    const running = await getRunningEntry();
    if (running && mainWindow) {
      if (!sessionStartTime) {
        sessionStartTime = Date.now();
        activeProjectId = running.projectId;
      }
      const state: TimerState = {
        running: true,
        entryId: running.id,
        startTime: running.startTime,
        projectId: running.projectId,
        description: running.description,
      };
      mainWindow.webContents.send('timer:tick', state);
      await updateTrayMenu(mainWindow);
    } else {
      sessionStartTime = null;
      activeProjectId = null;
    }
  }, 1000);
}

// IPC Handlers
ipcMain.handle('timer:start', async (_event, projectId: string, description: string): Promise<TimeEntry> => {
  const running = await getRunningEntry();
  if (running) {
    const now = new Date().toISOString();
    const duration = Math.floor((new Date(now).getTime() - new Date(running.startTime).getTime()) / 1000);
    await updateEntry(running.id, { endTime: now, durationSeconds: duration });
  }
  const entry: TimeEntry = {
    id: randomUUID(),
    projectId,
    description,
    startTime: new Date().toISOString(),
    durationSeconds: 0,
    tags: [],
    source: 'timer',
  };
  await insertEntry(entry);
  return entry;
});

ipcMain.handle('timer:stop', async (): Promise<TimeEntry | null> => {
  const running = await getRunningEntry();
  if (!running) return null;
  const now = new Date().toISOString();
  const duration = Math.floor((new Date(now).getTime() - new Date(running.startTime).getTime()) / 1000);
  await updateEntry(running.id, { endTime: now, durationSeconds: duration });
  import('./teamforge.js').then(m => m.flushTimeEntries()).catch(() => {});

  // Phase 9: emit usage signal (best-effort, non-blocking)
  try {
    const sessionDurationMin = sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 60000) : 0;
    const signal = {
      timestamp: now,
      activeProject: activeProjectId || running.projectId,
      dailyTotalSeconds: duration,
      standupCompliant: duration >= 60, // >= 1 minute counts as compliance
      sessionDurationMinutes: sessionDurationMin,
    };
    import('./teamforge.js').then(m => m.emitUsageSignal(signal)).catch(() => {});
  } catch { /* ignore */ }

  return { ...running, endTime: now, durationSeconds: duration };
});

ipcMain.handle('timer:getState', async (): Promise<TimerState> => {
  const running = await getRunningEntry();
  if (!running) return { running: false };
  return {
    running: true,
    entryId: running.id,
    startTime: running.startTime,
    projectId: running.projectId,
    description: running.description,
  };
});

ipcMain.handle('entry:list', async (_event, from: string, to: string): Promise<TimeEntry[]> => {
  return listEntries(from, to);
});

ipcMain.handle('entry:create', async (_event, entry): Promise<TimeEntry> => {
  const e: TimeEntry = {
    id: randomUUID(),
    ...entry,
    durationSeconds: entry.durationSeconds ?? 0,
  };
  if (entry.startTime && entry.endTime) {
    e.durationSeconds = Math.floor((new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 1000);
  }
  await insertEntry(e);
  import('./teamforge.js').then(m => m.flushTimeEntries()).catch(() => {});
  return e;
});

ipcMain.handle('entry:update', async (_event, id: string, patch: Partial<TimeEntry>): Promise<TimeEntry> => {
  await updateEntry(id, patch);
  const all = await listEntries('1970-01-01', '2099-12-31');
  return all.find(e => e.id === id)!;
});

ipcMain.handle('entry:delete', async (_event, id: string) => {
  await deleteEntry(id);
});

ipcMain.handle('project:list', async (): Promise<Project[]> => {
  return listProjects();
});

ipcMain.handle('project:create', async (_event, project): Promise<Project> => {
  const p: Project = {
    id: randomUUID(),
    ...project,
    createdAt: new Date().toISOString(),
  };
  await insertProject(p);
  return p;
});

ipcMain.handle('project:update', async (_event, id: string, patch: Partial<Project>): Promise<Project> => {
  await updateProject(id, patch);
  return (await listProjects()).find(p => p.id === id)!;
});

ipcMain.handle('project:delete', async (_event, id: string) => {
  await deleteProject(id);
});

ipcMain.handle('report:daily', async (_event, date: string) => {
  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;
  const entries = await listEntries(from, to);
  const total = entries.reduce((s, e) => s + e.durationSeconds, 0);
  return { date, entries, totalSeconds: total };
});

ipcMain.handle('report:weekly', async (_event, weekStart: string) => {
  const days: any[] = [];
  const start = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const from = `${dateStr}T00:00:00.000Z`;
    const to = `${dateStr}T23:59:59.999Z`;
    const entries = await listEntries(from, to);
    days.push({
      date: dateStr,
      entries,
      totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0),
    });
  }
  const total = days.reduce((s, d) => s + d.totalSeconds, 0);
  return { weekStart, days, totalSeconds: total };
});

ipcMain.handle('report:monthly', async (_event, month: string) => {
  const [year, mon] = month.split('-').map(Number);
  const weeks: any[] = [];
  const firstDay = new Date(Date.UTC(year, mon - 1, 1));
  const lastDay = new Date(Date.UTC(year, mon, 0));
  let current = new Date(firstDay);
  while (current.getDay() !== 1) {
    current.setDate(current.getDate() - 1);
  }
  while (current <= lastDay) {
    const ws = current.toISOString().slice(0, 10);
    const start = new Date(ws);
    const days: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const from = `${ds}T00:00:00.000Z`;
      const to = `${ds}T23:59:59.999Z`;
      const entries = await listEntries(from, to);
      days.push({ date: ds, entries, totalSeconds: entries.reduce((s, e) => s + e.durationSeconds, 0) });
    }
    const wTotal = days.reduce((s, d) => s + d.totalSeconds, 0);
    weeks.push({ weekStart: ws, days, totalSeconds: wTotal });
    current.setDate(current.getDate() + 7);
  }
  const allEntries = await listEntries(`${month}-01T00:00:00.000Z`, `${month}-31T23:59:59.999Z`);
  const projBreakdown: Record<string, number> = {};
  for (const e of allEntries) {
    projBreakdown[e.projectId] = (projBreakdown[e.projectId] || 0) + e.durationSeconds;
  }
  const total = weeks.reduce((s, w) => s + w.totalSeconds, 0);
  return { month, weeks, totalSeconds: total, projectBreakdown: projBreakdown };
});

ipcMain.handle('settings:get', async (): Promise<PlexusSettings> => {
  const defaults: PlexusSettings = {
    memberId: (await getSetting('memberId')) || 'anonymous',
    theme: ((await getSetting('theme')) as any) || 'system',
    defaultProjectId: (await getSetting('defaultProjectId')) || undefined,
    reminderIntervalMinutes: Number(await getSetting('reminderIntervalMinutes')) || 15,
    syncEnabled: (await getSetting('syncEnabled')) === 'true',
  };
  return defaults;
});

ipcMain.handle('settings:set', async (_event, settings: Partial<PlexusSettings>): Promise<PlexusSettings> => {
  if (settings.memberId) await setSetting('memberId', settings.memberId);
  if (settings.theme) await setSetting('theme', settings.theme);
  if (settings.defaultProjectId) await setSetting('defaultProjectId', settings.defaultProjectId);
  if (settings.reminderIntervalMinutes !== undefined) await setSetting('reminderIntervalMinutes', String(settings.reminderIntervalMinutes));
  if (settings.syncEnabled !== undefined) await setSetting('syncEnabled', String(settings.syncEnabled));
  return ipcMain.emit('settings:get', {} as any) as any;
});

// TeamForge control plane (Phase 1)
ipcMain.handle('worker:configGet', async () => {
  const { getWorkerConfig } = await import('./teamforge.js');
  return getWorkerConfig();
});
ipcMain.handle('worker:configSet', async (_event, cfg: { baseUrl?: string; workspaceId?: string; token?: string }) => {
  const { setWorkerConfig } = await import('./teamforge.js');
  return setWorkerConfig(cfg);
});
ipcMain.handle('worker:status', async () => {
  const { workerStatus } = await import('./teamforge.js');
  return workerStatus();
});
ipcMain.handle('auth:login', async (_event, email: string) => {
  const m = await import('./teamforge.js');
  const res = await m.login(email);
  if (res.ok) m.flushTimeEntries().catch(() => {});
  return res;
});
ipcMain.handle('auth:accessLogin', async () => {
  const m = await import('./teamforge.js');
  const res = await m.loginWithAccess();
  if (res.ok) m.flushTimeEntries().catch(() => {});
  return res;
});
ipcMain.handle('auth:session', async () => {
  const { getSession } = await import('./teamforge.js');
  return getSession();
});
ipcMain.handle('auth:logout', async () => {
  const { logout } = await import('./teamforge.js');
  return logout();
});
ipcMain.handle('projects:sync', async () => {
  const { syncProjects } = await import('./teamforge.js');
  return syncProjects();
});

// Idle handling
ipcMain.handle('idle:action', async (_event, entryId: string, action: 'keep' | 'discard' | 'trim', idleMs: number) => {
  await handleIdleAction(entryId, action, idleMs);
});

// Backup
ipcMain.handle('backup:list', async () => {
  const { listBackups } = await import('./backup.js');
  return listBackups();
});

ipcMain.handle('backup:restore', async (_event, backupPath: string) => {
  const { restoreBackup } = await import('./backup.js');
  return restoreBackup(backupPath);
});

ipcMain.handle('backup:run', async () => {
  const { runBackup } = await import('./backup.js');
  runBackup();
});

// Phase 8 — Standup + KPI
ipcMain.handle('member:kpi', async () => {
  const { getMemberKpiSummary } = await import('./teamforge.js');
  return getMemberKpiSummary();
});

// Phase 9 — Usage Signals
ipcMain.handle('member:emitUsageSignal', async (_event, signal) => {
  const { emitUsageSignal } = await import('./teamforge.js');
  return emitUsageSignal(signal);
});

  // Phase 6 — Agent Fabric Health
  ipcMain.handle('fabric:status', async () => getFabricStatus());
  ipcMain.handle('fabric:healthProbe', async () => getFabricStatus());

  // Phase 7 — Member Provisioning
  ipcMain.handle('member:provision', async () => {
    const { provisionMember } = await import('./teamforge.js');
    return provisionMember();
  });
  ipcMain.handle('member:setup', async () => {
    try {
      const { provisionMember } = await import('./teamforge.js');
      const provisioned = await provisionMember();
      if (!provisioned.ok || !provisioned.bundle) return { ok: false, message: provisioned.message || 'Provision failed' };
      const { memberId, memberName } = provisioned.bundle;
      const repoRoot = await getSetting('tf.paperclipRepoRoot');
      if (!repoRoot) return { ok: false, message: 'Paperclip repo root not configured. Provision first.' };
      const script = path.join(repoRoot, 'scripts', 'setup-member.sh');
      if (!existsSync(script)) return { ok: false, message: `setup-member.sh not found at ${script}` };
      const result = await new Promise<{ ok: boolean; output: string }>((resolve) => {
        const child = spawn('bash', [script, '--id', memberId, '--name', memberName], { cwd: repoRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const finish = (r: { ok: boolean; output: string }) => { if (!settled) { settled = true; resolve(r); } };
        const timer = setTimeout(() => { child.kill('SIGTERM'); finish({ ok: false, output: [stdout, stderr, 'Timed out after 60s'].filter(Boolean).join('\n') }); }, 60000);
        child.stdout.on('data', (c) => { stdout += c; });
        child.stderr.on('data', (c) => { stderr += c; });
        child.on('error', (e) => finish({ ok: false, output: String(e) }));
        child.on('close', (code) => finish({ ok: code === 0, output: [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') }));
      });
      return { ok: result.ok, output: result.output, message: result.ok ? `Setup complete for ${memberName}` : 'Setup failed' };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  });

  // Phase 9 — Member Preferences
  ipcMain.handle('member:preferencesGet', async () => {
    const { getMemberPreferences } = await import('./teamforge.js');
    return getMemberPreferences();
  });
  ipcMain.handle('member:preferencesSet', async (_event, prefs: Record<string, unknown>) => {
    const { setMemberPreferences } = await import('./teamforge.js');
    return setMemberPreferences(prefs);
  });
