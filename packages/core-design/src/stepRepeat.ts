export const STEP_REPEAT = { delayMs: 400, intervalMs: 50 } as const;

export interface StepRepeat {
  readonly hold: (step: () => void) => void;
  readonly release: () => void;
}

export function createStepRepeat(): StepRepeat {
  let timer: ReturnType<typeof setInterval> | null = null;
  const release = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  return {
    hold: (step) => {
      release();
      step();
      timer = setInterval(step, STEP_REPEAT.intervalMs);
    },
    release,
  };
}
