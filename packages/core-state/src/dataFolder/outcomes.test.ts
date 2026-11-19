import { describe, expect, it } from 'vitest';

import { DATA_FOLDER_CODES as CODES } from './codes.test-helper.ts';
import { moveSettled } from './outcomes.ts';

const finished = (outcome: string) => ({ outcome, error: null, path: null });

describe('moveSettled', () => {
  it('settles every outcome but a failure or a refusal', () => {
    const { moveOutcomes: outcomes } = CODES;
    expect(moveSettled(finished(outcomes.done), outcomes)).toBe(true);
    expect(moveSettled(finished(outcomes.cancelled), outcomes)).toBe(true);
    expect(moveSettled(finished(outcomes.awaitingRelease), outcomes)).toBe(
      true,
    );
    expect(moveSettled(finished(outcomes.failed), outcomes)).toBe(false);
    expect(moveSettled(finished(outcomes.refused), outcomes)).toBe(false);
  });
});
