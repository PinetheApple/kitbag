// Drives the eval harness under the repo's vitest toolchain (SPEC §14, "Lint
// rules" row). Scenarios are discovered synchronously so there is one named
// test per scenario; the actual linting is a single shared ESLint pass in
// beforeAll (see harness.ts), keyed back to each scenario.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  discoverScenarios,
  formatScorecard,
  runEval,
  type ScenarioResult,
} from './harness';

const specs = discoverScenarios();
const byKey = new Map<string, ScenarioResult>();
let all: ScenarioResult[] = [];

beforeAll(async () => {
  all = await runEval();
  for (const r of all) {
    byKey.set(`${r.group}/${r.scenario}`, r);
  }
});

afterAll(() => {
  console.log('\nlint eval scorecard:\n' + formatScorecard(all));
});

// Group the scenarios by rule so the output reads as a per-rule scorecard.
const groups = [...new Set(specs.map((s) => s.group))].sort();

for (const group of groups) {
  const groupSpecs = specs.filter((s) => s.group === group);

  describe(group, () => {
    it('proves both directions (a _pass and a _fail scenario exist)', () => {
      expect(groupSpecs.some((s) => s.expected === 'pass')).toBe(true);
      expect(groupSpecs.some((s) => s.expected === 'fail')).toBe(true);
    });

    for (const spec of groupSpecs) {
      const verb = spec.expected === 'pass' ? 'is clean' : 'triggers the rule';
      it(`${spec.scenario} ${verb}`, () => {
        const result = byKey.get(spec.key);
        expect(result, `no result for ${spec.key}`).toBeDefined();
        expect(result?.ok, result?.reason).toBe(true);
      });
    }
  });
}
