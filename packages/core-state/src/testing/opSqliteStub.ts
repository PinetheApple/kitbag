// Test-only stub for `@op-engineering/op-sqlite`, wired via vitest.config.mjs
// alias: the core-db barrel loads it, and its node build needs better-sqlite3.
// Tests inject a fake tuning repository, so no database is ever opened.
export const open = (): never => {
  throw new Error('op-sqlite stub (test only): no database under vitest');
};
