import { describe, expect, it } from 'vitest';

import { MAX_INFLATED_BYTES, readZip, writeZip } from './zip';

const DATA = Buffer.from('hello hello hello');
const LOCAL = { flags: 6, crc: 14, size: 22 };
const CENTRAL = { flags: 8, crc: 16, size: 24, localOffset: 42, name: 46 };
const END_DIRECTORY_OFFSET_FROM_END = 6;

function archive(names: readonly string[] = ['a.txt']): Buffer {
  return writeZip(names.map((name) => ({ name, data: DATA })));
}

function centralAt(zip: Buffer, index = 0): number {
  let at = zip.readUInt32LE(zip.length - END_DIRECTORY_OFFSET_FROM_END);
  for (let skipped = 0; skipped < index; skipped++)
    at += CENTRAL.name + zip.readUInt16LE(at + 28);
  return at;
}

function setBoth(
  zip: Buffer,
  field: 'flags' | 'crc' | 'size',
  change: (value: number) => number,
): Buffer {
  const out = Buffer.from(zip);
  const central = centralAt(out);
  if (field === 'flags') {
    out.writeUInt16LE(change(out.readUInt16LE(LOCAL.flags)), LOCAL.flags);
    out.writeUInt16LE(
      change(out.readUInt16LE(central + CENTRAL.flags)),
      central + CENTRAL.flags,
    );
  } else {
    out.writeUInt32LE(change(out.readUInt32LE(LOCAL[field])), LOCAL[field]);
    out.writeUInt32LE(
      change(out.readUInt32LE(central + CENTRAL[field])),
      central + CENTRAL[field],
    );
  }
  return out;
}

describe('readZip', () => {
  it('reads back what writeZip wrote', () => {
    expect(readZip(archive(['a.txt', 'b/c.txt']))).toEqual([
      { name: 'a.txt', data: DATA },
      { name: 'b/c.txt', data: DATA },
    ]);
  });

  it('keeps duplicate names for the gate to judge', () => {
    expect(readZip(archive(['a.txt', 'a.txt'])).map((e) => e.name)).toEqual([
      'a.txt',
      'a.txt',
    ]);
  });

  it('rejects a CRC mismatch', () => {
    expect(() =>
      readZip(setBoth(archive(), 'crc', (crc) => (crc ^ 1) >>> 0)),
    ).toThrow('CRC does not match');
  });

  it('rejects a truncated archive', () => {
    const zip = archive();
    expect(() => readZip(zip.subarray(0, zip.length - 1))).toThrow(
      'no end of central directory',
    );
  });

  it('rejects an encrypted entry', () => {
    expect(() =>
      readZip(setBoth(archive(), 'flags', (flags) => flags | 1)),
    ).toThrow('a.txt: encrypted');
  });

  it('rejects an entry that inflates past its declared size', () => {
    expect(() =>
      readZip(setBoth(archive(), 'size', (size) => size - 1)),
    ).toThrow('inflates past its declared size');
  });

  it('rejects entries that declare more than the inflate cap', () => {
    expect(() =>
      readZip(setBoth(archive(), 'size', () => MAX_INFLATED_BYTES + 1)),
    ).toThrow(`over ${String(MAX_INFLATED_BYTES)}`);
  });

  it('rejects overlapping entries', () => {
    const zip = archive(['a.txt', 'a.txt']);
    zip.writeUInt32LE(0, centralAt(zip, 1) + CENTRAL.localOffset);
    expect(() => readZip(zip)).toThrow('overlaps another entry');
  });

  it('rejects a central name that disagrees with the local header', () => {
    const zip = archive(['a.txt']);
    zip.write('b', centralAt(zip) + CENTRAL.name);
    expect(() => readZip(zip)).toThrow('local and central headers disagree');
  });
});
