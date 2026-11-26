import { getSongBpmSource } from './getSongBpm.ts';
import type { HttpGet } from './http.ts';
import type { TempoSource } from './tempoSource.ts';

export function defaultTempoSources(
  httpGet: HttpGet,
  getSongBpmKey: string | undefined,
): TempoSource[] {
  const key = getSongBpmKey?.trim() ?? '';
  return key === '' ? [] : [getSongBpmSource(key, httpGet)];
}
