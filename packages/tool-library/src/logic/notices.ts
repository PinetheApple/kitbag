import { countLabel } from '@kitbag/core-design';
import type {
  AnalysisFailure,
  FailureKind,
  LibraryNotice,
} from '@kitbag/core-state';

export interface NoticeText {
  readonly status: string;
  readonly text: string;
}

export function noticeText(notice: LibraryNotice): NoticeText {
  switch (notice.kind) {
    case 'stemImport':
      return {
        status: 'Stem songs not yet supported',
        text: `“${notice.name}” looks like a stem song: a folder or a .zip is read as one. Stem song import arrives with the stem player; nothing was added.`,
      };
    case 'copyFailed':
      return {
        status: 'Import failed',
        text: `“${notice.name}” could not be copied into your library. Check the file opens in another app, then try again.`,
      };
    case 'addFailed':
      return {
        status: 'Import failed',
        text: `“${notice.name}” was copied but could not be added to your library. Try again.`,
      };
    case 'pickerFailed':
      return {
        status: 'Picker unavailable',
        text: 'The file picker could not open. Try again in a moment.',
      };
    case 'deleteFailed':
      return {
        status: 'Delete failed',
        text: `“${notice.name}” could not be deleted. Try again.`,
      };
  }
}

export interface FailureText {
  readonly status: string;
  readonly text: string;
  readonly canRetry: boolean;
}

const FAILURES: Readonly<Record<FailureKind, FailureText>> = {
  missingFile: {
    status: 'Missing file',
    text: 'The audio file is no longer on this phone, so it cannot be analyzed. Delete the song from its menu, or import the file again.',
    canRetry: false,
  },
  unsupported: {
    status: 'Unsupported format',
    text: 'This file’s format cannot be analyzed, so there is no beat grid to lock to.',
    canRetry: false,
  },
  interrupted: {
    status: 'Analysis interrupted',
    text: 'Analysis stopped before it finished, so there is no beat grid to lock to.',
    canRetry: true,
  },
  other: {
    status: 'Analysis failed',
    text: 'This file could not be analyzed, so there is no beat grid to lock to.',
    canRetry: true,
  },
};

const KEPT_GRID = 'Re-analysis failed; the previous beat grid is kept.';

export function failureText(failure: AnalysisFailure): FailureText {
  const base = FAILURES[failure.kind];
  if (!failure.keptGrid) return base;
  return { status: base.status, text: KEPT_GRID, canRetry: true };
}

export function copyingText(names: readonly string[]): string {
  const [only] = names;
  if (names.length === 1 && only !== undefined)
    return `Copying “${only}” into your library…`;
  return `Copying ${countLabel(names.length, 'file', 'files')} into your library…`;
}
