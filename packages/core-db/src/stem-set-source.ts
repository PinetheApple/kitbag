export const STEM_SET_SOURCE = {
  folder: 'folder',
  stemdeck: 'stemdeck',
} as const;

export type StemSetSource =
  (typeof STEM_SET_SOURCE)[keyof typeof STEM_SET_SOURCE];

export const STEM_SET_SOURCES = Object.values(STEM_SET_SOURCE) as [
  StemSetSource,
  ...StemSetSource[],
];
