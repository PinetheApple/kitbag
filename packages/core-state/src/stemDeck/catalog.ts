import { openingLanes, type JobVersion } from './lanes.ts';

export interface ServerHealth {
  readonly isStemDeck: boolean;
  readonly version: string | null;
}

export interface CatalogSong {
  readonly jobId: string;
  readonly title: string;
  readonly artist: string | null;
  readonly durationSec: number | null;
  readonly lanes: readonly string[];
  readonly inLibrary: boolean;
}

export interface CatalogSetlist {
  readonly id: string;
  readonly name: string;
  readonly songIds: readonly string[];
}

export interface Catalog {
  readonly songs: readonly CatalogSong[];
  readonly setlists: readonly CatalogSetlist[];
  readonly unavailable: number;
}

type Json = Readonly<Record<string, unknown>>;

const STEMDECK_NAME = 'StemDeck';
const DONE = 'done';
const UNAVAILABLE = 'unavailable';

function parse(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function parseHealth(body: string): ServerHealth {
  const json = parse(body);
  if (!isObject(json)) return { isStemDeck: false, version: null };
  return {
    isStemDeck: json.name === STEMDECK_NAME,
    version: text(json.version),
  };
}

function versions(value: unknown): JobVersion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).flatMap((version) => {
    const id = text(version.id);
    return id === null ? [] : [{ id, stems: strings(version.stems) }];
  });
}

function presentStems(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter(isObject).flatMap((stem) => {
    const name = text(stem.name);
    return name === null ? [] : [name];
  });
}

function song(job: Json, jobId: string): CatalogSong {
  const duration = job.duration;
  return {
    jobId,
    title: text(job.title) ?? jobId,
    artist: text(job.display_artist),
    durationSec:
      typeof duration === 'number' && Number.isFinite(duration)
        ? duration
        : null,
    lanes: openingLanes({
      present: presentStems(job.stems),
      versions: versions(job.versions),
      openVersion: text(job.open_version),
      vocalSplitChoice: text(job.vocal_split_choice),
    }),
    inLibrary: false,
  };
}

// A song StemDeck reports without its stem files, or with no lane to send, is
// counted, not listed: it cannot be fetched.
export function parseJobs(
  body: string,
): { songs: CatalogSong[]; unavailable: number } | null {
  const json = parse(body);
  if (!Array.isArray(json)) return null;
  const songs: CatalogSong[] = [];
  let unavailable = 0;
  for (const job of json.filter(isObject)) {
    const jobId = text(job.job_id);
    if (jobId === null) continue;
    if (job.status === UNAVAILABLE) unavailable += 1;
    if (job.status !== DONE) continue;
    const listed = song(job, jobId);
    if (listed.lanes.length === 0) unavailable += 1;
    else songs.push(listed);
  }
  return { songs, unavailable };
}

export function parseSetlists(body: string): CatalogSetlist[] {
  const json = parse(body);
  if (!Array.isArray(json)) return [];
  return json.filter(isObject).flatMap((setlist) => {
    const id = text(setlist.id);
    const name = text(setlist.name);
    return id === null || name === null
      ? []
      : [{ id, name, songIds: strings(setlist.song_ids) }];
  });
}

export function markInLibrary(
  songs: readonly CatalogSong[],
  inLibrary: ReadonlySet<string>,
): CatalogSong[] {
  return songs.map((s) => ({ ...s, inLibrary: inLibrary.has(s.jobId) }));
}

export function setlistSongs(
  catalog: Catalog,
  setlistId: string | null,
): readonly CatalogSong[] {
  const setlist = catalog.setlists.find((s) => s.id === setlistId);
  if (setlist === undefined) return catalog.songs;
  const ids = new Set(setlist.songIds);
  return catalog.songs.filter((s) => ids.has(s.jobId));
}

export function visibleSongs(
  catalog: Catalog,
  setlistId: string | null,
  query: string,
): readonly CatalogSong[] {
  const songs = setlistSongs(catalog, setlistId);
  const needle = query.trim().toLowerCase();
  if (needle === '') return songs;
  return songs.filter((s) =>
    [s.title, s.artist ?? ''].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}

export function selectableIds(songs: readonly CatalogSong[]): string[] {
  return songs.filter((s) => !s.inLibrary).map((s) => s.jobId);
}
