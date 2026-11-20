import type { SongPreset } from '@kitbag/core-db';

import type { LibraryState } from './store.ts';

export type PresetOverlay = (
  preset: SongPreset,
  setlistId: number | null,
) => SongPreset;

export function loadedPresetOf(
  state: Pick<LibraryState, 'presets' | 'loaded'>,
): SongPreset | undefined {
  const { loaded } = state;
  if (loaded === null) return undefined;
  return state.presets.find((preset) => preset.id === loaded.presetId);
}

export function withoutPreset(
  overlay: PresetOverlay,
  presetId: number,
): PresetOverlay {
  return (preset, setlistId) =>
    preset.id === presetId ? preset : overlay(preset, setlistId);
}

export function overlaid(
  state: Pick<LibraryState, 'presetOverlay'>,
  preset: SongPreset,
  setlistId: number | null,
): SongPreset {
  return state.presetOverlay?.(preset, setlistId) ?? preset;
}

export function loadedBaselineOf(
  state: Pick<LibraryState, 'presets' | 'loaded' | 'presetOverlay'>,
): SongPreset | undefined {
  const preset = loadedPresetOf(state);
  if (preset === undefined || state.loaded === null) return preset;
  return overlaid(state, preset, state.loaded.setlistId);
}
