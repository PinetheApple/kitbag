import type { AppStateStatus } from 'react-native';

export interface AppStateSource {
  readonly addEventListener: (
    type: 'change',
    listener: (state: AppStateStatus) => void,
  ) => { readonly remove: () => void };
}

export type HoldEngine = () => () => void;

// Holding keeps the device draining the command ring; unheld, slider and
// stepper commands pile up until the ring drops them.
export function attachRig(
  click: { readonly stop: () => void },
  holdEngine: HoldEngine,
  appState: AppStateSource,
): () => void {
  let release: (() => void) | null = holdEngine();
  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'background') {
      click.stop();
      release?.();
      release = null;
    } else if (state === 'active') {
      release ??= holdEngine();
    }
  });
  return () => {
    subscription.remove();
    click.stop();
    release?.();
    release = null;
  };
}
