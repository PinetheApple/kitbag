import { isTextScaled } from '@kitbag/core-design';

const DESIGN_LINES = 1;
const SCALED_TITLE_LINES = 3;
const SCALED_FACTS_LINES = 2;

export interface RowLayout {
  readonly titleLines: number;
  readonly factsLines: number;
  readonly badgesUnderText: boolean;
}

export function rowLayout(fontScale: number): RowLayout {
  return isTextScaled(fontScale)
    ? {
        titleLines: SCALED_TITLE_LINES,
        factsLines: SCALED_FACTS_LINES,
        badgesUnderText: true,
      }
    : {
        titleLines: DESIGN_LINES,
        factsLines: DESIGN_LINES,
        badgesUnderText: false,
      };
}
