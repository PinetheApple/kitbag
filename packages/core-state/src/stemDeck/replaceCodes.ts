import type {
  StemDeckConstants,
  StemDeckImportItem,
  StemDeckImportRequest,
} from '@kitbag/core-native';

import type { ReplaceChoice } from '../songLibrary/stemBundleLogic.ts';

type ReplaceRequest = Pick<StemDeckImportRequest, 'replace' | 'replaceTarget'>;

export const ADD: ReplaceChoice = { kind: 'add' };

export function replaceRequest(
  choice: ReplaceChoice,
  codes: StemDeckConstants,
): ReplaceRequest {
  switch (choice.kind) {
    case 'add':
      return { replace: codes.replaceAdd, replaceTarget: null };
    case 'replaceJob':
      return { replace: codes.replaceJob, replaceTarget: null };
    case 'replaceSet':
      return { replace: codes.replaceSet, replaceTarget: choice.targetId };
  }
}

export function replaceChoiceOf(
  item: StemDeckImportItem,
  codes: StemDeckConstants,
): ReplaceChoice {
  if (item.replace === codes.replaceAdd) return ADD;
  if (item.replace === codes.replaceJob) return { kind: 'replaceJob' };
  if (item.replace === codes.replaceSet && item.replaceTarget !== null)
    return { kind: 'replaceSet', targetId: item.replaceTarget };
  throw new Error(`StemDeck replace ${item.replace} has no choice`);
}
