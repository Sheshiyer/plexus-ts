export class StartupCancelledError extends Error {
  constructor() {
    super('Plexus startup was cancelled by application shutdown.');
    this.name = 'StartupCancelledError';
  }
}

export class StartupGate {
  private shuttingDown = false;

  beginShutdown(): void {
    this.shuttingDown = true;
  }

  assertActive(): void {
    if (this.shuttingDown) throw new StartupCancelledError();
  }

  async runStep<T>(start: () => Promise<T>, rollback?: (result: T) => Promise<unknown>): Promise<T> {
    this.assertActive();
    const result = await start();
    if (!this.shuttingDown) return result;
    await rollback?.(result);
    throw new StartupCancelledError();
  }
}

/** Port ownership belongs to an optional automation interface, not the desktop lifecycle. */
export async function startLocalApiOrContinue(start: () => Promise<number>, unavailable: () => void): Promise<number | null> {
  try { return await start(); }
  catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EADDRINUSE') throw error;
    unavailable();
    return null;
  }
}
