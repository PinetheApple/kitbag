export interface PracticeClock {
  readonly playedMs: number;
  readonly stretchStartedAt: number | null;
}

export const IDLE_PRACTICE: PracticeClock = {
  playedMs: 0,
  stretchStartedAt: null,
};

export function practiceAfterRunning(
  clock: PracticeClock,
  running: boolean,
  now: number,
): PracticeClock {
  if (running === (clock.stretchStartedAt !== null)) return clock;
  return running
    ? { ...clock, stretchStartedAt: now }
    : { playedMs: practiceElapsedMs(clock, now), stretchStartedAt: null };
}

export function practiceElapsedMs(clock: PracticeClock, now: number): number {
  return (
    clock.playedMs +
    (clock.stretchStartedAt === null
      ? 0
      : Math.max(0, now - clock.stretchStartedAt))
  );
}

export function resetPracticeClock(
  clock: PracticeClock,
  now: number,
): PracticeClock {
  return {
    playedMs: 0,
    stretchStartedAt: clock.stretchStartedAt === null ? null : now,
  };
}
