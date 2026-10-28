import { countLabel } from '@kitbag/core-design';
import type {
  AnalysisFailure,
  BundleRefusal,
  FailureKind,
  LibraryNotice,
} from '@kitbag/core-state';

export interface NoticeText {
  readonly status: string;
  readonly text: string;
}

function refusalText(name: string, refusal: BundleRefusal): NoticeText {
  const song = `“${name}”`;
  switch (refusal.reason) {
    case 'notABundle':
      return {
        status: 'Not a StemDeck song',
        text: `${song} is not a StemDeck song bundle, so nothing was added. Export the song from StemDeck and import that .zip or its folder.`,
      };
    case 'version':
      return {
        status: 'Newer StemDeck song',
        text: `${song} was made by a newer StemDeck (bundle version ${String(refusal.version)}) than this Kitbag can read, so nothing was added.`,
      };
    case 'tooManyStems':
      return {
        status: 'Too many stems',
        text: `${song} has ${String(refusal.stemCount)} stems; Kitbag plays up to ${String(refusal.maxStems)}. Nothing was added. Export it from StemDeck with fewer stems.`,
      };
    case 'noSpace':
      return {
        status: 'Not enough space',
        text: `There is not enough free space on this phone for ${song}, so nothing was added. Free some space, then try again.`,
      };
    case 'unreadable':
      return {
        status: 'Song bundle unreadable',
        text: `${song} could not be read; it may be damaged or incomplete. Nothing was added. Export it from StemDeck again.`,
      };
  }
}

export function noticeText(notice: LibraryNotice): NoticeText {
  switch (notice.kind) {
    case 'bundleRefused':
      return refusalText(notice.name, notice.refusal);
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

export function replaceText(name: string, title: string): string {
  return `“${name}” is the same StemDeck song as “${title}” in your library. Replacing it removes that song’s stems, analysis and mix, and adds this copy. This cannot be undone.`;
}
