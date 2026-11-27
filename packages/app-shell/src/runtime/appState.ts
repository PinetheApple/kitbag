import { AppState, type AppStateStatus } from 'react-native';

function onAppState(target: AppStateStatus, listener: () => void): void {
  AppState.addEventListener('change', (state) => {
    if (state === target) listener();
  });
}

export function onAppForeground(listener: () => void): void {
  onAppState('active', listener);
}

export function onAppBackground(listener: () => void): void {
  onAppState('background', listener);
}
