const BYTE_CHUNK = 0x2000;

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += BYTE_CHUNK)
    binary += String.fromCharCode(...bytes.subarray(start, start + BYTE_CHUNK));
  return btoa(binary);
}

export function decodeBase64(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export const nullableBytes = (encoded: string | null) =>
  encoded === null ? null : decodeBase64(encoded);

export const nullableBase64 = (bytes: Uint8Array | null) =>
  bytes === null ? null : encodeBase64(bytes);

interface PresetBlobs<T> {
  accents: T;
  perAccentSounds: T | null;
  polyAccents: T | null;
}

export const presetBytes = (record: PresetBlobs<string>) => ({
  accents: decodeBase64(record.accents),
  perAccentSounds: nullableBytes(record.perAccentSounds),
  polyAccents: nullableBytes(record.polyAccents),
});

export const presetBase64 = (row: PresetBlobs<Uint8Array>) => ({
  accents: encodeBase64(row.accents),
  perAccentSounds: nullableBase64(row.perAccentSounds),
  polyAccents: nullableBase64(row.polyAccents),
});
