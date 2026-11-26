import {
  BPM_LOOKUP_SOURCE,
  songMatchText,
  type SongIdentity,
} from '@kitbag/core-db';
import { isNumber, isRecord, isString } from '@kitbag/core-db/src/guards';

import { getJson, type HttpGet } from './http.ts';
import { rankMatches } from './matchScore.ts';
import type { OnlineBpmLookup } from './onlineBpmLookup.ts';

const GETSONGBPM_API = 'https://api.getsong.co/search/';

interface GetSongBpmCandidate extends SongIdentity {
  readonly bpm: number;
}

export function getSongBpmUrl(song: SongIdentity, apiKey: string): string {
  const lookup = `song:${songMatchText(song.title)} artist:${songMatchText(song.artist)}`;
  return `${GETSONGBPM_API}?api_key=${encodeURIComponent(apiKey)}&type=both&lookup=${encodeURIComponent(lookup)}`;
}

function tempoOf(value: unknown): number | null {
  const tempo = isString(value) ? Number(value) : value;
  return isNumber(tempo) && tempo > 0 ? tempo : null;
}

function candidateOf(item: unknown): GetSongBpmCandidate[] {
  if (!isRecord(item) || !isString(item.title)) return [];
  const { artist } = item;
  const bpm = tempoOf(item.tempo);
  if (!isRecord(artist) || !isString(artist.name) || bpm === null) return [];
  return [{ title: item.title, artist: artist.name, bpm }];
}

export function getSongBpmLookup(
  apiKey: string,
  httpGet: HttpGet,
): OnlineBpmLookup {
  return {
    id: BPM_LOOKUP_SOURCE.getSongBpm,
    lookUp: async (song, signal) => {
      const url = getSongBpmUrl(song, apiKey);
      const body = await getJson(httpGet, url, signal);
      if (!isRecord(body) || !Array.isArray(body.search)) return null;
      const [best] = rankMatches(song, body.search.flatMap(candidateOf));
      return best?.bpm ?? null;
    },
  };
}
