import { useMemo, useState } from 'react';

import type { ClickSection } from '../logic/clickView.ts';

type PlayerSheet =
  'menu' | 'meter' | 'export' | 'upNext' | 'setlists' | 'speedKey';

interface ClickSheetOpen {
  readonly kind: 'click';
  readonly section: ClickSection;
}

export const TEMPO_SHEET = { kind: 'tempo' } as const;

export type OpenSheet = PlayerSheet | ClickSheetOpen | typeof TEMPO_SHEET;

export const clickSectionOf = (sheet: OpenSheet | null) =>
  typeof sheet === 'object' && sheet?.kind === 'click' ? sheet.section : null;

export function usePlayerSheet(retiming: boolean) {
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  if (sheet !== null && retiming) setSheet(null);
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
      openTempo: opener(TEMPO_SHEET),
      openClick: (section: ClickSection) => {
        setSheet({ kind: 'click', section });
      },
      closeSheet: opener(null),
    };
  }, []);
  return { sheet, ...handlers };
}
