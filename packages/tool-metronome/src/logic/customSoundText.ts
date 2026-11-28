import { countLabel, type FeedbackTone } from '@kitbag/core-design';
import {
  KB_CUSTOM_SOUND_SLOTS,
  KB_MAX_CUSTOM_SOUND_SECONDS,
} from '@kitbag/core-native';
import {
  DEFAULT_SOUND_NAME,
  joinedFormatNames,
  PICKER_FAILED_TEXT,
  unsupportedImportText,
  type ClickSoundNotice,
  type ClickSoundProblem,
} from '@kitbag/core-state';

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const countWord = (count: number) => COUNT_WORDS[count] ?? String(count);

const MAX_LENGTH = countLabel(KB_MAX_CUSTOM_SOUND_SECONDS, 'second', 'seconds');
function keepText(slots: number): string {
  return `You can keep ${countWord(slots)} ${slots === 1 ? 'sound' : 'sounds'}.`;
}
const KEEP = keepText(KB_CUSTOM_SOUND_SLOTS);

export const YOUR_SOUNDS = 'Your sounds';
export const IMPORT_LABEL = 'Import a sound';

export function importHint(formats: readonly string[], full: boolean): string {
  if (full) return `${KEEP} Replace or remove one to import another.`;
  const limit =
    formats.length === 0
      ? `Up to ${MAX_LENGTH}`
      : `${joinedFormatNames(formats)}, up to ${MAX_LENGTH}`;
  return `${limit}. ${KEEP}`;
}

export function preparingText(fileName: string): string {
  return `Preparing “${fileName}”…`;
}

function problemText(fileName: string, problem: ClickSoundProblem): string {
  const file = `“${fileName}”`;
  switch (problem.kind) {
    case 'format':
      return unsupportedImportText(fileName, problem.format, problem.supported);
    case 'tooLong':
      return `${file} is longer than ${MAX_LENGTH}, the most a click sound can be.`;
    case 'damaged':
      return `${file} could not be decoded and may be damaged, so it was not added.`;
    case 'silent':
      return `${file} is silent, so it was not added.`;
    case 'noSpace':
      return `There is not enough free space on this phone for ${file}, so it was not added. Free some space, then try again.`;
    case 'failed':
      return `${file} could not be added. Check the file opens in another app, then try again.`;
  }
}

const REFUSALS: ReadonlySet<ClickSoundProblem['kind']> = new Set([
  'format',
  'tooLong',
  'silent',
]);

export interface ClickSoundNoticeView {
  readonly text: string;
  readonly tone: FeedbackTone;
  readonly status: string;
}

export function clickSoundNoticeView(
  notice: ClickSoundNotice,
): ClickSoundNoticeView {
  if (notice.kind === 'picker')
    return {
      text: PICKER_FAILED_TEXT,
      tone: 'danger',
      status: 'Import failed',
    };
  const text = problemText(notice.fileName, notice.problem);
  const refused = REFUSALS.has(notice.problem.kind);
  return {
    text:
      notice.replacing === null
        ? text
        : `${text} ${notice.replacing} is unchanged.`,
    tone: refused ? 'warning' : 'danger',
    status: refused ? 'Sound refused' : 'Import failed',
  };
}

export function unavailableText(name: string): string {
  return `“${name}” could not be loaded, so it plays as ${DEFAULT_SOUND_NAME}. Replace it or remove it.`;
}

export function tileLabel(name: string, available: boolean): string {
  return available ? `${name}, your sound` : `${name}, your sound, unavailable`;
}

export function optionsLabel(name: string): string {
  return `Options for ${name}`;
}

export function optionsHint(name: string): string {
  return `Replace keeps the new sound on every beat and song that uses ${name}.`;
}
