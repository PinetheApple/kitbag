import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
}

export class ZipError extends Error {}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;
const ZIP_VERSION = 20;
const UTF8_NAMES = 0x0800;
const ENCRYPTED = 0x0001;
const STORED = 0;
const DEFLATED = 8;
const DOS_MIDNIGHT = 0;
// (1980 - 1980) << 9 | 1 << 5 | 1: the earliest DOS date, so builds are reproducible.
const DOS_1980_01_01 = 0x21;
const U16 = 2;
const U32 = 4;
const END_OF_DIRECTORY_SIZE = 22;
const MAX_COMMENT = 0xffff;
const LOCAL_FIELDS_BEFORE_NAME = U16 + U16 + U16 + U16 + U16 + U32 + U32 + U32;

class Writer {
  private readonly parts: Buffer[] = [];
  length = 0;

  u16(value: number): this {
    const part = Buffer.alloc(U16);
    part.writeUInt16LE(value);
    return this.bytes(part);
  }

  u32(value: number): this {
    const part = Buffer.alloc(U32);
    part.writeUInt32LE(value);
    return this.bytes(part);
  }

  bytes(part: Buffer): this {
    this.parts.push(part);
    this.length += part.length;
    return this;
  }

  done(): Buffer {
    return Buffer.concat(this.parts);
  }
}

class Reader {
  private readonly source: Buffer;
  private at: number;

  constructor(source: Buffer, at: number) {
    this.source = source;
    this.at = at;
  }

  u16(): number {
    return this.bytes(U16).readUInt16LE();
  }

  u32(): number {
    return this.bytes(U32).readUInt32LE();
  }

  skip(length: number): void {
    this.bytes(length);
  }

  bytes(length: number): Buffer {
    if (this.at < 0 || this.at + length > this.source.length) {
      throw new ZipError('truncated zip');
    }
    const part = this.source.subarray(this.at, this.at + length);
    this.at += length;
    return part;
  }
}

interface FileFields {
  readonly name: Buffer;
  readonly crc: number;
  readonly packedSize: number;
  readonly size: number;
}

function writeFileFields(writer: Writer, fields: FileFields): void {
  writer
    .u16(ZIP_VERSION)
    .u16(UTF8_NAMES)
    .u16(DEFLATED)
    .u16(DOS_MIDNIGHT)
    .u16(DOS_1980_01_01)
    .u32(fields.crc)
    .u32(fields.packedSize)
    .u32(fields.size)
    .u16(fields.name.length)
    .u16(0);
}

export function writeZip(entries: readonly ZipEntry[]): Buffer {
  const body = new Writer();
  const directory = new Writer();
  for (const entry of entries) {
    const packed = deflateRawSync(entry.data);
    const fields = {
      name: Buffer.from(entry.name, 'utf8'),
      crc: crc32(entry.data),
      packedSize: packed.length,
      size: entry.data.length,
    };
    const offset = body.length;
    writeFileFields(body.u32(LOCAL_HEADER), fields);
    body.bytes(fields.name).bytes(packed);
    writeFileFields(directory.u32(CENTRAL_HEADER).u16(ZIP_VERSION), fields);
    directory.u16(0).u16(0).u16(0).u32(0).u32(offset).bytes(fields.name);
  }
  const end = new Writer()
    .u32(END_OF_DIRECTORY)
    .u16(0)
    .u16(0)
    .u16(entries.length)
    .u16(entries.length)
    .u32(directory.length)
    .u32(body.length)
    .u16(0);
  return Buffer.concat([body.done(), directory.done(), end.done()]);
}

function findEndOfDirectory(bytes: Buffer): number {
  const last = bytes.length - END_OF_DIRECTORY_SIZE;
  for (let at = last; at >= 0 && at >= last - MAX_COMMENT; at--) {
    if (bytes.readUInt32LE(at) === END_OF_DIRECTORY) return at;
  }
  throw new ZipError('no end of central directory');
}

function inflate(
  name: string,
  method: number,
  packed: Buffer,
  size: number,
): Buffer {
  if (method === STORED) return Buffer.from(packed);
  if (method !== DEFLATED)
    throw new ZipError(`${name}: unsupported compression ${String(method)}`);
  try {
    return inflateRawSync(packed, { maxOutputLength: Math.max(size, 1) });
  } catch {
    throw new ZipError(
      `${name}: inflates past its declared size or is corrupt`,
    );
  }
}

function readEntry(bytes: Buffer, directory: Reader): ZipEntry {
  if (directory.u32() !== CENTRAL_HEADER)
    throw new ZipError('bad central directory entry');
  directory.skip(U16 + U16);
  const flags = directory.u16();
  const method = directory.u16();
  directory.skip(U16 + U16);
  const crc = directory.u32();
  const packedSize = directory.u32();
  const size = directory.u32();
  const nameLength = directory.u16();
  const skipped = directory.u16() + directory.u16();
  directory.skip(U16 + U16 + U32);
  const local = new Reader(bytes, directory.u32());
  const name = directory.bytes(nameLength).toString('utf8');
  directory.skip(skipped);
  if (flags & ENCRYPTED) throw new ZipError(`${name}: encrypted`);
  if (local.u32() !== LOCAL_HEADER)
    throw new ZipError(`${name}: bad local header`);
  local.skip(LOCAL_FIELDS_BEFORE_NAME);
  local.skip(local.u16() + local.u16());
  const data = inflate(name, method, local.bytes(packedSize), size);
  if (data.length !== size || crc32(data) !== crc) {
    throw new ZipError(`${name}: size or CRC does not match its header`);
  }
  return { name, data };
}

export function readZip(bytes: Buffer): ZipEntry[] {
  const end = new Reader(bytes, findEndOfDirectory(bytes) + U32);
  end.skip(U16 + U16 + U16);
  const count = end.u16();
  end.skip(U32);
  const directory = new Reader(bytes, end.u32());
  return Array.from({ length: count }, () => readEntry(bytes, directory));
}
