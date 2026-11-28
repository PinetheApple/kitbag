import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { ToolManifest } from './manifest';
import { readZip } from './zip';

export const SCRIPTS = path.resolve(import.meta.dirname, '../../../../scripts');
export const FIXTURE = path.join(import.meta.dirname, 'fixtures/tool-sample');
export const ASSET = 'tool-sample-1.2.3.kbt';
export const HOST_VERSION = '0.101.0';
export const OTHER_HOST_VERSION = '0.102.0';
export const HOST_VERSION_CODE = 10100;

export const EXIT_OK = 0;
export const EXIT_REJECTED = 1;
export const EXIT_NO_KEY = 2;
export const EXIT_USAGE = 3;

const SCRIPT_TIMEOUT_MS = 120000;
const OVERHEAD_PER_SCRIPT_MS = 10000;
export const ONE_SCRIPT_TIMEOUT_MS = SCRIPT_TIMEOUT_MS + OVERHEAD_PER_SCRIPT_MS;
export const TWO_SCRIPT_TIMEOUT_MS = 2 * ONE_SCRIPT_TIMEOUT_MS;

export interface Run {
  readonly status: number | null;
  readonly output: string;
}

export interface TestKey {
  readonly keyId: string;
  readonly key: string;
  readonly spkiBase64: string;
}

export function makeScratch(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function scratchDir(scratch: string, name: string): string {
  const dir = path.join(scratch, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function copyTree(from: string, to: string): string {
  cpSync(from, to, { recursive: true });
  return to;
}

export function run(
  script: string,
  args: readonly string[],
  env: Record<string, string> = {},
): Run {
  const result = spawnSync('bash', [path.join(SCRIPTS, script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: SCRIPT_TIMEOUT_MS,
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

export function buildTool(out: string, toolDir = FIXTURE): Run {
  return run('build-tool.sh', [
    '--out',
    out,
    '--host-version',
    HOST_VERSION,
    toolDir,
  ]);
}

export function testKey(dir: string, keyId: string, curve = 'P-256'): TestKey {
  const key = path.join(dir, `${keyId}.key`);
  execFileSync('openssl', [
    'genpkey',
    '-algorithm',
    'EC',
    '-pkeyopt',
    `ec_paramgen_curve:${curve}`,
    '-out',
    key,
  ]);
  const spki = execFileSync('openssl', [
    'pkey',
    '-in',
    key,
    '-pubout',
    '-outform',
    'DER',
  ]);
  return { keyId, key, spkiBase64: spki.toString('base64') };
}

export function opensslSign(key: string, input: string, output: string): void {
  execFileSync('openssl', [
    'dgst',
    '-sha256',
    '-sign',
    key,
    '-out',
    output,
    input,
  ]);
}

export function flipByte(bytes: Buffer, fromEnd: number): Buffer {
  const copy = Buffer.from(bytes);
  const at = copy.length - fromEnd;
  copy.writeUInt8(copy.readUInt8(at) ^ 1, at);
  return copy;
}

export function zipEntry(zip: Buffer, name: string): Buffer {
  const found = readZip(zip).find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`${name} missing from the bundle`);
  return found.data;
}

export function readManifest(zip: Buffer): ToolManifest {
  return JSON.parse(
    zipEntry(zip, 'manifest.json').toString('utf8'),
  ) as ToolManifest;
}
