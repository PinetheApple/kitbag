import type { StandaloneMetronomePersistence } from '@kitbag/core-state';

export const TEMPO_QUERY = 'bpm';

export function hasQueriedTempo(search: string): boolean {
  const raw = new URLSearchParams(search).get(TEMPO_QUERY);
  return raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw));
}

export function queriedTempoWins(
  persistence: StandaloneMetronomePersistence,
  search: string,
): StandaloneMetronomePersistence {
  if (!hasQueriedTempo(search)) return persistence;
  return {
    ...persistence,
    load: () => {
      const settings = { ...persistence.load() };
      delete settings.bpm;
      return settings;
    },
  };
}
