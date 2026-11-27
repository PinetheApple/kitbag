import { setTempoKit } from '@kitbag/core-design';
import {
  MANUAL_TEMPO_RULES,
  type StemPlayerStore,
} from '@kitbag/core-state';

export const STEM_SET_TEMPO = setTempoKit(MANUAL_TEMPO_RULES);

export const SET_TEMPO_UNLOCKS = 'Turns on the click, meter and count-in';

export const STEM_TEMPO_ENTRY = {
  set: 'set',
  edit: 'edit',
  none: 'none',
} as const;

export type StemTempoEntry =
  (typeof STEM_TEMPO_ENTRY)[keyof typeof STEM_TEMPO_ENTRY];

type EntryFacts = Pick<
  StemPlayerStore,
  'status' | 'manualTempo' | 'beats' | 'tempoPreview'
>;

const hasSavedGrid = ({ beats, tempoPreview }: EntryFacts) =>
  tempoPreview === null ? beats.length > 0 : tempoPreview.savedGrid;

export function stemTempoEntry(state: EntryFacts): StemTempoEntry {
  if (state.status !== 'ready') return STEM_TEMPO_ENTRY.none;
  if (state.manualTempo !== null) return STEM_TEMPO_ENTRY.edit;
  return hasSavedGrid(state) ? STEM_TEMPO_ENTRY.none : STEM_TEMPO_ENTRY.set;
}
