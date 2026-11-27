import { useMemo, useState } from 'react';

import type { ClickSection } from '../logic/clickView.ts';

type PlayerSheet =
  | 'menu'
  | 'meter'
  | 'export'
  | 'upNext'
  | 'setlists'
  | 'speedKey'
  | 'setTempo';

interface ClickSheetOpen {
  readonly kind: 'click';
  readonly section: ClickSection;
}

export const TEMPO_SHEET = { kind: 'tempo' } as const;

export type OpenSheet = PlayerSheet | ClickSheetOpen | typeof TEMPO_SHEET;

export const clickSectionOf = (sheet: OpenSheet | null) =>
  typeof sheet === 'object' && sheet?.kind === 'click' ? sheet.section : null;

export function usePlayerSheet(retiming: boolean, setId: number | null) {
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const [shownFor, setShownFor] = useState(setId);
  if (sheet !== null && retiming) setSheet(null);
  if (shownFor !== setId) {
    setShownFor(setId);
    if (sheet === 'setTempo') setSheet(null);
  }
  const handlers = useMemo(() => {
    const opener = (next: OpenSheet | null) => () => {
      setSheet(next);
    };
    return {
      openMenu: opener('menu'),
      openMeter: opener('meter'),
      openExport: opener('export'),
      openUpNext: opener('upNext'),
      openSetlists: opener('setlists'),
      openSpeedKey: opener('speedKey'),
      openSetTempo: opener('setTempo'),
      openTempo: opener(TEMPO_SHEET),
      openClick: (section: ClickSection) => {
        setSheet({ kind: 'click', section });
      },
      closeSheet: opener(null),
    };
  }, []);
  return { sheet, ...handlers };
}
