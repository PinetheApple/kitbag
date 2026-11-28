export interface FileWorkTracker {
  readonly track: <T>(work: () => Promise<T>) => Promise<T>;
  readonly idleMark: () => number | null;
  readonly stillIdleSince: (mark: number) => boolean;
}

export function fileWorkTracker(): FileWorkTracker {
  let active = 0;
  let changes = 0;
  return {
    track: async (work) => {
      active += 1;
      changes += 1;
      try {
        return await work();
      } finally {
        active -= 1;
        changes += 1;
      }
    },
    idleMark: () => (active === 0 ? changes : null),
    stillIdleSince: (mark) => active === 0 && changes === mark,
  };
}
