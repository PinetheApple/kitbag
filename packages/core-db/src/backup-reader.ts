import { reject } from './backup-format';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_CHARS_PER_BLOCK = 4;
const BYTES_PER_BLOCK = 3;

type Check<T> = (value: unknown) => value is T;

const isString: Check<string> = (value) => typeof value === 'string';
const isNumber: Check<number> = (value): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isCount: Check<number> = (value): value is number =>
  isNumber(value) && Number.isSafeInteger(value) && value >= 0;
const isBoolean: Check<boolean> = (value) => typeof value === 'boolean';
const isUuid: Check<string> = (value): value is string =>
  isString(value) && UUID_PATTERN.test(value);
const lowercase = (value: string) => value.toLowerCase();
const nullableLowercase = (value: string | null) =>
  value?.toLowerCase() ?? null;
const isBase64: Check<string> = (value): value is string =>
  isString(value) && BASE64_PATTERN.test(value);

export const encodeBase64 = (bytes: Uint8Array) =>
  Buffer.from(bytes).toString('base64');
export const decodeBase64 = (encoded: string) => Buffer.from(encoded, 'base64');
export const nullableBytes = (encoded: string | null) =>
  encoded === null ? null : decodeBase64(encoded);

export function invalidField(path: string, reason: string): never {
  return reject({ kind: 'invalidField', path, reason });
}

export function base64Length(encoded: string): number {
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return (encoded.length / BASE64_CHARS_PER_BLOCK) * BYTES_PER_BLOCK - padding;
}

export function asObject(value: unknown, path: string) {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    invalidField(path, 'expected an object');
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalidField(path, 'expected an array');
  return value;
}

function fieldReader(value: unknown, path: string) {
  const object = asObject(value, path);
  const get = <T>(key: string, check: Check<T>, reason: string): T => {
    const field = object[key];
    if (!check(field)) invalidField(`${path}.${key}`, reason);
    return field;
  };
  const nullable = <T>(key: string, check: Check<T>, reason: string) =>
    object[key] === null ? null : get(key, check, reason);
  return { object, get, nullable };
}

export function reader(value: unknown, path: string) {
  const { object, get, nullable } = fieldReader(value, path);
  return {
    array: (key: string) => asArray(object[key], `${path}.${key}`),
    string: (key: string) => get(key, isString, 'expected a string'),
    number: (key: string) => get(key, isNumber, 'expected a finite number'),
    count: (key: string) => get(key, isCount, 'expected a whole number ≥ 0'),
    boolean: (key: string) => get(key, isBoolean, 'expected a boolean'),
    uuid: (key: string) => lowercase(get(key, isUuid, 'expected a UUID')),
    blob: (key: string) => get(key, isBase64, 'expected base64 bytes'),
    nullableString: (key: string) =>
      nullable(key, isString, 'expected a string or null'),
    nullableNumber: (key: string) =>
      nullable(key, isNumber, 'expected a finite number or null'),
    nullableCount: (key: string) =>
      nullable(key, isCount, 'expected a whole number ≥ 0 or null'),
    nullableUuid: (key: string) =>
      nullableLowercase(nullable(key, isUuid, 'expected a UUID or null')),
    nullableBlob: (key: string) =>
      nullable(key, isBase64, 'expected base64 bytes or null'),
  };
}

export type Reader = ReturnType<typeof reader>;
