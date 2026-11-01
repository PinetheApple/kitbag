import type {
  Category,
  CategoryPlan,
  Conflict,
  ImportMode,
  ImportPlan,
} from '@kitbag/core-db';
import { countLabel } from '@kitbag/core-design';
import { REPLACE_CONFIRMATION, type RestoreFailure } from '@kitbag/core-state';

import { formatBytes } from './bytes.ts';
import { SEPARATOR } from './separator.ts';

export const BACK_UP_LABEL = 'Back up everything';
export const RESTORE_LABEL = 'Restore from backup';
export const RESTORE_TITLE = 'Restore';
export const REVIEW_LABEL = 'Review';
export const REVIEW_TITLE = 'Review differences';
export const KEEP_MINE = 'Keep mine';
export const TAKE_THEIRS = 'Take theirs';
export const REPLACE_TITLE = 'Replace everything?';
export const PICK_AGAIN = 'Choose another file';
export const DONE_LABEL = 'Done';
export const STALE_NOTICE =
  'Your library changed while this was open. Check the new counts and restore again.';
export const SHARE_FAILED = 'Could not share the backup. Try again.';

export const RESTORE_ORDER: readonly Category[] = [
  'setlists',
  'songPresets',
  'tunings',
  'practiceSessions',
  'librarySongs',
  'countInSettings',
];

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  setlists: 'Setlists',
  songPresets: 'Song presets',
  tunings: 'Tunings',
  practiceSessions: 'Practice history',
  librarySongs: 'Library songs',
  countInSettings: 'Count-in',
};

const NOUNS: Readonly<Record<Category, readonly [string, string]>> = {
  setlists: ['setlist', 'setlists'],
  songPresets: ['song', 'songs'],
  tunings: ['tuning', 'tunings'],
  practiceSessions: ['session', 'sessions'],
  librarySongs: ['library song', 'library songs'],
  countInSettings: ['count-in setting', 'count-in settings'],
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MERGE_HINT =
  'Keeps what you have. Items already here are updated, not duplicated.';
const NOTHING_DELETED = 'Deletes nothing you have';
const FILES_NOT_INCLUDED = 'files not included';
const REPLACE_EVERYTHING = 'Replace everything';
const MERGE_LABEL_CATEGORIES = 2;
const NOTHING_CHANGED = 'Nothing was changed.';

const counted = (category: Category, count: number) => {
  const [one, many] = NOUNS[category];
  return countLabel(count, one, many);
};

function joined(parts: readonly string[], last: string): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} ${last} ${parts.at(-1) ?? ''}`;
}

function ordered(plan: Pick<ImportPlan, 'categories'>): Category[] {
  return RESTORE_ORDER.filter((category) => plan.categories.includes(category));
}

export function backupSummary(
  counts: Pick<Record<Category, number>, 'setlists' | 'songPresets'>,
): string {
  return `${counted('setlists', counts.setlists)} ${SEPARATOR} ${counted('songPresets', counts.songPresets)}`;
}

export function sourceDetail(
  version: number,
  exportedAt: string,
  bytes: number,
): string {
  const date = new Date(exportedAt);
  const day = `${String(date.getDate())} ${MONTHS[date.getMonth()] ?? ''} ${String(date.getFullYear())}`;
  return [`v${String(version)}`, day, formatBytes(bytes)].join(
    ` ${SEPARATOR} `,
  );
}

export function categoryValue(
  category: Category,
  incoming: number,
  plan: CategoryPlan | undefined,
): string {
  if (category === 'librarySongs')
    return `${String(incoming)} ${SEPARATOR} ${FILES_NOT_INCLUDED}`;
  const total =
    category === 'practiceSessions'
      ? counted(category, incoming)
      : String(incoming);
  if (plan === undefined || incoming === 0) return total;
  const fresh = plan.new === incoming ? 'all new' : `${String(plan.new)} new`;
  return `${total} ${SEPARATOR} ${fresh}`;
}

export function modeHint(plan: ImportPlan): string {
  if (plan.mode === 'merge') return MERGE_HINT;
  const deleted = ordered(plan)
    .map((category) => [category, plan.counts[category]?.deletes ?? 0] as const)
    .filter(([, deletes]) => deletes > 0)
    .map(([category, deletes]) => counted(category, deletes));
  return deleted.length === 0
    ? NOTHING_DELETED
    : `Deletes your ${joined(deleted, 'and')}`;
}

function incomingList(
  categories: readonly Category[],
  counts: ImportPlan['counts'],
): string {
  return joined(
    categories.map((category) =>
      counted(category, counts[category]?.incoming ?? 0),
    ),
    '&',
  );
}

export function applyLabel(plan: ImportPlan): string {
  if (plan.mode === 'replace') return REPLACE_EVERYTHING;
  const named = ordered(plan).slice(0, MERGE_LABEL_CATEGORIES);
  return `Merge ${incomingList(named, plan.counts)}`;
}

export function replaceConfirmBody(plan: ImportPlan): string {
  return `${modeHint(plan)} and puts the backup's in their place. Type “${REPLACE_CONFIRMATION}” to confirm.`;
}

export function conflictBanner(conflicts: readonly Conflict[]): string {
  const [first] = conflicts;
  const shared =
    first !== undefined &&
    conflicts.every(({ category }) => category === first.category);
  const subject = shared
    ? counted(first.category, conflicts.length)
    : countLabel(conflicts.length, 'item', 'items');
  return `${subject} ${conflicts.length === 1 ? 'differs' : 'differ'} from yours.`;
}

export function conflictDetail(conflict: Conflict): string {
  return CATEGORY_LABELS[conflict.category];
}

export function failureText(failure: RestoreFailure): string {
  switch (failure.kind) {
    case 'unsupportedVersion':
      return `Made with a newer Kitbag (v${String(failure.version)}). Update to restore this.`;
    case 'malformedFile':
      return `This file is not a Kitbag backup. ${NOTHING_CHANGED}`;
    case 'invalidField':
    case 'invalidRelationship':
    case 'duplicateIdentity':
      return `This backup is damaged. ${NOTHING_CHANGED}`;
    case 'unreadable':
      return `Could not read that file. ${NOTHING_CHANGED}`;
    default:
      return `Restoring failed. ${NOTHING_CHANGED}`;
  }
}

export function restoredText(
  mode: ImportMode,
  counts: ImportPlan['counts'],
): string {
  const categories = RESTORE_ORDER.filter(
    (category) => counts[category] !== undefined,
  );
  const verb = mode === 'merge' ? 'Merged' : 'Replaced with';
  return `${verb} ${incomingList(categories, counts)}.`;
}
