import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TOOL_REGISTRY_KEY } from '../toolHost/bundleContract';
import { HOST_API } from '../toolHost/hostApi';
import { probeGlobals, stubModule } from './globalsProbe';
import type { ToolIndex, ToolManifest } from './manifest';
import { writeIndex } from './toolSet';
import { readZip, writeZip } from './zip';

const REPO = path.resolve(import.meta.dirname, '../../../..');
const SCRIPTS = path.join(REPO, 'scripts');
const FIXTURE = path.join(import.meta.dirname, 'fixtures/tool-sample');
const ASSET = 'tool-sample-1.2.3.kbt';
const HOST_VERSION = '0.101.0';
const HOST_VERSION_CODE = 10100;
const SCRIPT_TIMEOUT_MS = 120000;

const EXIT_OK = 0;
const EXIT_REJECTED = 1;
const EXIT_NO_KEY = 2;
const EXIT_USAGE = 3;

const scratch = mkdtempSync(path.join(tmpdir(), 'kbt-scripts-'));

interface Run {
  readonly status: number | null;
  readonly output: string;
}

function run(
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

function scratchDir(name: string): string {
  const dir = path.join(scratch, name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

interface TestKey {
  readonly keyId: string;
  readonly key: string;
  readonly spkiBase64: string;
}

function testKey(keyId: string): TestKey {
  const key = path.join(scratchDir('keys'), `${keyId}.key`);
  execFileSync('openssl', [
    'genpkey',
    '-algorithm',
    'EC',
    '-pkeyopt',
    'ec_paramgen_curve:P-256',
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

interface PinnedKey {
  readonly key: TestKey;
  readonly role: 'tools' | 'revocation';
  readonly status?: 'current' | 'next' | 'retired';
}

function pinFile(name: string, pins: readonly PinnedKey[]): string {
  const file = path.join(scratchDir('pins'), name);
  const keys = pins.map(({ key, role, status }) => ({
    keyId: key.keyId,
    role,
    ...(status === undefined ? {} : { status }),
    spkiBase64: key.spkiBase64,
  }));
  writeFileSync(file, JSON.stringify({ schema: 1, keys }));
  return file;
}

function build(out: string, toolDir = FIXTURE): Run {
  return run('build-tool.sh', [
    '--out',
    out,
    '--host-version',
    HOST_VERSION,
    toolDir,
  ]);
}

function sign(dir: string, key: TestKey): Run {
  return run('sign-tools.sh', [
    '--key',
    key.key,
    '--key-id',
    key.keyId,
    '--host-version',
    HOST_VERSION,
    dir,
  ]);
}

function gate(dir: string, keys: string, ...extra: string[]): Run {
  return run('tools-gate.sh', [
    '--keys',
    keys,
    '--host-version',
    HOST_VERSION,
    ...extra,
    dir,
  ]);
}

function copySet(from: string, name: string): string {
  const dir = path.join(scratch, name);
  cpSync(from, dir, { recursive: true });
  return dir;
}

function entry(zip: Buffer, name: string): Buffer {
  const found = readZip(zip).find((e) => e.name === name);
  if (found === undefined) throw new Error(`${name} missing from the bundle`);
  return found.data;
}

function rewriteEntry(
  kbt: string,
  name: string,
  change: (data: Buffer) => Buffer,
): void {
  const entries = readZip(readFileSync(kbt)).map((e) =>
    e.name === name ? { name, data: change(e.data) } : e,
  );
  writeFileSync(kbt, writeZip(entries));
}

const tools = testKey('test-tools-1');
const stranger = testKey('test-tools-9');
const revocation = testKey('test-revocation-1');
const pins = pinFile('tool-keys.json', [
  { key: revocation, role: 'revocation' },
  { key: tools, role: 'tools', status: 'current' },
]);

let built = '';
let signed = '';
let builtRun: Run = { status: null, output: '' };

beforeAll(() => {
  built = scratchDir('built');
  builtRun = build(built);
  signed = copySet(built, 'signed');
  sign(signed, tools);
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe.each(['build-tool.sh', 'sign-tools.sh', 'tools-gate.sh'])(
  '%s',
  (script) => {
    it('prints usage with its exit codes on -h', () => {
      const help = run(script, ['-h']);
      expect(help.status).toBe(EXIT_USAGE);
      expect(help.output).toMatch(/^usage: /m);
      expect(help.output).toMatch(/^exit 0 /m);
    });

    it('rejects an unknown option as a usage error', () => {
      const result = run(script, ['--bogus', scratch]);
      expect(result.status).toBe(EXIT_USAGE);
      expect(result.output).toContain('unknown option --bogus');
    });
  },
);

describe('build-tool.sh', () => {
  it('builds the fixture into one bundle', () => {
    expect(builtRun.status, builtRun.output).toBe(EXIT_OK);
    expect(readdirSync(built).filter((f) => f.endsWith('.kbt'))).toEqual([
      ASSET,
    ]);
  });

  it('zips the manifest, the bytecode and the assets, unsigned', () => {
    const names = readZip(readFileSync(path.join(built, ASSET))).map(
      (e) => e.name,
    );
    expect(names.sort()).toEqual([
      'assets/notes.json',
      'bundle.hbc',
      'manifest.json',
    ]);
  });

  it('writes a manifest that lists every file with its hash and size', () => {
    const zip = readFileSync(path.join(built, ASSET));
    const manifest = JSON.parse(
      entry(zip, 'manifest.json').toString('utf8'),
    ) as ToolManifest;
    const sizes = manifest.files.map((f) => f.size);
    expect(manifest).toMatchObject({
      schema: 1,
      id: 'sample',
      version: '1.2.3',
      entry: 'bundle.hbc',
      hostApi: { major: HOST_API.major, minMinor: HOST_API.minor },
      host: {
        minVersionCode: HOST_VERSION_CODE,
        maxVersionCode: null,
        builtWith: HOST_VERSION,
      },
      routes: ['/t/sample'],
      homeTile: { label: 'Sample', route: '/t/sample' },
    });
    expect(manifest.size).toBe(sizes.reduce((sum, size) => sum + size, 0));
    expect(manifest.files.map((f) => f.path).sort()).toEqual([
      'assets/notes.json',
      'bundle.hbc',
    ]);
    expect(manifest).not.toHaveProperty('signature');
  });

  it('pins the bytecode version the host hermesc wrote', () => {
    const zip = readFileSync(path.join(built, ASSET));
    const manifest = JSON.parse(
      entry(zip, 'manifest.json').toString('utf8'),
    ) as ToolManifest;
    const headerVersion = entry(zip, 'bundle.hbc').readUInt32LE(8);
    expect(manifest.runtime.hermesBytecodeVersion).toBe(headerVersion);
  });

  it('emits JavaScript that adds no global and registers the entry', () => {
    const js = readFileSync(path.join(built, 'build/sample/bundle.js'), 'utf8');
    const registered: unknown[] = [];
    const probe = probeGlobals(js, (global) => {
      global[TOOL_REGISTRY_KEY] = {
        module: () => stubModule(),
        register: (id: string, register: unknown) =>
          registered.push(id, typeof register),
      };
    });
    expect(probe).toEqual({ added: [], changed: [] });
    expect(registered).toEqual(['sample', 'function']);
  });

  it('fails a tool that imports a package off the allowlist', () => {
    const tool = copySet(FIXTURE, 'tool-zustand');
    writeFileSync(
      path.join(tool, 'src/store.ts'),
      "export { create } from 'zustand';\n",
    );
    writeFileSync(
      path.join(tool, 'src/index.tsx'),
      "export * from './store';\n",
      { flag: 'a' },
    );
    const result = build(scratchDir('out-zustand'), tool);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain(
      'imports zustand, which is not on the downloadable allowlist',
    );
  });

  it('fails a tool whose path import leaves its package', () => {
    const tool = copySet(FIXTURE, 'tool-escape');
    const repoFile = path.join(FIXTURE, 'src/routes');
    writeFileSync(
      path.join(tool, 'src/index.tsx'),
      `export * from '${repoFile}';\n`,
      { flag: 'a' },
    );
    const result = build(scratchDir('out-escape'), tool);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('which is outside the tool package');
  });
});

describe('sign-tools.sh and tools-gate.sh', () => {
  it('signs every bundle and the index so the gate passes', () => {
    const result = gate(signed, pins);
    expect(result.status, result.output).toBe(EXIT_OK);
  });

  it('writes an index that names the bundle by its hashes', () => {
    const index = JSON.parse(
      readFileSync(path.join(signed, 'tools-index.json'), 'utf8'),
    ) as ToolIndex;
    expect(index).toMatchObject({
      schema: 1,
      host: { versionName: HOST_VERSION, versionCode: HOST_VERSION_CODE },
      hostApi: HOST_API,
      signature: { alg: 'ES256', keyId: 'test-tools-1' },
    });
    expect(index.tools.map((t) => t.asset)).toEqual([ASSET]);
  });

  it('stamps the key id into the signed manifest bytes', () => {
    const zip = readFileSync(path.join(signed, ASSET));
    const manifest = JSON.parse(
      entry(zip, 'manifest.json').toString('utf8'),
    ) as ToolManifest;
    expect(manifest.signature).toEqual({ alg: 'ES256', keyId: 'test-tools-1' });
  });

  it('signs with a key given through the environment', () => {
    const dir = copySet(built, 'signed-env');
    const pem = readFileSync(tools.key).toString('base64');
    const result = run('sign-tools.sh', ['--host-version', HOST_VERSION, dir], {
      TOOLS_SIGNING_KEY: pem,
      TOOLS_SIGNING_KEY_ID: tools.keyId,
    });
    expect(result.status, result.output).toBe(EXIT_OK);
    expect(gate(dir, pins).status).toBe(EXIT_OK);
  });

  it('refuses to sign with no key', () => {
    const result = run(
      'sign-tools.sh',
      ['--host-version', HOST_VERSION, copySet(built, 'no-key')],
      {
        TOOLS_SIGNING_KEY: '',
        TOOLS_SIGNING_KEY_ID: '',
      },
    );
    expect(result.status).toBe(EXIT_NO_KEY);
  });

  it('rejects a bundle with one byte changed', () => {
    const dir = copySet(signed, 'tampered-kbt');
    const kbt = path.join(dir, ASSET);
    const bytes = readFileSync(kbt);
    bytes.writeUInt8(bytes.readUInt8(bytes.length - 1) ^ 1, bytes.length - 1);
    writeFileSync(kbt, bytes);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('kbtSha256');
  });

  it('rejects a manifest with one byte changed even when the index is re-signed', () => {
    const dir = copySet(built, 'tampered-manifest');
    sign(dir, tools);
    rewriteEntry(path.join(dir, ASSET), 'manifest.json', (data) =>
      Buffer.from(data.toString('utf8').replace('"Sample"', '"Sampla"')),
    );
    writeIndex(dir, tools.keyId, {
      versionName: HOST_VERSION,
      versionCode: HOST_VERSION_CODE,
    });
    const index = path.join(dir, 'tools-index.json');
    execFileSync('openssl', [
      'dgst',
      '-sha256',
      '-sign',
      tools.key,
      '-out',
      `${index}.sig`,
      index,
    ]);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('manifest.sig');
  });

  it('rejects a bytecode file that no longer matches its manifest hash', () => {
    const dir = copySet(built, 'tampered-hbc');
    rewriteEntry(path.join(dir, ASSET), 'bundle.hbc', (data) =>
      Buffer.concat([data, Buffer.from([0])]),
    );
    sign(dir, tools);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('bundle.hbc');
  });

  it('rejects a bundle carrying a file its manifest does not list', () => {
    const dir = copySet(built, 'extra-entry');
    const kbt = path.join(dir, ASSET);
    const entries = readZip(readFileSync(kbt));
    writeFileSync(
      kbt,
      writeZip([
        ...entries,
        { name: 'assets/extra.json', data: Buffer.from('{}') },
      ]),
    );
    sign(dir, tools);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('assets/extra.json');
  });

  it('rejects a set signed by a key that is not pinned', () => {
    const dir = copySet(built, 'stranger');
    sign(dir, stranger);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('test-tools-9');
  });

  it('rejects a set signed by the revocation key, even one marked current', () => {
    const dir = copySet(built, 'revocation-signed');
    sign(dir, revocation);
    const misfiled = pinFile('revocation-current.json', [
      { key: revocation, role: 'revocation', status: 'current' },
    ]);
    expect(gate(dir, pins).status).toBe(EXIT_REJECTED);
    expect(gate(dir, misfiled).status).toBe(EXIT_REJECTED);
  });

  it('rejects a set signed by a retired tool key', () => {
    const retired = pinFile('retired.json', [
      { key: tools, role: 'tools', status: 'retired' },
    ]);
    expect(gate(signed, retired).status).toBe(EXIT_REJECTED);
  });

  it('refuses a release whose pin file holds a test- key', () => {
    const result = gate(signed, pins, '--release');
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('test-');
  });

  it('rejects an index whose host version is not this release', () => {
    const result = run('tools-gate.sh', [
      '--keys',
      pins,
      '--host-version',
      '0.102.0',
      signed,
    ]);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('0.102.0');
  });

  it('rejects a set with no index', () => {
    const dir = copySet(signed, 'no-index');
    rmSync(path.join(dir, 'tools-index.json'));
    expect(gate(dir, pins).status).toBe(EXIT_REJECTED);
  });

  it('keeps the unsigned bundle untouched when signing fails', () => {
    const dir = copySet(built, 'bad-key');
    const bad = path.join(scratch, 'not-a-key.key');
    copyFileSync(path.join(FIXTURE, 'package.json'), bad);
    const before = readFileSync(path.join(dir, ASSET));
    const result = run('sign-tools.sh', [
      '--key',
      bad,
      '--key-id',
      'test-tools-1',
      '--host-version',
      HOST_VERSION,
      dir,
    ]);
    expect(result.status).toBe(EXIT_NO_KEY);
    expect(readFileSync(path.join(dir, ASSET)).equals(before)).toBe(true);
  });
});
