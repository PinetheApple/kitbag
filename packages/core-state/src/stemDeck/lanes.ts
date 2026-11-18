// StemDeck's own lane order and split names (app/core/config.py STEM_NAMES, EXTRA_STEM_NAMES).
const STEMDECK_BASE_STEMS = [
  'vocals',
  'drums',
  'bass',
  'guitar',
  'piano',
  'other',
] as const;
const [VOCALS] = STEMDECK_BASE_STEMS;
const VOCAL_SPLIT = ['lead_vocals', 'backing_vocals'] as const;
const SPLIT_CHOICE = 'split';

export interface JobVersion {
  readonly id: string;
  readonly stems: readonly string[];
}

export interface JobLanes {
  readonly present: readonly string[] | null;
  readonly versions: readonly JobVersion[];
  readonly openVersion: string | null;
  readonly vocalSplitChoice: string | null;
}

export function openingLanes(job: JobLanes): string[] {
  const version =
    job.versions.find((v) => v.id === job.openVersion) ?? job.versions[0];
  const chosen = new Set<string>(version?.stems ?? STEMDECK_BASE_STEMS);
  const present = job.present === null ? null : new Set(job.present);
  const has = (name: string) => present === null || present.has(name);
  const split = job.vocalSplitChoice === SPLIT_CHOICE && VOCAL_SPLIT.every(has);
  return STEMDECK_BASE_STEMS.filter((name) => chosen.has(name))
    .flatMap((name) => (name === VOCALS && split ? [...VOCAL_SPLIT] : [name]))
    .filter(has);
}
