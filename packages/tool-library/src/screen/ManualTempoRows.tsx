import { MenuRow } from '@kitbag/core-design';
import {
  useSongPlayer,
  useSongViewing,
  viewOnlyReason,
  type SongPlayerStore,
} from '@kitbag/core-state';

import { isNoGridBadge, lockBadgeOf } from '../logic/lockText.ts';
import { bpmText, SET_TEMPO_TEXT } from '../logic/manualTempoText.ts';

type TempoFacts = Pick<
  SongPlayerStore,
  | 'status'
  | 'analysisStatus'
  | 'beats'
  | 'manualTempo'
  | 'analysedBpm'
  | 'tempoPreview'
>;

export const TEMPO_ROW = {
  set: 'set',
  fix: 'fix',
  manual: 'manual',
  none: 'none',
} as const;

export type TempoRow = (typeof TEMPO_ROW)[keyof typeof TEMPO_ROW];

export function tempoRowOf(state: TempoFacts): TempoRow {
  if (state.status !== 'ready') return TEMPO_ROW.none;
  if (state.manualTempo !== null) return TEMPO_ROW.manual;
  if (isNoGridBadge(lockBadgeOf(state))) return TEMPO_ROW.set;
  return state.analysedBpm === null ? TEMPO_ROW.none : TEMPO_ROW.fix;
}

interface RowProps {
  readonly onPress: () => void;
}

type RowFacts = Pick<TempoFacts, 'manualTempo' | 'analysedBpm'>;

function rowCopy(row: TempoRow, state: RowFacts) {
  switch (row) {
    case TEMPO_ROW.set:
      return { label: SET_TEMPO_TEXT.title, detail: SET_TEMPO_TEXT.menuDetail };
    case TEMPO_ROW.fix:
      return {
        label: SET_TEMPO_TEXT.fix,
        detail: SET_TEMPO_TEXT.fixDetail,
        value:
          state.analysedBpm === null ? undefined : bpmText(state.analysedBpm),
      };
    default:
      return {
        label: SET_TEMPO_TEXT.tempo,
        detail: SET_TEMPO_TEXT.tempoDetail,
        value:
          state.manualTempo === null
            ? undefined
            : bpmText(state.manualTempo.bpm),
      };
  }
}

export function SetTempoRow({ onPress }: RowProps) {
  const row = useSongPlayer(tempoRowOf);
  const manualTempo = useSongPlayer((s) => s.manualTempo);
  const analysedBpm = useSongPlayer((s) => s.analysedBpm);
  const viewOnly = viewOnlyReason(null, useSongViewing());
  if (row === TEMPO_ROW.none) return null;
  const copy = rowCopy(row, { manualTempo, analysedBpm });
  return (
    <MenuRow
      icon="tapAlong"
      label={copy.label}
      detail={viewOnly ?? copy.detail}
      value={viewOnly === null ? copy.value : undefined}
      valueTone={row === TEMPO_ROW.manual ? 'accent' : 'plain'}
      disabled={viewOnly !== null}
      onPress={onPress}
    />
  );
}

export function UseAnalysedRow({ onPress }: RowProps) {
  const manual = useSongPlayer((s) => s.manualTempo !== null);
  const analysedBpm = useSongPlayer((s) => s.analysedBpm);
  const viewing = useSongViewing();
  if (!manual || analysedBpm === null || viewing) return null;
  return (
    <MenuRow
      icon="reset"
      label={SET_TEMPO_TEXT.useAnalysed}
      detail={SET_TEMPO_TEXT.useAnalysedDetail}
      value={bpmText(analysedBpm)}
      onPress={onPress}
    />
  );
}
