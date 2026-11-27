export const METER_PLACE = {
  none: 'none',
  first: 'first',
  last: 'last',
} as const;

export type MeterPlace = (typeof METER_PLACE)[keyof typeof METER_PLACE];

export interface LockLayoutInputs {
  readonly locked: boolean;
  readonly drifting: boolean;
  readonly retapping: boolean;
  readonly padHeld: boolean;
}

export interface LockLayout {
  readonly meter: MeterPlace;
  readonly pad: boolean;
}

export function lockLayout({
  locked,
  drifting,
  retapping,
  padHeld,
}: LockLayoutInputs): LockLayout {
  if (!locked) return { meter: METER_PLACE.none, pad: true };
  if (drifting) return { meter: METER_PLACE.first, pad: true };
  if (retapping) return { meter: METER_PLACE.last, pad: true };
  if (padHeld) return { meter: METER_PLACE.none, pad: true };
  return { meter: METER_PLACE.last, pad: false };
}
