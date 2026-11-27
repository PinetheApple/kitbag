import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { verifyEs256 } from './signature';
import { flipByte, makeScratch, opensslSign, testKey } from './testSupport';

const scratch = makeScratch('kbt-sig-');
const input = path.join(scratch, 'sample.json');
const output = path.join(scratch, 'sample.sig');

function signSample(key: string, data: Buffer): Buffer {
  writeFileSync(input, data);
  opensslSign(key, input, output);
  return readFileSync(output);
}

const signer = testKey(scratch, 'test-tools-1');
const other = testKey(scratch, 'test-tools-2');
const p384 = testKey(scratch, 'test-tools-p384', 'P-384');
const sample = Buffer.from('{"schema":1,"id":"sample"}');
const signature = signSample(signer.key, sample);

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
    expect(
      verifyEs256(sample, signSample(p384.key, sample), p384.spkiBase64),
    ).toBe(false);
  });

  it('rejects bytes that are not a public key', () => {
    expect(verifyEs256(sample, signature, 'bm90IGEga2V5')).toBe(false);
  });
});
