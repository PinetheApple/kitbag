import { ESLintUtils } from '@typescript-eslint/utils';

// One RuleCreator for the whole plugin. The docs URL points at the SPEC section
// each rule enforces — the rule name is appended so a reader lands near §13.6.
export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/PinetheApple/kitbag/blob/main/SPEC.md#136-eslint-plugin-kitbag-${name}`,
);
