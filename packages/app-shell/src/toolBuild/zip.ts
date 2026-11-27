import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
}

export class ZipError extends Error {}

const U16 = 2;
const U32 = 4;
const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const ZIP_VERSION = 20;
const UTF8_NAMES = 0x0800;
const ENCRYPTED = 0x0001;
const DEFLATED = 8;
// Fixed timestamps, so a rebuild writes the same bytes.
const DOS_MIDNIGHT = 0;
const DOS_1980_01_01 = 0x21;
const MIB = 1_048_576;
const MAX_INFLATED_MIB = 64;
export const MAX_INFLATED_BYTES = MAX_INFLATED_MIB * MIB;

type Width = typeof U16 | typeof U32;
type Layout = readonly (readonly [string, Width])[];
type Fields<L extends Layout> = Record<L[number][0], number>;

const LOCAL_HEADER = [
  ['signature', U32],
  ['versionNeeded', U16],
  ['flags', U16],
  ['method', U16],
  ['time', U16],
  ['date', U16],
  ['crc', U32],
  ['packedSize', U32],
  ['size', U32],
  ['nameLength', U16],
  ['extraLength', U16],
] as const;

const CENTRAL_HEADER = [
  ['signature', U32],
  ['versionMadeBy', U16],
  ['versionNeeded', U16],
  ['flags', U16],
  ['method', U16],
  ['time', U16],
  ['date', U16],
  ['crc', U32],
  ['packedSize', U32],
  ['size', U32],
  ['nameLength', U16],
  ['extraLength', U16],
  ['commentLength', U16],
  ['disk', U16],
  ['internalAttributes', U16],
  ['externalAttributes', U32],
  ['localOffset', U32],
] as const;

const END_RECORD = [
  ['signature', U32],
  ['disk', U16],
  ['directoryDisk', U16],
  ['diskEntries', U16],
  ['entries', U16],
  ['directorySize', U32],
  ['directoryOffset', U32],
  ['commentLength', U16],
] as const;

type CentralFields = Fields<typeof CENTRAL_HEADER>;

interface CentralEntry {
  readonly header: CentralFields;
  readonly name: Buffer;
}

interface Span {
  readonly label: string;
  readonly header: CentralFields;
  readonly start: number;
  readonly dataAt: number;
  readonly end: number;
}

function recordSize(layout: Layout): number {
  return layout.reduce((sum, [, width]) => sum + width, 0);
}

function writeRecord<L extends Layout>(layout: L, fields: Fields<L>): Buffer {
  const values = fields as Record<string, number>;
  const out = Buffer.alloc(recordSize(layout));
  let at = 0;
  for (const [name, width] of layout) {
    const value = values[name] ?? 0;
    if (width === U16) out.writeUInt16LE(value, at);
    else out.writeUInt32LE(value, at);
    at += width;
  }
  return out;
}

function readRecord<L extends Layout>(
  layout: L,
  bytes: Buffer,
  at: number,
): Fields<L> {
  if (at < 0 || at + recordSize(layout) > bytes.length)
    throw new ZipError('truncated zip');
  const values: Record<string, number> = {};
  let cursor = at;
  for (const [name, width] of layout) {
    values[name] =
      width === U16 ? bytes.readUInt16LE(cursor) : bytes.readUInt32LE(cursor);
    cursor += width;
  }
  return values as Fields<L>;
}

function slice(bytes: Buffer, at: number, length: number): Buffer {
  if (at < 0 || at + length > bytes.length) throw new ZipError('truncated zip');
  return bytes.subarray(at, at + length);
}

export function writeZip(entries: readonly ZipEntry[]): Buffer {
  const body: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const packed = deflateRawSync(entry.data);
    const file = {
      versionNeeded: ZIP_VERSION,
      flags: UTF8_NAMES,
      method: DEFLATED,
      time: DOS_MIDNIGHT,
      date: DOS_1980_01_01,
      crc: crc32(entry.data),
      packedSize: packed.length,
      size: entry.data.length,
      nameLength: name.length,
      extraLength: 0,
    };
    const local = writeRecord(LOCAL_HEADER, {
      signature: LOCAL_SIGNATURE,
      ...file,
    });
    body.push(local, name, packed);
    directory.push(
      writeRecord(CENTRAL_HEADER, {
        signature: CENTRAL_SIGNATURE,
        versionMadeBy: ZIP_VERSION,
        ...file,
        commentLength: 0,
        disk: 0,
        internalAttributes: 0,
        externalAttributes: 0,
        localOffset: offset,
      }),
      name,
    );
    offset += local.length + name.length + packed.length;
  }
  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);
  const end = writeRecord(END_RECORD, {
    signature: END_SIGNATURE,
    disk: 0,
    directoryDisk: 0,
    diskEntries: entries.length,
    entries: entries.length,
    directorySize,
    directoryOffset: offset,
    commentLength: 0,
  });
  return Buffer.concat([...body, ...directory, end]);
}

function readDirectory(bytes: Buffer): {
  entries: CentralEntry[];
  directoryOffset: number;
} {
  const endAt = bytes.length - recordSize(END_RECORD);
  const end = readRecord(END_RECORD, bytes, endAt);
  if (end.signature !== END_SIGNATURE || end.commentLength !== 0) {
    throw new ZipError('no end of central directory at the end of the archive');
  }
  if (
    end.disk !== 0 ||
    end.directoryDisk !== 0 ||
    end.diskEntries !== end.entries
  ) {
    throw new ZipError('multi-disk archives are not supported');
  }
  if (end.directoryOffset + end.directorySize !== endAt) {
    throw new ZipError(
      'central directory does not end where the end record starts',
    );
  }
  const entries: CentralEntry[] = [];
  let at = end.directoryOffset;
  for (let index = 0; index < end.entries; index++) {
    const header = readRecord(CENTRAL_HEADER, bytes, at);
    if (header.signature !== CENTRAL_SIGNATURE)
      throw new ZipError('bad central directory entry');
    const nameAt = at + recordSize(CENTRAL_HEADER);
    entries.push({ header, name: slice(bytes, nameAt, header.nameLength) });
    at = nameAt + header.nameLength + header.extraLength + header.commentLength;
  }
  if (at !== endAt)
    throw new ZipError('central directory size does not match its entries');
  return { entries, directoryOffset: end.directoryOffset };
}

function locate(bytes: Buffer, { header, name }: CentralEntry): Span {
  const label = name.toString('utf8');
  if (header.flags & ENCRYPTED) throw new ZipError(`${label}: encrypted`);
  if (header.flags !== UTF8_NAMES)
    throw new ZipError(`${label}: unsupported flags`);
  if (header.method !== DEFLATED) throw new ZipError(`${label}: not deflated`);
  const local = readRecord(LOCAL_HEADER, bytes, header.localOffset);
  if (local.signature !== LOCAL_SIGNATURE)
    throw new ZipError(`${label}: bad local header`);
  const nameAt = header.localOffset + recordSize(LOCAL_HEADER);
  const agrees =
    slice(bytes, nameAt, local.nameLength).equals(name) &&
    local.flags === header.flags &&
    local.method === header.method &&
    local.crc === header.crc &&
    local.packedSize === header.packedSize &&
    local.size === header.size;
  if (!agrees)
    throw new ZipError(`${label}: local and central headers disagree`);
  const dataAt = nameAt + local.nameLength + local.extraLength;
  return {
    label,
    header,
    start: header.localOffset,
    dataAt,
    end: dataAt + header.packedSize,
  };
}

function checkLayout(spans: readonly Span[], directoryOffset: number): void {
  const declared = spans.reduce((sum, span) => sum + span.header.size, 0);
  if (declared > MAX_INFLATED_BYTES) {
    throw new ZipError(
      `entries declare ${String(declared)} bytes, over ${String(MAX_INFLATED_BYTES)}`,
    );
  }
  let previousEnd = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start < previousEnd)
      throw new ZipError(`${span.label}: overlaps another entry`);
    previousEnd = span.end;
  }
  if (previousEnd > directoryOffset)
    throw new ZipError('an entry runs into the central directory');
}

function inflate(bytes: Buffer, span: Span): Buffer {
  const { label, header } = span;
  let data: Buffer;
  try {
    data = inflateRawSync(slice(bytes, span.dataAt, header.packedSize), {
      maxOutputLength: Math.max(header.size, 1),
    });
  } catch {
    throw new ZipError(
      `${label}: inflates past its declared size or is corrupt`,
    );
  }
  if (data.length !== header.size)
    throw new ZipError(`${label}: inflates short of its declared size`);
  if (crc32(data) !== header.crc)
    throw new ZipError(`${label}: CRC does not match`);
  return data;
}

export function readZip(bytes: Buffer): ZipEntry[] {
  const { entries, directoryOffset } = readDirectory(bytes);
  const spans = entries.map((entry) => locate(bytes, entry));
  checkLayout(spans, directoryOffset);
  return spans.map((span) => ({
    name: span.label,
    data: inflate(bytes, span),
  }));
}
