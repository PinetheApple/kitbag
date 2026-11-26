export const LOCK_REFUSAL = {
  noBpm: 'no-bpm',
  noSession: 'no-session',
  paused: 'paused',
  unknownPosition: 'unknown-position',
  noOffer: 'no-offer',
  noGrid: 'no-grid',
  gridRejected: 'grid-rejected',
} as const;

export type LockRefusal = (typeof LOCK_REFUSAL)[keyof typeof LOCK_REFUSAL];

export type LockOutcome =
  | { readonly locked: true }
  | { readonly locked: false; readonly reason: LockRefusal };

export const UNLOCK_REASON = {
  trackChanged: 'track-changed',
} as const;

export type UnlockReason = (typeof UNLOCK_REASON)[keyof typeof UNLOCK_REASON];

export const LOCKED_OUTCOME: LockOutcome = { locked: true };

export const refused = (reason: LockRefusal): LockOutcome => ({
  locked: false,
  reason,
});
