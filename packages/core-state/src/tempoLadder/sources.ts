import { BPM_LOOKUP_SOURCE, type BpmLookupSource } from '@kitbag/core-db';

import type { SourceCredit } from '../creditLink.ts';

export const BPM_SOURCE = {
  library: 'library',
  ...BPM_LOOKUP_SOURCE,
  tap: 'tap',
  manual: 'manual',
} as const;

export type BpmSource = (typeof BPM_SOURCE)[keyof typeof BPM_SOURCE];
export type LadderRung = typeof BPM_SOURCE.library | BpmLookupSource;

export const BPM_SOURCE_LABEL: Readonly<Record<BpmSource, string>> = {
  library: 'Library',
  getsongbpm: 'GetSongBPM',
  tap: 'Tap',
  manual: 'Typed',
};

export const BPM_SOURCE_CREDIT: Readonly<
  Record<BpmLookupSource, SourceCredit>
> = {
  getsongbpm: { name: 'GetSongBPM', url: 'https://getsongbpm.com' },
};

export function sourceText(source: BpmSource): string {
  return `via ${BPM_SOURCE_LABEL[source]}`;
}

export const NOT_FOUND_TEXT = 'Not found';

export function notFoundText(tried: readonly LadderRung[]): string {
  if (tried.length === 0) return NOT_FOUND_TEXT;
  const names = tried.map((rung) => BPM_SOURCE_LABEL[rung]);
  return `${NOT_FOUND_TEXT} · ${names.join(', ')}`;
}
