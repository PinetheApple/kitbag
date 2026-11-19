export interface ClickSoundLock {
  run: <T>(work: () => Promise<T>) => Promise<T>;
}

export function createClickSoundLock(): ClickSoundLock {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run: (work) => {
      const result = tail.then(work);
      tail = result.catch(() => undefined);
      return result;
    },
  };
}

export const clickSoundLock = createClickSoundLock();
