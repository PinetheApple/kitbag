import { BPM_LOOKUP_SOURCE, type BpmLookupSource } from '@kitbag/core-db';

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

export interface SourceCredit {
  readonly name: string;
  readonly url: string;
}

export const BPM_SOURCE_CREDIT: Readonly<
  Record<BpmLookupSource, SourceCredit>
> = {
  getsongbpm: { name: 'GetSongBPM', url: 'https://getsongbpm.com' },
};

export function sourceText(source: BpmSource): string {
  return `via ${BPM_SOURCE_LABEL[source]}`;
}

export function notFoundText(tried: readonly LadderRung[]): string {
  return `Not found · ${tried.map((rung) => BPM_SOURCE_LABEL[rung]).join(', ')}`;
}
