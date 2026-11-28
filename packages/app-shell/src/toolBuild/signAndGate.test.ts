import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HOST_API } from '../toolHost/hostApi';
import type { ToolIndex, ToolManifest } from './manifest';
import { sha256 } from './signature';
import {
  ASSET,
  buildTool,
  copyTree,
  EXIT_NO_KEY,
  EXIT_OK,
  EXIT_REJECTED,
  FIXTURE,
  flipByte,
  HOST_VERSION,
  HOST_VERSION_CODE,
  makeScratch,
  opensslSign,
  OTHER_HOST_VERSION,
  readManifest,
  run,
  scratchDir,
  testKey,
  type Run,
  type TestKey,
} from './testSupport';
import { writeIndex } from './toolSet';
import { readZip, writeZip, type ZipEntry } from './zip';

const scratch = makeScratch('kbt-sign-');
const keysDir = scratchDir(scratch, 'keys');

interface Pin {
  readonly key: TestKey;
  readonly role: string;
  readonly status?: string;
  readonly keyId?: string;
}

function pinFile(name: string, pins: readonly Pin[]): string {
  const file = path.join(scratchDir(scratch, 'pins'), name);
  const keys = pins.map(({ key, role, status, keyId }) => ({
    keyId: keyId ?? key.keyId,
    role,
    ...(status === undefined ? {} : { status }),
    spkiBase64: key.spkiBase64,
  }));
  writeFileSync(file, JSON.stringify({ schema: 1, keys }));
  return file;
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

function rewriteKbt(
  kbt: string,
  change: (entries: ZipEntry[]) => ZipEntry[],
): void {
  writeFileSync(kbt, writeZip(change(readZip(readFileSync(kbt)))));
}

function rewriteManifest(
  entries: ZipEntry[],
  change: (manifest: ToolManifest) => ToolManifest,
): ZipEntry[] {
  return entries.map((entry) => {
    if (entry.name !== 'manifest.json') return entry;
    const manifest = JSON.parse(entry.data.toString('utf8')) as ToolManifest;
    return {
      name: entry.name,
      data: Buffer.from(JSON.stringify(change(manifest))),
    };
  });
}

const tools = testKey(keysDir, 'test-tools-1');
const stranger = testKey(keysDir, 'test-tools-9');
const revocation = testKey(keysDir, 'test-revocation-1');
const p384 = testKey(keysDir, 'test-tools-p384', 'P-384');
const pins = pinFile('tool-keys.json', [
  { key: revocation, role: 'revocation' },
  { key: tools, role: 'tools', status: 'current' },
]);

let built = '';
let signed = '';

function copySet(from: string, name: string): string {
  return copyTree(from, path.join(scratch, name));
}

beforeAll(() => {
  built = scratchDir(scratch, 'built');
  buildTool(built);
  signed = copySet(built, 'signed');
  sign(signed, tools);
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('sign-tools.sh', () => {
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
    const manifest = readManifest(readFileSync(path.join(signed, ASSET)));
    expect(manifest.signature).toEqual({ alg: 'ES256', keyId: 'test-tools-1' });
  });

  it('signs with a key given through the environment', () => {
    const dir = copySet(built, 'signed-env');
    const result = run('sign-tools.sh', ['--host-version', HOST_VERSION, dir], {
      TOOLS_SIGNING_KEY: readFileSync(tools.key).toString('base64'),
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

  it('refuses a key id that is not a key id', () => {
    const result = run('sign-tools.sh', [
      '--key',
      tools.key,
      '--key-id',
      'Tools 1',
      '--host-version',
      HOST_VERSION,
      copySet(built, 'bad-id'),
    ]);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain("key id 'Tools 1' is not a key id");
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

describe('tools-gate.sh', () => {
  it('rejects a bundle with one byte changed', () => {
    const dir = copySet(signed, 'tampered-kbt');
    const kbt = path.join(dir, ASSET);
    writeFileSync(kbt, flipByte(readFileSync(kbt), 1));
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('kbtSha256');
  });

  it('rejects a manifest with one byte changed even when the index is re-signed', () => {
    const dir = copySet(signed, 'tampered-manifest');
    rewriteKbt(path.join(dir, ASSET), (entries) =>
      entries.map((e) =>
        e.name === 'manifest.json'
          ? {
              name: e.name,
              data: Buffer.from(
                e.data.toString('utf8').replace('"Sample"', '"Sampla"'),
              ),
            }
          : e,
      ),
    );
    const { input, output } = writeIndex(dir, tools.keyId, {
      versionName: HOST_VERSION,
      versionCode: HOST_VERSION_CODE,
    });
    opensslSign(tools.key, input, output);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('manifest.sig does not verify');
  });

  it('rejects a signed manifest that lists a path escaping assets/', () => {
    const dir = copySet(built, 'zip-slip');
    const data = Buffer.from('{}');
    const slip = {
      path: 'assets/../x',
      sha256: sha256(data),
      size: data.length,
    };
    rewriteKbt(path.join(dir, ASSET), (entries) => [
      ...rewriteManifest(entries, (m) => ({
        ...m,
        files: [...m.files, slip],
        size: m.size + slip.size,
      })),
      { name: slip.path, data },
    ]);
    sign(dir, tools);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('"path":"assets/../x"');
    expect(result.output).toContain('is malformed');
  });

  it('rejects a bytecode file that no longer matches its manifest hash', () => {
    const dir = copySet(built, 'tampered-hbc');
    rewriteKbt(path.join(dir, ASSET), (entries) =>
      entries.map((e) =>
        e.name === 'bundle.hbc'
          ? { name: e.name, data: Buffer.concat([e.data, Buffer.from([0])]) }
          : e,
      ),
    );
    sign(dir, tools);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('bundle.hbc sha256 does not match');
  });

  it('rejects a bundle carrying a file its manifest does not list', () => {
    const dir = copySet(built, 'extra-entry');
    rewriteKbt(path.join(dir, ASSET), (entries) => [
      ...entries,
      { name: 'assets/extra.json', data: Buffer.from('{}') },
    ]);
    sign(dir, tools);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain(
      'assets/extra.json is not listed in the manifest',
    );
  });

  it('rejects a bundle carrying the same entry twice', () => {
    const dir = copySet(built, 'duplicate-entry');
    rewriteKbt(path.join(dir, ASSET), (entries) => [
      ...entries,
      ...entries.filter((e) => e.name === 'assets/notes.json'),
    ]);
    sign(dir, tools);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain('assets/notes.json appears twice');
  });

  it('rejects a set signed by a key that is not pinned', () => {
    const dir = copySet(built, 'stranger');
    sign(dir, stranger);
    const result = gate(dir, pins);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain(
      'signed by test-tools-9, which is not a pinned current or next tool key',
    );
  });

  it('rejects a set signed by the revocation key', () => {
    const dir = copySet(built, 'revocation-signed');
    sign(dir, revocation);
    expect(gate(dir, pins).status).toBe(EXIT_REJECTED);
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
    expect(result.output).toContain('the pin file holds test-revocation-1');
  });

  it('rejects an index whose host version is not this release', () => {
    const result = run('tools-gate.sh', [
      '--keys',
      pins,
      '--host-version',
      OTHER_HOST_VERSION,
      signed,
    ]);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain(`not ${OTHER_HOST_VERSION}`);
  });

  it('rejects a set with no index', () => {
    const dir = copySet(signed, 'no-index');
    rmSync(path.join(dir, 'tools-index.json'));
    expect(gate(dir, pins).status).toBe(EXIT_REJECTED);
  });
});

describe('tools-gate.sh pin file', () => {
  const current = { key: tools, role: 'tools', status: 'current' } as const;
  it.each([
    [
      'a key id pinned twice',
      [
        current,
        { key: stranger, role: 'tools', status: 'next', keyId: 'test-tools-1' },
      ],
      'pin test-tools-1: keyId is pinned twice',
    ],
    [
      'a tool key with no status',
      [current, { key: stranger, role: 'tools' }],
      'pin test-tools-9: a tool key needs a status',
    ],
    [
      'a revocation key with a status',
      [current, { key: revocation, role: 'revocation', status: 'current' }],
      'pin test-revocation-1: only a tool key has a status',
    ],
    [
      'an unknown role',
      [current, { key: stranger, role: 'owner', status: 'next' }],
      'pin test-tools-9: role must be one of',
    ],
    [
      'a key that is not P-256',
      [current, { key: p384, role: 'tools', status: 'next' }],
      'pin test-tools-p384: spkiBase64 is not a P-256',
    ],
    [
      'a malformed key id',
      [
        current,
        { key: stranger, role: 'tools', status: 'next', keyId: 'Tools 9' },
      ],
      'pin Tools 9: keyId is not a key id',
    ],
  ] as const)('rejects %s', (_name, entries, message) => {
    const file = pinFile(
      `${message.slice(4, 20).replace(/\W/g, '_')}.json`,
      entries,
    );
    const result = gate(signed, file);
    expect(result.status).toBe(EXIT_REJECTED);
    expect(result.output).toContain(message);
  });
});
