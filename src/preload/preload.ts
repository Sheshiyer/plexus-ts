import { contextBridge, ipcRenderer } from 'electron';
import type { PlexusAPI } from '../shared/types.js';

const api: PlexusAPI = {
  timerStart: (projectId, description) => ipcRenderer.invoke('timer:start', projectId, description),
  timerStop: () => ipcRenderer.invoke('timer:stop'),
  timerGetState: () => ipcRenderer.invoke('timer:getState'),

  entryList: (from, to) => ipcRenderer.invoke('entry:list', from, to),
  entryCreate: (entry) => ipcRenderer.invoke('entry:create', entry),
  entryUpdate: (id, patch) => ipcRenderer.invoke('entry:update', id, patch),
  entryDelete: (id) => ipcRenderer.invoke('entry:delete', id),

  projectList: () => ipcRenderer.invoke('project:list'),
  projectCreate: (project) => ipcRenderer.invoke('project:create', project),
  projectUpdate: (id, patch) => ipcRenderer.invoke('project:update', id, patch),
  projectDelete: (id) => ipcRenderer.invoke('project:delete', id),

  reportDaily: (date) => ipcRenderer.invoke('report:daily', date),
  reportWeekly: (weekStart) => ipcRenderer.invoke('report:weekly', weekStart),
  reportMonthly: (month) => ipcRenderer.invoke('report:monthly', month),

  syncToPaperclip: (month) => ipcRenderer.invoke('sync:paperclip', month),
  pushToMultiCA: (month) => ipcRenderer.invoke('sync:multica', month),
  archiveToR2: (month) => ipcRenderer.invoke('sync:r2', month),

  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (settings) => ipcRenderer.invoke('settings:set', settings),

  onTimerTick: (callback) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('timer:tick', handler);
    return () => ipcRenderer.off('timer:tick', handler);
  },
  onBridgeStatus: (callback) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('bridge:status', handler);
    return () => ipcRenderer.off('bridge:status', handler);
  },

  onIdleDetected: (callback) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('idle:detected', handler);
    return () => ipcRenderer.off('idle:detected', handler);
  },

  idleAction: (entryId, action, idleMs) => ipcRenderer.invoke('idle:action', entryId, action, idleMs),

  backupList: () => ipcRenderer.invoke('backup:list'),
  backupRestore: (path) => ipcRenderer.invoke('backup:restore', path),
  backupRun: () => ipcRenderer.invoke('backup:run'),

  workerConfigGet: () => ipcRenderer.invoke('worker:configGet'),
  workerConfigSet: (cfg) => ipcRenderer.invoke('worker:configSet', cfg),
  workerStatus: () => ipcRenderer.invoke('worker:status'),
  authLogin: (email) => ipcRenderer.invoke('auth:login', email),
  authSession: () => ipcRenderer.invoke('auth:session'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  projectsSync: () => ipcRenderer.invoke('projects:sync'),
};

contextBridge.exposeInMainWorld('plexus', api);
