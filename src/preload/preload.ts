import { contextBridge, ipcRenderer } from 'electron';
import type { PlexusAPI } from '../shared/types.js';

const api: PlexusAPI = {
  timerStart: (projectId, description, targetSeconds) => ipcRenderer.invoke('timer:start', projectId, description, targetSeconds),
  timerStop: () => ipcRenderer.invoke('timer:stop'),
  timerPause: () => ipcRenderer.invoke('timer:pause'),
  timerResume: () => ipcRenderer.invoke('timer:resume'),
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

  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (settings) => ipcRenderer.invoke('settings:set', settings),

  updatesGetStatus: () => ipcRenderer.invoke('updates:getStatus'),
  updatesCheck: () => ipcRenderer.invoke('updates:check'),
  updatesDownload: () => ipcRenderer.invoke('updates:download'),
  updatesInstall: () => ipcRenderer.invoke('updates:install'),
  onUpdatesStatus: (callback) => {
    const handler = (_event: any, status: any) => callback(status);
    ipcRenderer.on('updates:status', handler);
    return () => ipcRenderer.off('updates:status', handler);
  },

  onTimerTick: (callback) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('timer:tick', handler);
    return () => ipcRenderer.off('timer:tick', handler);
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
  authAccessLogin: () => ipcRenderer.invoke('auth:accessLogin'),
  authSession: () => ipcRenderer.invoke('auth:session'),
  authRefreshSession: () => ipcRenderer.invoke('auth:refreshSession'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authTestJwt: () => ipcRenderer.invoke('auth:testJwt'),
  projectsSync: () => ipcRenderer.invoke('projects:sync'),
  onboardingUpdate: (stepId, state, metadata) => ipcRenderer.invoke('onboarding:update', stepId, state, metadata),
  adminDemoOverview: () => ipcRenderer.invoke('adminDemo:overview'),
  adminDemoOnboardingUpdate: (identityId, stepId, state, metadata) => ipcRenderer.invoke('adminDemo:onboardingUpdate', identityId, stepId, state, metadata),

  // Phase 6 — Agent Fabric Health
  fabricStatus: () => ipcRenderer.invoke('fabric:status'),
  fabricHealthProbe: () => ipcRenderer.invoke('fabric:healthProbe'),
  fabricInstallStatus: () => ipcRenderer.invoke('fabric:installStatus'),
  fabricOrgConfig: () => ipcRenderer.invoke('fabric:orgConfig'),
  fabricAgentSkills: () => ipcRenderer.invoke('fabric:agentSkills'),
  fabricProjectVault: (code) => ipcRenderer.invoke('fabric:projectVault', code),
  fabricAllProjectVaults: () => ipcRenderer.invoke('fabric:allProjectVaults'),
  fabricTaskFeed: () => ipcRenderer.invoke('fabric:taskFeed'),

  // Phase 14 — Realtime Capture Capability Proof
  mediaCaptureStatus: () => ipcRenderer.invoke('media:captureStatus'),
  mediaRequestAccess: (kind) => ipcRenderer.invoke('media:requestAccess', kind),
  mediaOpenPrivacySettings: (kind) => ipcRenderer.invoke('media:openPrivacySettings', kind),
  realtimeRooms: () => ipcRenderer.invoke('realtime:rooms'),
  realtimeRoomDetail: (roomId) => ipcRenderer.invoke('realtime:roomDetail', roomId),
  realtimeJoinRoom: (roomId, input) => ipcRenderer.invoke('realtime:joinRoom', roomId, input),
  realtimePublishTrack: (callId, input) => ipcRenderer.invoke('realtime:publishTrack', callId, input),
  realtimeCloseTrack: (callId, trackId) => ipcRenderer.invoke('realtime:closeTrack', callId, trackId),
  realtimeLeaveCall: (callId, participantId) => ipcRenderer.invoke('realtime:leaveCall', callId, participantId),
  realtimeEndCall: (callId) => ipcRenderer.invoke('realtime:endCall', callId),
  realtimeCloseout: (callId, payload) => ipcRenderer.invoke('realtime:closeout', callId, payload),

  // Phase 7 — Member Provisioning
  memberProvision: () => ipcRenderer.invoke('member:provision'),
  memberSetup: () => ipcRenderer.invoke('member:setup'),

  // Phase 8 — Standup + KPI
  memberKpi: () => ipcRenderer.invoke('member:kpi'),

  // Phase 9 — Preferences + Usage Signals
  memberPreferencesGet: () => ipcRenderer.invoke('member:preferencesGet'),
  memberPreferencesSet: (prefs) => ipcRenderer.invoke('member:preferencesSet', prefs),
  emitUsageSignal: (signal) => ipcRenderer.invoke('member:emitUsageSignal', signal),
};

contextBridge.exposeInMainWorld('plexus', api);
