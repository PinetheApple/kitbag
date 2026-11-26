import type { IconName } from '@kitbag/core-design';
import type { OutputRoute, OutputRouteKind } from '@kitbag/core-native';
import { routeTitle } from '@kitbag/core-state';
import type { PlayAlongRoute } from '@kitbag/tool-sync';

export const ROUTE_ICON: Readonly<Record<OutputRouteKind, IconName>> = {
  speaker: 'routeSpeaker',
  wired: 'routeWired',
  bluetooth: 'routeBluetooth',
  usb: 'routeUsb',
  other: 'routeOther',
};

export function playAlongRoute(
  live: OutputRoute | null,
): PlayAlongRoute | undefined {
  if (live === null) return undefined;
  return { icon: ROUTE_ICON[live.kind], label: routeTitle(live) };
}
