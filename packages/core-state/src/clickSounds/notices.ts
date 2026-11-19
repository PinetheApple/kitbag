import { KB_RESULT } from '@kitbag/core-native';

export type ClickSoundProblem =
  | { readonly kind: 'tooLong' | 'silent' | 'damaged' | 'noSpace' | 'failed' }
  | {
      readonly kind: 'format';
      readonly format: string;
      readonly supported: readonly string[];
    };

export type ClickSoundNotice =
  | { readonly kind: 'picker' }
  | {
      readonly kind: 'refused';
      readonly fileName: string;
      readonly replacing: string | null;
      readonly problem: ClickSoundProblem;
    };

const PROBLEMS: ReadonlyMap<number, ClickSoundProblem> = new Map([
  [KB_RESULT.KB_ERROR_TOO_LONG, { kind: 'tooLong' }],
  [KB_RESULT.KB_ERROR_SILENT, { kind: 'silent' }],
  [KB_RESULT.KB_ERROR_INVALID_ARGUMENT, { kind: 'damaged' }],
  [KB_RESULT.KB_ERROR_NO_SPACE, { kind: 'noSpace' }],
]);

export function problemOf(result: number): ClickSoundProblem {
  return PROBLEMS.get(result) ?? { kind: 'failed' };
}

export function soundNameFromFile(fileName: string): string {
  const name = fileName.trim();
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
}
