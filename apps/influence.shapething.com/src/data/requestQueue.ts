/**
 * A queue for the requests to one service: at most `maxParallel` run at a time, the rest wait their
 * turn. A list of works or albums can ask for dozens of covers at once.
 */
export const createRequestQueue = (maxParallel: number) => {
  let running = 0;
  const waiting: Array<() => void> = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= maxParallel) await new Promise<void>((resolve) => waiting.push(resolve));
    running++;
    try {
      return await task();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
};
