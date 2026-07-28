import assert from 'node:assert/strict';
import {
  AssistantModelError,
  AssistantModelRouter,
  createMockAssistantModelProvider,
  resolveAssistantModelConfig,
} from '../dist/main/assistant-models.js';

const now = () => new Date('2026-07-01T09:00:00.000Z');
const runLive = process.env.ASSISTANT_LIVE_MODEL_SMOKE === '1';

if (runLive) {
  const config = resolveAssistantModelConfig({ provider: 'auto' });
  assert.equal(config.selectedProvider, 'omniroute');
  assert.equal(config.laneId, 'te-build');
  console.log('assistant model live smoke configuration ready: omniroute/te-build');
  process.exit(0);
}

const config = resolveAssistantModelConfig({
  provider: 'auto',
  laneId: 'te-build',
}, {});

const failingOmniRoute = {
  id: 'omniroute',
  model: 'te-build',
  configured: true,
  async generate() {
    throw new AssistantModelError('fixture gateway offline', {
      kind: 'network',
      provider: 'omniroute',
      retryable: true,
    });
  },
  async stream() {
    throw new AssistantModelError('fixture gateway offline', {
      kind: 'network',
      provider: 'omniroute',
      retryable: true,
    });
  },
  async health() {
    return {
      provider: 'omniroute',
      model: 'te-build',
      state: 'offline',
      configured: true,
      checkedAt: now().toISOString(),
      message: 'fixture gateway offline',
    };
  },
};

const router = new AssistantModelRouter(config, [
  failingOmniRoute,
  createMockAssistantModelProvider({ content: 'must not run', now }),
]);
await assert.rejects(
  router.generate({ messages: [{ role: 'user', content: 'Summarize today.' }] }),
  error => error?.provider === 'omniroute' && error?.kind === 'network',
);

const mockConfig = resolveAssistantModelConfig({ provider: 'mock' }, {});
const mockRouter = new AssistantModelRouter(mockConfig, [
  failingOmniRoute,
  createMockAssistantModelProvider({ content: 'Explicit mock response', now }),
]);
const mockResult = await mockRouter.generate({ messages: [{ role: 'user', content: 'Test.' }] });
assert.equal(mockResult.provider, 'mock');
assert.equal(mockResult.content, 'Explicit mock response');

console.log('assistant model smoke passed: OmniRoute fails closed and mock remains explicit');
