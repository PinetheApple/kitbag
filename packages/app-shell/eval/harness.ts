// The ported lint eval harness (SPEC §13.6, §14 "Lint rules" row).
//
// The Flutter build had `packages/app_shell/eval/`: it scored the custom lint
// rules against `*_pass` / `*_fail` scenario files, and was the reason a rule
// change could be verified rather than hoped at. This is the ESLint analogue.
//
// A scenario is a directory `scenarios/<rule-group>/<name>_(pass|fail)/` holding
// a realistic multi-file tree under `packages/<pkg>/…`, so the rules resolve
// package identity (custom rules read `packages/<pkg>/` in the path; boundaries
// resolves relative imports to their target element) exactly as they will in
// the real workspace. The directory suffix declares the expected outcome; the
// rule-group directory declares which rule a `_fail` must actually trigger —
// a `_fail` that fires the wrong rule (or none) is not a valid scenario.
//
// The gate (SPEC §13.6): every `_fail` triggers its expected rule and every
// `_pass` is clean. The ESLint analogue of `--fatal-infos` is `--max-warnings 0`,
// which here means: a passing scenario has zero messages of any severity.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

import { evalConfig } from './eval.config';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCENARIOS_DIR = path.join(HERE, 'scenarios');

// Rule-group directory → the ruleId a `_fail` scenario in it must trigger.
// The four custom rules plus the boundaries import-graph rule (SPEC §13.6).
const GROUP_EXPECTED_RULE: Readonly<Record<string, string>> = {
  'native-only-in-core-native': 'kitbag/native-only-in-core-native',
  'zustand-create-only-in-core-state':
    'kitbag/zustand-create-only-in-core-state',
  'plugin-api-imports-nothing': 'kitbag/plugin-api-imports-nothing',
  'filename-naming-convention': 'kitbag/filename-naming-convention',
  'import-graph': 'boundaries/element-types',
};

const PASS_SUFFIX = '_pass';
const FAIL_SUFFIX = '_fail';

export interface ScenarioResult {
  readonly group: string;
  readonly scenario: string;
  readonly expected: 'pass' | 'fail';
  readonly expectedRuleId: string;
  readonly firedRuleIds: readonly string[];
  readonly messageCount: number;
  readonly ok: boolean;
  readonly reason: string;
}

interface ScenarioSpec {
  readonly group: string;
  readonly scenario: string;
  readonly key: string;
  readonly expected: 'pass' | 'fail';
  readonly expectedRuleId: string;
}

function dirsIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

// Discover scenarios from the filesystem (not from lint output) so a scenario
// whose files never got linted surfaces as a failure instead of vanishing.
export function discoverScenarios(): ScenarioSpec[] {
  const specs: ScenarioSpec[] = [];
  for (const group of dirsIn(SCENARIOS_DIR)) {
    const expectedRuleId = GROUP_EXPECTED_RULE[group];
    if (expectedRuleId === undefined) {
      throw new Error(
        `Scenario group '${group}' has no expected rule mapping — add it to GROUP_EXPECTED_RULE.`,
      );
    }
    for (const scenario of dirsIn(path.join(SCENARIOS_DIR, group))) {
      const expected = scenario.endsWith(PASS_SUFFIX)
        ? 'pass'
        : scenario.endsWith(FAIL_SUFFIX)
          ? 'fail'
          : undefined;
      if (expected === undefined) {
        throw new Error(
          `Scenario '${group}/${scenario}' must end in '${PASS_SUFFIX}' or '${FAIL_SUFFIX}'.`,
        );
      }
      specs.push({
        group,
        scenario,
        key: `${group}/${scenario}`,
        expected,
        expectedRuleId,
      });
    }
  }
  return specs;
}

// The scenario key a linted file belongs to: `<group>/<name>_(pass|fail)`.
function scenarioKeyOf(relPath: string): string {
  const [group, scenario] = relPath.split(path.sep);
  return `${group}/${scenario}`;
}

interface Fired {
  readonly ruleIds: string[];
  count: number;
}

async function collectMessages(): Promise<Map<string, Fired>> {
  const eslint = new ESLint({
    cwd: SCENARIOS_DIR,
    overrideConfigFile: true,
    overrideConfig: evalConfig,
    errorOnUnmatchedPattern: false,
  });
  const results = await eslint.lintFiles(['**/*.ts', '**/*.tsx']);

  const byScenario = new Map<string, Fired>();
  for (const result of results) {
    const key = scenarioKeyOf(path.relative(SCENARIOS_DIR, result.filePath));
    let fired = byScenario.get(key);
    if (fired === undefined) {
      fired = { ruleIds: [], count: 0 };
      byScenario.set(key, fired);
    }
    for (const message of result.messages) {
      fired.count += 1;
      // A fatal parse error has a null ruleId; record it so it can never be
      // mistaken for a rule firing.
      fired.ruleIds.push(message.ruleId ?? '<fatal>');
    }
  }
  return byScenario;
}

function evaluate(spec: ScenarioSpec, fired: Fired | undefined): ScenarioResult {
  const firedRuleIds = fired?.ruleIds ?? [];
  const messageCount = fired?.count ?? 0;
  const base = {
    group: spec.group,
    scenario: spec.scenario,
    expected: spec.expected,
    expectedRuleId: spec.expectedRuleId,
    firedRuleIds,
    messageCount,
  } as const;

  if (fired === undefined) {
    return {
      ...base,
      ok: false,
      reason: 'no files were linted for this scenario',
    };
  }

  if (spec.expected === 'pass') {
    const ok = messageCount === 0;
    return {
      ...base,
      ok,
      reason: ok
        ? 'clean'
        : `expected no messages, got: ${firedRuleIds.join(', ')}`,
    };
  }

  const ok = firedRuleIds.includes(spec.expectedRuleId);
  return {
    ...base,
    ok,
    reason: ok
      ? `triggered ${spec.expectedRuleId}`
      : `expected ${spec.expectedRuleId}, got: ${
          firedRuleIds.length > 0 ? firedRuleIds.join(', ') : '(nothing)'
        }`,
  };
}

export async function runEval(): Promise<ScenarioResult[]> {
  const specs = discoverScenarios();
  const fired = await collectMessages();
  return specs.map((spec) => evaluate(spec, fired.get(spec.key)));
}

export function formatScorecard(results: readonly ScenarioResult[]): string {
  const lines = results.map(
    (r) => `  ${r.ok ? 'PASS' : 'FAIL'}  ${r.group}/${r.scenario} — ${r.reason}`,
  );
  const passed = results.filter((r) => r.ok).length;
  lines.push(`  ${passed}/${results.length} scenarios green`);
  return lines.join('\n');
}
