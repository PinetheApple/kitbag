import type { SongPreset } from '@kitbag/core-db';

export function metronomeSongsOf(
  presets: readonly SongPreset[],
): readonly SongPreset[] {
  return presets.filter((preset) => preset.librarySongId === null);
}
