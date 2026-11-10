import type { StandaloneMetronomePersistence } from '@kitbag/core-state';

export const TEMPO_QUERY = 'bpm';

export function queriedNumber(
  search: string,
  name: string,
): number | undefined {
  const raw = new URLSearchParams(search).get(name);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function hasQueriedTempo(search: string): boolean {
  return queriedNumber(search, TEMPO_QUERY) !== undefined;
}

export function queriedTempoWins(
  persistence: StandaloneMetronomePersistence,
  search: string,
): StandaloneMetronomePersistence {
  if (!hasQueriedTempo(search)) return persistence;
  return {
    ...persistence,
    load: () => {
      const { ramp, ...settings } = persistence.load();
      delete settings.bpm;
      return ramp === undefined
        ? settings
        : { ...settings, ramp: { ...ramp, enabled: false } };
    },
  };
}
