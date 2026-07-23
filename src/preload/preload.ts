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
  projectRepoOptions: (projectId) => ipcRenderer.invoke('project:repoOptions', projectId),
  projectVerifyRepo: (projectId, repoUrl) => ipcRenderer.invoke('project:verifyRepo', projectId, repoUrl),
  projectScanVault: () => ipcRenderer.invoke('project:scanVault'),
  projectImportVault: () => ipcRenderer.invoke('project:importVault'),

  agentSessionStatus: () => ipcRenderer.invoke('agentSessions:status'),
  agentSessionScan: () => ipcRenderer.invoke('agentSessions:scan'),
  agentSessionSetConsent: (enabled) => ipcRenderer.invoke('agentSessions:setConsent', enabled),
  agentSessionAccept: (candidateId) => ipcRenderer.invoke('agentSessions:accept', candidateId),
  agentSessionDismiss: (candidateId) => ipcRenderer.invoke('agentSessions:dismiss', candidateId),

  reportDaily: (date) => ipcRenderer.invoke('report:daily', date),
  reportWeekly: (weekStart) => ipcRenderer.invoke('report:weekly', weekStart),
  reportMonthly: (month) => ipcRenderer.invoke('report:monthly', month),
  evidenceStatus: (from, to) => ipcRenderer.invoke('evidence:status', from, to),
  githubActivitySync: (projectId, from, to) => ipcRenderer.invoke('github:activitySync', projectId, from, to),
  standupGenerate: (date) => ipcRenderer.invoke('standup:generate', date),
  reviewGenerate: (kind, periodStart) => ipcRenderer.invoke('review:generate', kind, periodStart),
  breakworkGeneratePrompt: (input) => ipcRenderer.invoke('breakwork:generatePrompt', input),
  assistantStatus: () => ipcRenderer.invoke('assistant:status'),
  assistantCapabilities: () => ipcRenderer.invoke('assistant:capabilities'),
  assistantAsk: (request) => ipcRenderer.invoke('assistant:ask', request),
  assistantSuggestions: (input) => ipcRenderer.invoke('assistant:suggestions', input),
  assistantConfirmIntent: (intentId) => ipcRenderer.invoke('assistant:confirmIntent', intentId),
  assistantCancelIntent: (intentId) => ipcRenderer.invoke('assistant:cancelIntent', intentId),
  assistantModelStatus: () => ipcRenderer.invoke('assistant:modelStatus'),
  assistantModelSetConfig: (input) => ipcRenderer.invoke('assistant:modelSetConfig', input),
  assistantModelHealth: (input) => ipcRenderer.invoke('assistant:modelHealth', input),
  assistantModelCatalog: () => ipcRenderer.invoke('assistant:modelCatalog'),
  onAssistantEvent: (callback) => {
    const handler = (_event: any, event: any) => callback(event);
    ipcRenderer.on('assistant:event', handler);
    return () => ipcRenderer.off('assistant:event', handler);
  },

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
  thoughtseedBridgeStatus: () => ipcRenderer.invoke('thoughtseed:bridgeStatus'),
  thoughtseedRedeemInvite: (input) => ipcRenderer.invoke('thoughtseed:redeemInvite', input),
  thoughtseedSendHeartbeat: () => ipcRenderer.invoke('thoughtseed:sendHeartbeat'),
  thoughtseedPollDirectives: () => ipcRenderer.invoke('thoughtseed:pollDirectives'),
  thoughtseedAckDirectives: (ids) => ipcRenderer.invoke('thoughtseed:ackDirectives', ids),
  thoughtseedRotateBridgeToken: () => ipcRenderer.invoke('thoughtseed:rotateBridgeToken'),
  thoughtseedDisconnectBridge: () => ipcRenderer.invoke('thoughtseed:disconnectBridge'),
  thoughtseedFabricTasks: () => ipcRenderer.invoke('thoughtseed:fabricTasks'),
  thoughtseedSyncFabricTasks: () => ipcRenderer.invoke('thoughtseed:syncFabricTasks'),
  thoughtseedSetFabricTaskWorkMode: (taskId, workMode) => ipcRenderer.invoke('thoughtseed:setFabricTaskWorkMode', taskId, workMode),
  thoughtseedReportFabricTask: (input) => ipcRenderer.invoke('thoughtseed:reportFabricTask', input),
  authLogin: (email) => ipcRenderer.invoke('auth:login', email),
  authAccessLogin: () => ipcRenderer.invoke('auth:accessLogin'),
  authSession: () => ipcRenderer.invoke('auth:session'),
  authRefreshSession: () => ipcRenderer.invoke('auth:refreshSession'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authTestJwt: () => ipcRenderer.invoke('auth:testJwt'),
  projectsSync: () => ipcRenderer.invoke('projects:sync'),
  onboardingUpdate: (stepId, state, metadata) => ipcRenderer.invoke('onboarding:update', stepId, state, metadata),
  onboardingMarkComplete: () => ipcRenderer.invoke('onboarding:markComplete'),
  adminDemoOverview: () => ipcRenderer.invoke('adminDemo:overview'),
  adminDemoOnboardingUpdate: (identityId, stepId, state, metadata) => ipcRenderer.invoke('adminDemo:onboardingUpdate', identityId, stepId, state, metadata),

  // Phase 6 — Agent Fabric Health
  fabricStatus: () => ipcRenderer.invoke('fabric:status'),
  fabricHealthProbe: () => ipcRenderer.invoke('fabric:healthProbe'),
  fabricInstallStatus: () => ipcRenderer.invoke('fabric:installStatus'),

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
  recordingStart: (roomId, input) => ipcRenderer.invoke('realtime:recordingStart', roomId, input),
  recordingStop: (recordingId) => ipcRenderer.invoke('realtime:recordingStop', recordingId),
  recordingFinalize: (recordingId) => ipcRenderer.invoke('realtime:recordingFinalize', recordingId),

  // 0.4.0 — Co-working presence
  coworkingFloor: () => ipcRenderer.invoke('coworking:floor'),
  coworkingLounge: () => ipcRenderer.invoke('coworking:lounge'),

  // Phase 7 — Member Provisioning
  memberProvision: () => ipcRenderer.invoke('member:provision'),
  memberSetup: () => ipcRenderer.invoke('member:setup'),

  // Phase 8 — Standup + KPI
  memberKpi: () => ipcRenderer.invoke('member:kpi'),

  // Phase 9 — Preferences + Usage Signals
  memberPreferencesGet: () => ipcRenderer.invoke('member:preferencesGet'),
  memberPreferencesSet: (prefs) => ipcRenderer.invoke('member:preferencesSet', prefs),
  emitUsageSignal: (signal) => ipcRenderer.invoke('member:emitUsageSignal', signal),

  // App-wide resilience handoffs
  handoffList: (status) => ipcRenderer.invoke('handoff:list', status),
  handoffRecord: (input) => ipcRenderer.invoke('handoff:record', input),
  handoffRetry: (id) => ipcRenderer.invoke('handoff:retry', id),
};

contextBridge.exposeInMainWorld('plexus', api);
