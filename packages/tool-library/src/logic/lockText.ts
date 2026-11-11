import type { SongBadge } from '@kitbag/core-state';

export interface LockText {
  readonly title: string;
  readonly detail: string;
  readonly available: boolean;
}

const NO_CLICK = 'No click available';
const LOCK_SOURCE = 'phase auto · from beat grid';
const GRID_READY = 'grid ready';

function withBpm(bpmText: string | null, detail: string): string {
  return bpmText === null ? detail : `${bpmText} · ${detail}`;
}

function unavailable(detail: string): LockText {
  return { title: NO_CLICK, detail, available: false };
}

export function lockText(
  badge: SongBadge,
  click: boolean,
  bpmText: string | null,
): LockText {
  switch (badge) {
    case 'pending':
    case 'analyzing':
      return unavailable(
        'This song is still being analysed. Reopen it once the grid is ready.',
      );
    case 'failed':
      return unavailable('The beat analysis failed for this song.');
    case 'noGrid':
      return unavailable('The analysis found no beats in this song.');
    case 'grid':
      return click
        ? {
            title: 'Metronome locked',
            detail: withBpm(bpmText, LOCK_SOURCE),
            available: true,
          }
        : {
            title: 'Click off',
            detail: withBpm(bpmText, GRID_READY),
            available: true,
          };
  }
}
