export const BPM_LOOKUP_SOURCE = {
  getSongBpm: 'getsongbpm',
} as const;

export type BpmLookupSource =
  (typeof BPM_LOOKUP_SOURCE)[keyof typeof BPM_LOOKUP_SOURCE];

export function isBpmLookupSource(value: unknown): value is BpmLookupSource {
  return Object.values(BPM_LOOKUP_SOURCE).some((source) => source === value);
}
