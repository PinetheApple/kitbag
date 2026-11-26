export const SAVE_REFUSAL = {
  notLocked: 'not-locked',
  writeFailed: 'write-failed',
} as const;

export type SaveRefusal = (typeof SAVE_REFUSAL)[keyof typeof SAVE_REFUSAL];

export type SaveOutcome =
  | { readonly saved: true }
  | { readonly saved: false; readonly reason: SaveRefusal };

export interface TrackPresetState {
  readonly savedForTrack: boolean;
}

export interface TrackPresetActions {
  readonly saveForTrack: () => Promise<SaveOutcome>;
}
