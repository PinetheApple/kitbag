import type { SongBadge } from '@kitbag/core-state';

export interface LockText {
  readonly title: string;
  readonly detail: string;
  readonly available: boolean;
}

const NO_CLICK = 'No click available';
const LOCK_SOURCE = 'phase auto · from beat grid';

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
      return {
        title: click ? 'Metronome locked' : 'Metronome',
        detail: bpmText === null ? LOCK_SOURCE : `${bpmText} · ${LOCK_SOURCE}`,
        available: true,
      };
  }
}
