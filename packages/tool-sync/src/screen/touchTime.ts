import { uptimeToBoottimeMs } from '@kitbag/core-native';
import type { GestureResponderEvent } from 'react-native';

export function touchedAtBoottimeMs(event: GestureResponderEvent): number {
  return uptimeToBoottimeMs(event.nativeEvent.timestamp);
}
