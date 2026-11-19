import type { ClickBeatLevel } from '@kitbag/core-design';
import {
  CLICK_RATE,
  groupBeats,
  stemSetClickViolation,
  type ClickRate,
} from '@kitbag/core-state';

export const clickCopy = {
  title: 'Click for this song',
  close: 'Close the click sheet',
  groupingRow: 'Click grouping',
  rateRow: 'Click rate',
  noGrid: 'Needs a beat grid.',
  noBars: "Needs bar marks. This song's grid has none.",
  grouping: 'Grouping',
  rate: 'Rate',
  off: 'Off',
  custom: 'Custom',
  offHint: "Only each bar's first beat is accented.",
  done: 'Done',
} as const;

export function clickUnavailable(song: {
  readonly beats: readonly number[];
  readonly downbeatIndices: readonly number[];
}): string | null {
  if (song.beats.length === 0) return clickCopy.noGrid;
  return song.downbeatIndices.length === 0 ? clickCopy.noBars : null;
}

export const CLICK_SECTION = { grouping: 'grouping', rate: 'rate' } as const;
export type ClickSection = (typeof CLICK_SECTION)[keyof typeof CLICK_SECTION];

export const OFF_PICK = 'off';
export const CUSTOM_PICK = 'custom';
const LARGEST_CUSTOM_GROUP = 4;
export const CUSTOM_GROUP_SIZES: readonly number[] = Array.from(
  { length: LARGEST_CUSTOM_GROUP },
  (_, i) => i + 1,
);

const SHORT = 2;
const LONG = 3;

// Keyed by their own sums, so a row cannot land under the wrong bar length.
const PRESET_ROWS: readonly (readonly number[])[] = [
  [SHORT, SHORT],
  [LONG, SHORT],
  [SHORT, LONG],
  [LONG, LONG],
  [SHORT, SHORT, SHORT],
  [LONG, SHORT, SHORT],
  [SHORT, SHORT, LONG],
  [SHORT, LONG, SHORT],
  [LONG, LONG, SHORT],
  [LONG, SHORT, LONG],
  [SHORT, LONG, LONG],
  [LONG, LONG, LONG],
  [SHORT, SHORT, SHORT, LONG],
];

const GROUPING_PRESETS = PRESET_ROWS.reduce((byBar, row) => {
  byBar.set(groupBeats(row), [...(byBar.get(groupBeats(row)) ?? []), row]);
  return byBar;
}, new Map<number, readonly (readonly number[])[]>());

const RATE_LABEL: Readonly<Record<ClickRate, string>> = {
  [CLICK_RATE.half]: '×1/2',
  [CLICK_RATE.single]: '×1',
  [CLICK_RATE.double]: '×2',
};

export const RATE_HINT: Readonly<Record<ClickRate, string>> = {
  [CLICK_RATE.half]:
    'Every other beat, counted again from the first beat of each group.',
  [CLICK_RATE.single]: 'One click on every beat of the grid.',
  [CLICK_RATE.double]: 'A click on every beat and one halfway between.',
};

export const RATE_ORDER: readonly ClickRate[] = [
  CLICK_RATE.half,
  CLICK_RATE.single,
  CLICK_RATE.double,
];

export const rateLabel = (rate: ClickRate) => RATE_LABEL[rate];

export function groupingLabel(groups: readonly number[]): string {
  return groups.length === 0 ? clickCopy.off : groups.join('+');
}

export function groupingPresets(
  barBeats: number,
): readonly (readonly number[])[] {
  return GROUPING_PRESETS.get(barBeats) ?? [];
}

export function groupingPick(
  groups: readonly number[],
  presets: readonly (readonly number[])[],
  customOpen: boolean,
): string {
  if (customOpen) return CUSTOM_PICK;
  if (groups.length === 0) return OFF_PICK;
  const label = groupingLabel(groups);
  const preset = presets.some((p) => groupingLabel(p) === label);
  return preset ? label : CUSTOM_PICK;
}

function levelAt(position: number, inGroup: number, fits: boolean) {
  if (position === 0) return 'bar';
  return fits && inGroup === 0 ? 'group' : 'click';
}

export function clickBeats(
  groups: readonly number[],
  barBeats: number,
  rate: ClickRate,
): ClickBeatLevel[][] {
  const fits = groups.length > 0 && groupBeats(groups) === barBeats;
  const spans = fits ? groups : [barBeats];
  let start = 0;
  return spans.map((span) => {
    const levels = Array.from({ length: span }, (_, inGroup) => {
      const silent = rate === CLICK_RATE.half && inGroup % 2 === 1;
      return silent ? 'silent' : levelAt(start + inGroup, inGroup, fits);
    });
    start += span;
    return levels;
  });
}

export function barCounts(downbeats: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  downbeats.slice(1).forEach((beat, i) => {
    const length = beat - (downbeats[i] ?? beat);
    if (length > 0) counts.set(length, (counts.get(length) ?? 0) + 1);
  });
  return counts;
}

const barsIn = (lengths: Iterable<readonly [number, number]>) =>
  [...lengths].reduce((bars, [, count]) => bars + count, 0);

const firstBeatOnly = 'keeps only its first-beat accent';

const noBarFits = (beats: number) =>
  `No bar in this song is ${String(beats)} beats long, so every bar ${firstBeatOnly}.`;

export function stripBarBeats(
  groups: readonly number[],
  counts: ReadonlyMap<number, number>,
  commonBar: number,
): number {
  const sum = groupBeats(groups);
  return counts.has(sum) ? sum : commonBar;
}

export function canAddGroup(groups: readonly number[], beats: number) {
  return stemSetClickViolation({ clickGrouping: [...groups, beats] }) === null;
}

export const canGrowGroups = (groups: readonly number[]) =>
  canAddGroup(groups, 1);

function otherBarLengths(counts: ReadonlyMap<number, number>, sum: number) {
  const others = [...counts].filter(([length]) => length !== sum);
  others.sort((a, b) => b[1] - a[1]);
  return others;
}

export interface MismatchNote {
  readonly text: string;
  readonly barBeats: number;
}

export function mismatchNote(
  groups: readonly number[],
  counts: ReadonlyMap<number, number>,
): MismatchNote | null {
  const sum = groupBeats(groups);
  const others = otherBarLengths(counts, sum);
  const [first] = others;
  if (groups.length === 0 || first === undefined) return null;
  const [length] = first;
  if (!counts.has(sum))
    return {
      text: noBarFits(sum),
      barBeats: length,
    };
  const missed = barsIn(others);
  const what =
    others.length === 1
      ? `are ${String(length)} beats long`
      : 'have another length';
  return {
    text: `${String(missed)} of ${String(barsIn(counts))} bars in this song ${what}. They don't match ${groupingLabel(groups)}, so they accent only their first beat:`,
    barBeats: length,
  };
}

export function builderHint(
  groups: readonly number[],
  counts: ReadonlyMap<number, number>,
  commonBar: number,
): string {
  const sum = groupBeats(groups);
  const matched = counts.get(sum) ?? 0;
  if (groups.length === 0) return clickCopy.offHint;
  if (matched > 0 && matched === barsIn(counts))
    return 'Fits every bar in this song.';
  if (matched > 0) {
    const others = otherBarLengths(counts, sum);
    const rest =
      others.length === 1 ? `${String(others[0]?.[0])}-beat` : 'other';
    return `Fits the song's ${String(sum)}-beat bars (${String(matched)} of ${String(barsIn(counts))}). Its ${rest} bars keep only their first-beat accent.`;
  }
  if (sum < commonBar) {
    const left = commonBar - sum;
    return `Add ${String(left)} more ${left === 1 ? 'beat' : 'beats'} to fill a ${String(commonBar)}-beat bar. Until then every bar ${firstBeatOnly}.`;
  }
  return noBarFits(sum);
}
