import { getSongBpmLookup } from './getSongBpm.ts';
import type { HttpGet } from './http.ts';
import type { OnlineBpmLookup } from './onlineBpmLookup.ts';

export function defaultOnlineLookups(
  httpGet: HttpGet,
  getSongBpmKey: string | undefined,
): OnlineBpmLookup[] {
  const key = getSongBpmKey?.trim() ?? '';
  return key === '' ? [] : [getSongBpmLookup(key, httpGet)];
}
