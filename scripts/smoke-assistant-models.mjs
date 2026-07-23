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
  assert.ok(config.selectedProvider, 'Live smoke requires GOOGLE_GENERATIVE_AI_API_KEY or NVIDIA_API_KEY.');
  console.log(`assistant model live smoke configuration ready: ${config.selectedProvider}`);
  process.exit(0);
}

const config = resolveAssistantModelConfig({
  provider: 'google',
  googleApiKey: 'fixture-google-key',
  nvidiaApiKey: 'fixture-nvidia-key',
  googleModel: 'fixture-google',
  nvidiaModel: 'fixture-nvidia',
}, {});

const failingGoogle = {
  id: 'google',
  model: 'fixture-google',
  configured: true,
  async generate() {
    throw new AssistantModelError('fixture transient network failure', {
      kind: 'network',
      provider: 'google',
      retryable: true,
    });
  },
  async stream() {
    throw new AssistantModelError('fixture transient network failure', {
      kind: 'network',
      provider: 'google',
      retryable: true,
    });
  },
  async health() {
    return {
      provider: 'google',
      model: 'fixture-google',
      state: 'offline',
      configured: true,
      checkedAt: now().toISOString(),
      message: 'fixture transient network failure',
    };
  },
};

const nvidiaFallback = {
  ...createMockAssistantModelProvider({
    model: 'fixture-nvidia',
    content: 'Fallback model response',
    now,
  }),
  id: 'nvidia',
  async generate() {
    return {
      provider: 'nvidia',
      model: 'fixture-nvidia',
      content: 'Fallback model response',
      metadata: { deterministic: true },
    };
  },
};

const router = new AssistantModelRouter(config, [failingGoogle, nvidiaFallback]);
const result = await router.generate({
  messages: [{ role: 'user', content: 'Summarize today.' }],
});

assert.equal(result.provider, 'nvidia');
assert.equal(result.content, 'Fallback model response');
assert.equal(result.metadata.fallback, true);
assert.equal(result.metadata.primaryProvider, 'google');
assert.equal(result.metadata.finalProvider, 'nvidia');
assert.deepEqual(result.metadata.attempts, [{ provider: 'google', status: 'failed', kind: 'network' }]);

const hungGoogle = {
  id: 'google',
  model: 'fixture-google',
  configured: true,
  async generate() {
    return new Promise(() => {});
  },
  async stream() {
    return new Promise(() => {});
  },
  async health() {
    return {
      provider: 'google',
      model: 'fixture-google',
      state: 'ok',
      configured: true,
      checkedAt: now().toISOString(),
    };
  },
};

const timeoutRouter = new AssistantModelRouter(config, [hungGoogle, nvidiaFallback], { providerTimeoutMs: 5 });
const timeoutResult = await timeoutRouter.generate({
  messages: [{ role: 'user', content: 'Summarize timeout.' }],
});

assert.equal(timeoutResult.provider, 'nvidia');
assert.deepEqual(timeoutResult.metadata.attempts, [{ provider: 'google', status: 'failed', kind: 'timeout' }]);

console.log('assistant model smoke passed: mock fallback moved from google to nvidia with network and timeout attempt metadata');
