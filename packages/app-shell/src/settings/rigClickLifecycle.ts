import type { AppStateStatus } from 'react-native';

export interface AppStateSource {
  readonly addEventListener: (
    type: 'change',
    listener: (state: AppStateStatus) => void,
  ) => { readonly remove: () => void };
}

export function attachRigClick(
  click: { readonly stop: () => void },
  appState: AppStateSource,
): () => void {
  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'background') click.stop();
  });
  return () => {
    subscription.remove();
    click.stop();
  };
}
