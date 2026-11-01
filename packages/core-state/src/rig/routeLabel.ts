import type { OutputRoute, OutputRouteKind } from '@kitbag/core-native';

const KIND_TITLE: Readonly<Record<OutputRouteKind, string>> = {
  speaker: 'Phone speaker',
  wired: 'Wired headphones',
  bluetooth: 'Bluetooth',
  usb: 'USB',
  other: 'Audio output',
};

const KIND_DETAIL: Readonly<Record<OutputRouteKind, string | null>> = {
  speaker: null,
  wired: '3.5 mm',
  bluetooth: 'Bluetooth',
  usb: 'USB',
  other: null,
};

const NAMED_BY_KIND: ReadonlySet<OutputRouteKind> = new Set([
  'speaker',
  'wired',
]);

export function isOutputRouteKind(kind: string): kind is OutputRouteKind {
  return Object.hasOwn(KIND_TITLE, kind);
}

export function routeTitle(route: OutputRoute): string {
  if (NAMED_BY_KIND.has(route.kind)) return KIND_TITLE[route.kind];
  const name = route.name.trim();
  return name === '' ? KIND_TITLE[route.kind] : name;
}

export function routeDetail(route: OutputRoute): string | null {
  return KIND_DETAIL[route.kind];
}
