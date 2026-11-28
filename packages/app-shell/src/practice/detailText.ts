import type { SavedPracticeSession } from '@kitbag/core-db';
import { countLabel } from '@kitbag/core-design';
import {
  clockTime,
  REPEAT_PLAN,
  type RepeatPlan,
  type SessionLoad,
} from '@kitbag/core-state';

import { SEPARATOR } from '../settings/separator.ts';
import { daysAgoText, weekdayDate } from '../dates.ts';
import { bpmText, sessionName, type SessionNames } from './historyText.ts';

export const LOAD_HINT =
  'Songs load with their saved settings; how they were played was not recorded.';

export const OLD_SESSION_NOTE =
  'Saved before Kitbag kept each stretch. Its totals and songs are all it has.';

export interface DetailHeading {
  readonly title: string;
  readonly subtitle: string | undefined;
}

export function detailHeading(startedAt: Date, now: Date): DetailHeading {
  return {
    title: weekdayDate(startedAt),
    subtitle: daysAgoText(startedAt, now) ?? undefined,
  };
}

export function summaryHint(
  session: SavedPracticeSession,
  names: SessionNames,
): string {
  return [
    sessionName(session, names),
    `started ${clockTime(session.startedAt)}`,
    `avg ${bpmText(session.avgBpm)}`,
  ].join(` ${SEPARATOR} `);
}

export function repeatHint(plan: RepeatPlan): string {
  if (plan.kind === REPEAT_PLAN.setlist)
    return `Loads ${plan.load.name} at song 1 with each song as played. You press Play.`;
  return 'Loads the settings it started with, with no song. You press Play.';
}

export function loadLabel(load: SessionLoad): string {
  return `Load ${load.name}`;
}

export function missingSongsText(count: number): string {
  return `${countLabel(count, 'song', 'songs')} no longer in the library`;
}
