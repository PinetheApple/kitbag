import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { verifyEs256 } from './signature';

const scratch = mkdtempSync(path.join(tmpdir(), 'kbt-sig-'));

function testKey(
  name: string,
  curve = 'P-256',
): { key: string; spkiBase64: string } {
  const key = path.join(scratch, `${name}.key`);
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
  return { key, spkiBase64: spki.toString('base64') };
}

function opensslSign(key: string, data: Buffer): Buffer {
  const input = path.join(scratch, 'sample.json');
  writeFileSync(input, data);
  const sig = path.join(scratch, 'sample.sig');
  execFileSync('openssl', [
    'dgst',
    '-sha256',
    '-sign',
    key,
    '-out',
    sig,
    input,
  ]);
  return readFileSync(sig);
}

const signer = testKey('test-tools-1');
const other = testKey('test-tools-2');
const p384 = testKey('test-tools-p384', 'P-384');
const sample = Buffer.from('{"schema":1,"id":"sample"}');
const signature = opensslSign(signer.key, sample);

function flipByte(bytes: Buffer, fromEnd: number): Buffer {
  const copy = Buffer.from(bytes);
  const at = copy.length - fromEnd;
  copy.writeUInt8(copy.readUInt8(at) ^ 1, at);
  return copy;
}

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('verifyEs256', () => {
  it('accepts an OpenSSL signature over the exact bytes', () => {
    expect(verifyEs256(sample, signature, signer.spkiBase64)).toBe(true);
  });

  it('rejects the signature once one byte of the data changes', () => {
    expect(verifyEs256(flipByte(sample, 2), signature, signer.spkiBase64)).toBe(
      false,
    );
  });

  it('rejects a signature with one byte changed', () => {
    expect(verifyEs256(sample, flipByte(signature, 1), signer.spkiBase64)).toBe(
      false,
    );
  });

  it('rejects a signature made by another key', () => {
    expect(verifyEs256(sample, signature, other.spkiBase64)).toBe(false);
  });

  it('rejects a valid signature from a key that is not P-256', () => {
    const signed = opensslSign(p384.key, sample);
    expect(verifyEs256(sample, signed, p384.spkiBase64)).toBe(false);
  });

  it('rejects bytes that are not a public key', () => {
    expect(verifyEs256(sample, signature, 'bm90IGEga2V5')).toBe(false);
  });
});
