import { Badge, type IconName } from '@kitbag/core-design';
import type { OutputRouteKind } from '@kitbag/core-native';

import { OptionRow } from './OptionRow.tsx';

const ROUTE_ICON: Readonly<Record<OutputRouteKind, IconName>> = {
  speaker: 'routeSpeaker',
  wired: 'routeWired',
  bluetooth: 'routeBluetooth',
  usb: 'routeUsb',
  other: 'routeOther',
};

export interface RouteRowProps {
  readonly kind: OutputRouteKind;
  readonly title: string;
  readonly meta: string;
  readonly active: boolean;
  readonly offset?: string;
  readonly onPress?: () => void;
}

export function RouteRow({
  kind,
  title,
  meta,
  active,
  offset,
  onPress,
}: RouteRowProps) {
  return (
    <OptionRow
      icon={ROUTE_ICON[kind]}
      title={title}
      meta={meta}
      singleLine
      highlighted={active}
      {...(onPress === undefined
        ? {}
        : {
            onPress,
            accessibilityLabel: [title, meta, offset]
              .filter((part) => part !== undefined)
              .join(', '),
          })}
      trailing={
        offset === undefined ? null : (
          <Badge tone={active ? 'accent' : 'default'} label={offset} />
        )
      }
    />
  );
}
