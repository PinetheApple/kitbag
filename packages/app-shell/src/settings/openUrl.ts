import { Linking } from 'react-native';

export function openUrl(url: string): void {
  Linking.openURL(url).catch((error: unknown) => {
    console.warn('[kitbag] could not open link', error);
  });
}
