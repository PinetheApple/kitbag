import { createRequire } from 'node:module';
import path from 'node:path';

export const APP_SHELL_DIR = path.resolve(import.meta.dirname, '../..');
export const MONOREPO_DIR = path.resolve(APP_SHELL_DIR, '../..');
export const appShellRequire = createRequire(
  path.join(APP_SHELL_DIR, 'package.json'),
);

export class BuildError extends Error {}
