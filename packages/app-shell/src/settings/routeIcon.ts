import type { IconName } from '@kitbag/core-design';
import type { OutputRouteKind } from '@kitbag/core-native';

export const ROUTE_ICON: Readonly<Record<OutputRouteKind, IconName>> = {
  speaker: 'routeSpeaker',
  wired: 'routeWired',
  bluetooth: 'routeBluetooth',
  usb: 'routeUsb',
  other: 'routeOther',
};
