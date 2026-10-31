import { AppState } from 'react-native';

export function onAppForeground(listener: () => void): void {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') listener();
  });
}
