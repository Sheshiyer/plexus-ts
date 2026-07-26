let repositoryBindingQueue: Promise<void> = Promise.resolve();

export async function serializeGitHubRepositoryBinding<T>(work: () => Promise<T>): Promise<T> {
  const previous = repositoryBindingQueue;
  let release = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  repositoryBindingQueue = previous.catch(() => {}).then(() => current);
  await previous.catch(() => {});
  try {
    return await work();
  } finally {
    release();
  }
}
