import type { BarMark } from './stem-bundle-repository';

const BYTES_PER_VALUE = 4;
const BAR_MARK_FIELDS = 2;

function pack(
  values: readonly number[],
  write: (view: DataView, offset: number, value: number) => void,
): Uint8Array {
  const bytes = new Uint8Array(values.length * BYTES_PER_VALUE);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => {
    write(view, i * BYTES_PER_VALUE, value);
  });
  return bytes;
}

function unpack(
  bytes: Uint8Array,
  read: (view: DataView, offset: number) => number,
): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = Math.floor(bytes.byteLength / BYTES_PER_VALUE);
  return Array.from({ length: count }, (_, i) =>
    read(view, i * BYTES_PER_VALUE),
  );
}

export const packFloat32 = (values: readonly number[]) =>
  pack(values, (view, offset, value) => {
    view.setFloat32(offset, value, true);
  });

export const packInt32 = (values: readonly number[]) =>
  pack(values, (view, offset, value) => {
    view.setInt32(offset, value, true);
  });

export const unpackFloat32 = (bytes: Uint8Array) =>
  unpack(bytes, (view, offset) => view.getFloat32(offset, true));

export const unpackInt32 = (bytes: Uint8Array) =>
  unpack(bytes, (view, offset) => view.getInt32(offset, true));

export function packBars(bars: readonly BarMark[]): Uint8Array {
  return packInt32(bars.flatMap((bar) => [bar.beat, bar.beatsPerBar]));
}

export function unpackBars(bytes: Uint8Array): BarMark[] {
  const values = unpackInt32(bytes);
  const bars: BarMark[] = [];
  for (let i = 0; i + 1 < values.length; i += BAR_MARK_FIELDS)
    bars.push({ beat: values[i] ?? 0, beatsPerBar: values[i + 1] ?? 0 });
  return bars;
}
