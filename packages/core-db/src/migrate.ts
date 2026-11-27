import { attempt } from './attempt';
import { DatabaseOpenError } from './database-open-error';
import {
  MIGRATE_V14_TO_V15,
  MIGRATE_V15_TO_V16,
  MIGRATE_V16_TO_V17,
} from './migrate-stems';
import { MIGRATE_V31_TO_V32 } from './migrate-manual-tempo';
import { MIGRATE_V30_TO_V31 } from './migrate-presets';
import {
  MIGRATE_V8_TO_V9,
  MIGRATE_V9_TO_V10,
  MIGRATE_V10_TO_V11,
  MIGRATE_V11_TO_V12,
  MIGRATE_V12_TO_V13,
  MIGRATE_V13_TO_V14,
  MIGRATE_V17_TO_V18,
  MIGRATE_V18_TO_V19,
  MIGRATE_V19_TO_V20,
  MIGRATE_V20_TO_V21,
  MIGRATE_V21_TO_V22,
  MIGRATE_V22_TO_V23,
  MIGRATE_V23_TO_V24,
  MIGRATE_V24_TO_V25,
  MIGRATE_V25_TO_V26,
  MIGRATE_V26_TO_V27,
  MIGRATE_V27_TO_V28,
  MIGRATE_V28_TO_V29,
  MIGRATE_V29_TO_V30,
  BASELINE,
  MIGRATE_V7_TO_V8,
} from './migrate-steps';

export const V7_SCHEMA_VERSION = 7;
export const V8_SCHEMA_VERSION = 8;
export const V9_SCHEMA_VERSION = 9;
export const V10_SCHEMA_VERSION = 10;
export const V11_SCHEMA_VERSION = 11;
export const V12_SCHEMA_VERSION = 12;
export const V13_SCHEMA_VERSION = 13;
export const V14_SCHEMA_VERSION = 14;
export const V15_SCHEMA_VERSION = 15;
export const V16_SCHEMA_VERSION = 16;
export const V17_SCHEMA_VERSION = 17;
export const V18_SCHEMA_VERSION = 18;
export const V19_SCHEMA_VERSION = 19;
export const V20_SCHEMA_VERSION = 20;
export const V21_SCHEMA_VERSION = V20_SCHEMA_VERSION + 1;
export const V22_SCHEMA_VERSION = V21_SCHEMA_VERSION + 1;
export const V23_SCHEMA_VERSION = V22_SCHEMA_VERSION + 1;
export const V24_SCHEMA_VERSION = V23_SCHEMA_VERSION + 1;
export const V25_SCHEMA_VERSION = V24_SCHEMA_VERSION + 1;
export const V26_SCHEMA_VERSION = V25_SCHEMA_VERSION + 1;
export const V27_SCHEMA_VERSION = V26_SCHEMA_VERSION + 1;
export const V28_SCHEMA_VERSION = V27_SCHEMA_VERSION + 1;
export const V29_SCHEMA_VERSION = V28_SCHEMA_VERSION + 1;
export const V30_SCHEMA_VERSION = V29_SCHEMA_VERSION + 1;
export const V31_SCHEMA_VERSION = V30_SCHEMA_VERSION + 1;
export const SCHEMA_VERSION = V31_SCHEMA_VERSION + 1;

export const OLDEST_UPGRADABLE_VERSION = V7_SCHEMA_VERSION;

export interface MigrationDriver {
  exec(sql: string): void;
  getUserVersion(): number;
  setUserVersion(version: number): void;
}
function runStatements(
  driver: MigrationDriver,
  statements: readonly string[],
): unknown[] {
  const setupErrors = attempt(() => {
    // Renames and drops must not fire FK actions, and the pragma is a no-op
    // inside a transaction, so it is toggled around BEGIN.
    driver.exec('PRAGMA foreign_keys = OFF');
    driver.exec('BEGIN');
  });
  if (setupErrors.length > 0) return setupErrors;
  try {
    for (const statement of statements) driver.exec(statement);
    driver.setUserVersion(SCHEMA_VERSION);
    driver.exec('COMMIT');
    return [];
  } catch (error) {
    return [
      error,
      ...attempt(() => {
        driver.exec('ROLLBACK');
      }),
    ];
  }
}

// Each step upgrades from the version before `to`.
const UPGRADES: readonly {
  readonly to: number;
  readonly steps: readonly string[];
}[] = [
  { to: V8_SCHEMA_VERSION, steps: MIGRATE_V7_TO_V8 },
  { to: V9_SCHEMA_VERSION, steps: MIGRATE_V8_TO_V9 },
  { to: V10_SCHEMA_VERSION, steps: MIGRATE_V9_TO_V10 },
  { to: V11_SCHEMA_VERSION, steps: MIGRATE_V10_TO_V11 },
  { to: V12_SCHEMA_VERSION, steps: MIGRATE_V11_TO_V12 },
  { to: V13_SCHEMA_VERSION, steps: MIGRATE_V12_TO_V13 },
  { to: V14_SCHEMA_VERSION, steps: MIGRATE_V13_TO_V14 },
  { to: V15_SCHEMA_VERSION, steps: MIGRATE_V14_TO_V15 },
  { to: V16_SCHEMA_VERSION, steps: MIGRATE_V15_TO_V16 },
  { to: V17_SCHEMA_VERSION, steps: MIGRATE_V16_TO_V17 },
  { to: V18_SCHEMA_VERSION, steps: MIGRATE_V17_TO_V18 },
  { to: V19_SCHEMA_VERSION, steps: MIGRATE_V18_TO_V19 },
  { to: V20_SCHEMA_VERSION, steps: MIGRATE_V19_TO_V20 },
  { to: V21_SCHEMA_VERSION, steps: MIGRATE_V20_TO_V21 },
  { to: V22_SCHEMA_VERSION, steps: MIGRATE_V21_TO_V22 },
  { to: V23_SCHEMA_VERSION, steps: MIGRATE_V22_TO_V23 },
  { to: V24_SCHEMA_VERSION, steps: MIGRATE_V23_TO_V24 },
  { to: V25_SCHEMA_VERSION, steps: MIGRATE_V24_TO_V25 },
  { to: V26_SCHEMA_VERSION, steps: MIGRATE_V25_TO_V26 },
  { to: V27_SCHEMA_VERSION, steps: MIGRATE_V26_TO_V27 },
  { to: V28_SCHEMA_VERSION, steps: MIGRATE_V27_TO_V28 },
  { to: V29_SCHEMA_VERSION, steps: MIGRATE_V28_TO_V29 },
  { to: V30_SCHEMA_VERSION, steps: MIGRATE_V29_TO_V30 },
  { to: V31_SCHEMA_VERSION, steps: MIGRATE_V30_TO_V31 },
  { to: SCHEMA_VERSION, steps: MIGRATE_V31_TO_V32 },
];

function upgradeSteps(from: number): readonly string[] {
  if (from === 0) return BASELINE;
  return UPGRADES.filter(({ to }) => to > from).flatMap(({ steps }) => steps);
}

function readUserVersion(driver: MigrationDriver): number {
  try {
    return driver.getUserVersion();
  } catch (error) {
    throw DatabaseOpenError.classify('open', error);
  }
}

function refuseUnsupported(fromVersion: number): void {
  if (fromVersion !== 0 && fromVersion < OLDEST_UPGRADABLE_VERSION)
    throw new DatabaseOpenError('legacy-version', { fromVersion });
  if (fromVersion > SCHEMA_VERSION)
    throw new DatabaseOpenError('newer-version', { fromVersion });
}

export function migrate(
  driver: MigrationDriver,
  beforeUpgrade: (fromVersion: number) => void = () => undefined,
): void {
  const fromVersion = readUserVersion(driver);
  refuseUnsupported(fromVersion);
  if (fromVersion > 0 && fromVersion < SCHEMA_VERSION)
    beforeUpgrade(fromVersion);
  const migrationErrors =
    fromVersion < SCHEMA_VERSION
      ? runStatements(driver, upgradeSteps(fromVersion))
      : [];
  const pragmaErrors = attempt(() => {
    driver.exec('PRAGMA foreign_keys = ON');
  });
  const errors = [...migrationErrors, ...pragmaErrors];
  if (errors.length === 0) return;
  const [cause, ...cleanupErrors] = errors;
  throw DatabaseOpenError.classify(
    migrationErrors.length > 0 ? 'migration' : 'foreign-keys',
    cause,
    { fromVersion, cleanupErrors },
  );
}
