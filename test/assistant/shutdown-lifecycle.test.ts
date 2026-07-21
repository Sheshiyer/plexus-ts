import { describe, expect, it, vi } from 'vitest';
import { settleShutdownPipeline, settleShutdownTask } from '../../src/main/shutdown';
import { SerialTaskQueue } from '../../src/main/serial-task-queue';
import { StartupCancelledError, StartupGate } from '../../src/main/startup-gate';

describe('bounded shutdown tasks', () => {
  it('reports a completed task', async () => {
    await expect(settleShutdownTask(Promise.resolve(), 100)).resolves.toEqual({ status: 'settled' });
  });

  it('captures a rejected task without leaking an unhandled rejection', async () => {
    const reason = new Error('offline');
    await expect(settleShutdownTask(Promise.reject(reason), 100)).resolves.toEqual({ status: 'rejected', reason });
  });

  it('releases shutdown when a task exceeds its deadline', async () => {
    vi.useFakeTimers();
    const result = settleShutdownTask(new Promise(() => {}), 3_000);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(result).resolves.toEqual({ status: 'timed-out' });
    vi.useRealTimers();
  });

  it('does not cancel or retry the underlying operation after a timeout', async () => {
    vi.useFakeTimers();
    let resolveOperation!: () => void;
    let commits = 0;
    const operation = new Promise<void>((resolve) => { resolveOperation = resolve; }).then(() => { commits += 1; });
    const result = settleShutdownTask(operation, 3_000);

    await vi.advanceTimersByTimeAsync(3_000);
    await expect(result).resolves.toEqual({ status: 'timed-out' });
    resolveOperation();
    await operation;
    expect(commits).toBe(1);
    vi.useRealTimers();
  });

  it('drains in-flight reads before stopping the timer and closing SQLite', async () => {
    const events: string[] = [];
    let finishRead!: () => void;
    const pendingRead = new Promise<void>((resolve) => { finishRead = resolve; });

    const shutdown = settleShutdownPipeline({
      optionalParallel: [
        async () => { events.push('disconnect'); },
      ],
      criticalSerial: [
        async () => { events.push('read:start'); await pendingRead; events.push('read:end'); },
        async () => { events.push('timer:stop'); },
        async () => { events.push('sqlite:close'); },
      ],
      timeoutMs: 1_000,
    });
    await vi.waitFor(() => expect(events).toEqual(['disconnect', 'read:start']));
    expect(events).not.toContain('sqlite:close');

    finishRead();
    await shutdown;
    expect(events).toEqual(['disconnect', 'read:start', 'read:end', 'timer:stop', 'sqlite:close']);
  });

  it('never advances past an unresolved critical stage when its optional deadline expires', async () => {
    const events: string[] = [];
    let finishRead!: () => void;
    const pendingRead = new Promise<void>((resolve) => { finishRead = resolve; });
    const shutdown = settleShutdownPipeline({
      optionalParallel: [],
      criticalSerial: [
        async () => { events.push('read:start'); await pendingRead; events.push('read:end'); },
        async () => { events.push('sqlite:close'); },
      ],
      timeoutMs: 10,
    });

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(events).toEqual(['read:start']);
    finishRead();
    await shutdown;
    expect(events).toEqual(['read:start', 'read:end', 'sqlite:close']);
  });
});

describe('shutdown timer mutation ordering', () => {
  it('runs the final stop only after an already-started timer mutation commits', async () => {
    const queue = new SerialTaskQueue();
    const events: string[] = [];
    let allowStartCommit!: () => void;
    const startCanCommit = new Promise<void>((resolve) => { allowStartCommit = resolve; });

    const start = queue.run(async () => {
      events.push('start:checked-shutdown');
      await startCanCommit;
      events.push('start:committed');
    });
    await vi.waitFor(() => expect(events).toEqual(['start:checked-shutdown']));

    const finalStop = queue.run(async () => {
      events.push('shutdown:stopped-running-entry');
    });
    expect(events).toEqual(['start:checked-shutdown']);

    allowStartCommit();
    await Promise.all([start, finalStop]);
    expect(events).toEqual([
      'start:checked-shutdown',
      'start:committed',
      'shutdown:stopped-running-entry',
    ]);
  });

  it.each(['pause', 'resume', 'idle action', 'shortcut stop'])('orders an in-flight %s before final stop', async (mutationName) => {
    const queue = new SerialTaskQueue();
    const events: string[] = [];
    let allowMutationWrite!: () => void;
    const mutationCanWrite = new Promise<void>((resolve) => { allowMutationWrite = resolve; });

    const mutation = queue.run(async () => {
      events.push(`${mutationName}:read`);
      await mutationCanWrite;
      events.push(`${mutationName}:write`);
    });
    await vi.waitFor(() => expect(events).toEqual([`${mutationName}:read`]));
    const finalStop = queue.run(async () => { events.push('shutdown:stop'); });

    allowMutationWrite();
    await Promise.all([mutation, finalStop]);
    expect(events).toEqual([`${mutationName}:read`, `${mutationName}:write`, 'shutdown:stop']);
  });
});

describe('startup cancellation ownership', () => {
  it('rolls back a service that finishes starting after shutdown begins', async () => {
    const gate = new StartupGate();
    let finishStart!: () => void;
    const pendingStart = new Promise<void>((resolve) => { finishStart = resolve; });
    const rollback = vi.fn(async () => {});
    const starting = gate.runStep(async () => {
      await pendingStart;
      return 'started';
    }, rollback);

    gate.beginShutdown();
    finishStart();

    await expect(starting).rejects.toBeInstanceOf(StartupCancelledError);
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it('drains ticker work and closes SQLite before exiting after a post-database startup failure', async () => {
    const gate = new StartupGate();
    const events: string[] = ['sqlite:open', 'ticker:start'];
    let finishTickerRead!: () => void;
    const tickerRead = new Promise<void>((resolve) => { finishTickerRead = resolve; });

    const startup = gate.runStep(async () => {
      events.push('api:start');
      throw new Error('port occupied');
    });
    await expect(startup).rejects.toThrow('port occupied');
    events.push('startup:failed');

    const safeExit = settleShutdownPipeline({
      optionalParallel: [],
      criticalSerial: [
        async () => { events.push('ticker:drain'); await tickerRead; events.push('ticker:drained'); },
        async () => { events.push('sqlite:close'); },
      ],
      timeoutMs: 100,
    }).then(() => { events.push('app:exit'); });

    await vi.waitFor(() => expect(events).toContain('ticker:drain'));
    expect(events).not.toContain('sqlite:close');
    expect(events).not.toContain('app:exit');
    finishTickerRead();
    await safeExit;
    expect(events.slice(-3)).toEqual(['ticker:drained', 'sqlite:close', 'app:exit']);
  });
});
