import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('main-process IPC registration policy', () => {
  it('routes every application channel through the sender-guarded wrapper', () => {
    const main = source('src/main/main.ts');

    expect(main).not.toMatch(/\bipcMain\.handle\s*\(/);
    expect(main.match(/\bguardedHandle\s*\(/g)?.length ?? 0).toBeGreaterThan(100);
  });

  it('keeps explicit runtime schemas on state-changing payload channels', () => {
    const main = source('src/main/main.ts');
    const stateChangingPayloadChannels = [
      'timer:start',
      'entry:create',
      'entry:update',
      'entry:delete',
      'project:create',
      'project:update',
      'project:delete',
      'project:verifyRepo',
      'agentSessions:setConsent',
      'agentSessions:accept',
      'agentSessions:dismiss',
      'github:activitySync',
      'standup:generate',
      'review:generate',
      'breakwork:generatePrompt',
      'assistant:ask',
      'assistant:confirmIntent',
      'assistant:cancelIntent',
      'settings:set',
      'appWindow:setMode',
      'onboarding:update',
      'idle:action',
      'member:emitUsageSignal',
      'media:requestAccess',
      'media:openPrivacySettings',
      'realtime:joinRoom',
      'realtime:publishTrack',
      'realtime:closeTrack',
      'realtime:leaveCall',
      'realtime:endCall',
      'realtime:closeout',
      'member:preferencesSet',
      'handoff:record',
      'handoff:retry',
    ];

    for (const channel of stateChangingPayloadChannels) {
      expect(main).toContain(`guardedHandle('${channel}',`);
      expect(main).not.toContain(`guardedHandle('${channel}', undefined`);
    }
  });

  it('pins production navigation and IPC to the packaged renderer entrypoint', () => {
    const main = source('src/main/main.ts');

    expect(main).toContain('const productionRendererUrl = pathToFileURL(productionRendererPath).href');
    expect(main).toContain(': productionRendererUrl;');
    expect(main).toContain('isAllowedIpcSenderUrl(url, allowedRendererLocation)');
    expect(main).not.toContain("allowedRendererOrigin === 'file://'");
  });

  it('normalizes member usage signals before forwarding them to the worker', () => {
    const main = source('src/main/main.ts');

    expect(main).toContain("guardedHandle('member:emitUsageSignal', recordSchema(normalizeMemberUsageSignal)");
    expect(main).not.toContain("boundedRecord(value, 'Usage signal'");
    expect(main).toContain('const signal = normalizeMemberUsageSignal(retrying.payload.signal);');
  });

  it('never passes an unvalidated legacy Worker URL to member helper processes', () => {
    const main = source('src/main/main.ts');

    expect(main).not.toContain("getSetting('tf.baseUrl')");
    expect(main).toContain('const { baseUrl } = await getWorkerConfig();');
  });
});
