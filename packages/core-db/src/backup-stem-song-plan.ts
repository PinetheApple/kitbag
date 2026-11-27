import type {
  LocalStemSong,
  StemMixRecord,
  StemSongRecord,
} from './backup-format';
import { storedManualTempoColumns } from './backup-manual-tempo';
import { NO_CLICK } from './click-settings';
import { NO_METER_OVERRIDE } from './meter-override';
import { stems, stemSets } from './schema';
import { retimeFits } from './stem-lyrics';
import { STEM_SET_SOURCE } from './stem-set-source';
import { carriedTempoMode } from './stem-tempo';
import { UNITY_GAIN } from './units';

interface Field {
  readonly mine: unknown;
  readonly theirs: unknown;
  readonly atDefault: boolean;
}

export type StemSongChange = 'same' | 'update' | 'conflict';

const field = (mine: unknown, theirs: unknown, atDefault: boolean): Field => ({
  mine,
  theirs,
  atDefault,
});

const named = (mine: string | null, theirs: string | null): Field[] =>
  theirs === null ? [] : [field(mine, theirs, mine === null)];

function manualTempoFields(
  mine: LocalStemSong,
  theirs: StemSongRecord,
): Field[] {
  if (theirs.manualTempoBpm === undefined) return [];
  const local = storedManualTempoColumns(mine);
  return [
    field(
      local,
      storedManualTempoColumns(theirs),
      local.manualTempoBpm === null,
    ),
  ];
}

function songFields(mine: LocalStemSong, theirs: StemSongRecord): Field[] {
  return [
    ...named(mine.title, theirs.title),
    field(
      mine.meterBeatsPerBar,
      theirs.meterBeatsPerBar,
      mine.meterBeatsPerBar === NO_METER_OVERRIDE.meterBeatsPerBar,
    ),
    field(
      mine.barOneSeconds,
      theirs.barOneSeconds,
      mine.barOneSeconds === NO_METER_OVERRIDE.barOneSeconds,
    ),
    field(mine.speed, theirs.speed, mine.speed === stemSets.speed.default),
    field(mine.pitch, theirs.pitch, mine.pitch === stemSets.pitch.default),
    field(
      mine.lyricsRetimed,
      theirs.lyricsRetimed,
      mine.lyricsRetimed === null,
    ),
    field(
      mine.clickGrouping,
      theirs.clickGrouping,
      mine.clickGrouping.length === NO_CLICK.clickGrouping.length,
    ),
    field(
      mine.clickRate,
      theirs.clickRate,
      mine.clickRate === NO_CLICK.clickRate,
    ),
    field(
      mine.chosenTempoMode,
      theirs.chosenTempoMode,
      mine.chosenTempoMode === null,
    ),
    ...manualTempoFields(mine, theirs),
  ];
}

// A StemDeck bundle may ship its own mix and the phone keeps no record of it,
// so a StemDeck song's mix always counts as chosen.
function stemFields(
  local: StemMixRecord,
  backup: StemMixRecord,
  shipped: boolean,
): Field[] {
  const fresh = (atImport: boolean) => !shipped && atImport;
  return [
    ...named(local.name, backup.name),
    field(local.gain, backup.gain, fresh(local.gain === UNITY_GAIN)),
    field(local.muted, backup.muted, fresh(!local.muted)),
    field(local.soloed, backup.soloed, fresh(!local.soloed)),
    field(
      local.pitch,
      backup.pitch,
      fresh(local.pitch === stems.pitch.default),
    ),
  ];
}

function mixFields(mine: LocalStemSong, theirs: StemSongRecord): Field[] {
  const shipped = mine.source === STEM_SET_SOURCE.stemdeck;
  return theirs.stems.flatMap((backup) =>
    mine.stems
      .filter(({ role }) => role === backup.role)
      .flatMap((local) => stemFields(local, backup, shipped)),
  );
}

const differs = ({ mine, theirs }: Field) =>
  JSON.stringify(mine) !== JSON.stringify(theirs);

export function stemSongChange(
  mine: LocalStemSong,
  theirs: StemSongRecord,
): StemSongChange {
  const changed = [
    ...songFields(mine, theirs),
    ...mixFields(mine, theirs),
  ].filter(differs);
  if (changed.length === 0) return 'same';
  return changed.every(({ atDefault }) => atDefault) ? 'update' : 'conflict';
}

// Line times index the lyrics they were tapped against; a backup value the
// phone cannot use keeps the phone's own.
export function fittedToDevice(
  incoming: StemSongRecord,
  mine: LocalStemSong,
): StemSongRecord {
  const times = incoming.lyricsRetimed;
  const timesFit = times === null || retimeFits(mine.lyrics, times);
  const mode = incoming.chosenTempoMode;
  const modeFits = mode === null || carriedTempoMode(mode, mine.tempo) === mode;
  return {
    ...incoming,
    lyricsRetimed: timesFit ? times : mine.lyricsRetimed,
    chosenTempoMode: modeFits ? mode : mine.chosenTempoMode,
  };
}
