export type ShutdownTaskResult =
  | { status: 'settled' }
  | { status: 'rejected'; reason: unknown }
  | { status: 'timed-out' };

export async function settleShutdownTask(task: Promise<unknown>, timeoutMs: number): Promise<ShutdownTaskResult> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timedOut = new Promise<ShutdownTaskResult>((resolve) => {
    timeout = setTimeout(() => resolve({ status: 'timed-out' }), timeoutMs);
  });
  const settled = task.then<ShutdownTaskResult, ShutdownTaskResult>(
    () => ({ status: 'settled' }),
    (reason: unknown) => ({ status: 'rejected', reason }),
  );

  try {
    return await Promise.race([settled, timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function settleShutdownPipeline(input: {
  optionalParallel: ReadonlyArray<() => Promise<unknown>>;
  criticalSerial: ReadonlyArray<() => Promise<unknown>>;
  timeoutMs: number;
}): Promise<ShutdownTaskResult[]> {
  const invokeOptional = (task: () => Promise<unknown>) => (
    settleShutdownTask(Promise.resolve().then(task), input.timeoutMs)
  );
  const results = await Promise.all(input.optionalParallel.map(invokeOptional));
  for (const task of input.criticalSerial) {
    try {
      await task();
      results.push({ status: 'settled' });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
  }
  return results;
}
