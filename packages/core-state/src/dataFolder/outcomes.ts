import type { MoveFinished, MoveOutcomes } from '@kitbag/core-native';

export function moveSettled(
  finished: MoveFinished,
  outcomes: MoveOutcomes,
): boolean {
  return (
    finished.outcome !== outcomes.failed &&
    finished.outcome !== outcomes.refused
  );
}
