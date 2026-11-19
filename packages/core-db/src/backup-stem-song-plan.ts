import type {
  LocalStemSong,
  StemMixRecord,
  StemSongRecord,
} from './backup-format';
import { NO_CLICK } from './click-settings';
import { NO_METER_OVERRIDE } from './meter-override';
import { stems, stemSets } from './schema';
import { UNITY_GAIN } from './stem-bundle-repository';
import { retimeFits } from './stem-lyrics';

function settingsOf(song: StemSongRecord, roles: ReadonlySet<string>) {
  const mixes = song.stems
    .filter(({ role }) => roles.has(role))
    .sort((a, b) => a.role.localeCompare(b.role));
  return [
    song.title,
    song.meterBeatsPerBar,
    song.barOneSeconds,
    song.speed,
    song.lyricsRetimed,
    song.clickGrouping,
    song.clickRate,
    song.chosenTempoMode,
    mixes.map(({ role, name, gain, muted, soloed, pitch }) => [
      role,
      name,
      gain,
      muted,
      soloed,
      pitch,
    ]),
  ];
}

// Only roles on both sides are compared: a restore never adds or removes a stem.
export function sameStemSong(
  mine: StemSongRecord,
  theirs: StemSongRecord,
): boolean {
  const theirRoles = new Set(theirs.stems.map(({ role }) => role));
  const roles = new Set(
    mine.stems.map(({ role }) => role).filter((role) => theirRoles.has(role)),
  );
  return (
    JSON.stringify(settingsOf(mine, roles)) ===
    JSON.stringify(settingsOf(theirs, roles))
  );
}

const mixAtImport = (mix: StemMixRecord) =>
  mix.name === null &&
  mix.gain === UNITY_GAIN &&
  !mix.muted &&
  !mix.soloed &&
  mix.pitch === stems.pitch.default;

export function atImportDefaults(song: StemSongRecord): boolean {
  return (
    song.title === null &&
    song.meterBeatsPerBar === NO_METER_OVERRIDE.meterBeatsPerBar &&
    song.barOneSeconds === NO_METER_OVERRIDE.barOneSeconds &&
    song.speed === stemSets.speed.default &&
    song.lyricsRetimed === null &&
    song.clickGrouping.length === NO_CLICK.clickGrouping.length &&
    song.clickRate === NO_CLICK.clickRate &&
    song.chosenTempoMode === null &&
    song.stems.every(mixAtImport)
  );
}

// Line times index the lyrics they were tapped against; others keep the device's.
export function fittedToDevice(
  incoming: StemSongRecord,
  mine: LocalStemSong,
): StemSongRecord {
  const times = incoming.lyricsRetimed;
  if (times === null || retimeFits(mine.lyrics, times)) return incoming;
  return { ...incoming, lyricsRetimed: mine.lyricsRetimed };
}
