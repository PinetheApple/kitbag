import { reject } from './backup-format';
import { isBoolean, isNumber, isString, type Check } from './guards';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_CHARS_PER_BLOCK = 4;
const BYTES_PER_BLOCK = 3;

const isCount: Check<number> = (value): value is number =>
  isNumber(value) && Number.isSafeInteger(value) && value >= 0;
const isUuid: Check<string> = (value): value is string =>
  isString(value) && UUID_PATTERN.test(value);
const lowercase = (value: string) => value.toLowerCase();
const nullableLowercase = (value: string | null) =>
  value?.toLowerCase() ?? null;
const isBase64: Check<string> = (value): value is string =>
  isString(value) && BASE64_PATTERN.test(value);

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
  const ifPresent = <K extends string, T>(
    key: K,
    read: (key: K) => T,
  ): Partial<Record<K, T>> =>
    object[key] === undefined ? {} : ({ [key]: read(key) } as Record<K, T>);
  return { object, get, nullable, ifPresent };
}

export function reader(value: unknown, path: string) {
  const { object, get, nullable, ifPresent } = fieldReader(value, path);
  const nullableCount = (key: string) =>
    nullable(key, isCount, 'expected a whole number ≥ 0 or null');
  const nullableNumber = (key: string) =>
    nullable(key, isNumber, 'expected a finite number or null');
  return {
    array: (key: string) => asArray(object[key], `${path}.${key}`),
    string: (key: string) => get(key, isString, 'expected a string'),
    number: (key: string) => get(key, isNumber, 'expected a finite number'),
    count: (key: string) => get(key, isCount, 'expected a whole number ≥ 0'),
    optionalCount: (key: string, fallback: number) =>
      object[key] === undefined
        ? fallback
        : get(key, isCount, 'expected a whole number ≥ 0'),
    boolean: (key: string) => get(key, isBoolean, 'expected a boolean'),
    optionalBoolean: (key: string, fallback: boolean) =>
      object[key] === undefined
        ? fallback
        : get(key, isBoolean, 'expected a boolean'),
    uuid: (key: string) => lowercase(get(key, isUuid, 'expected a UUID')),
    blob: (key: string) => get(key, isBase64, 'expected base64 bytes'),
    optionalNumber: (key: string, fallback: number) =>
      object[key] === undefined
        ? fallback
        : get(key, isNumber, 'expected a finite number'),
    nullableString: (key: string) =>
      nullable(key, isString, 'expected a string or null'),
    optionalNullableString: (key: string) =>
      object[key] === undefined
        ? null
        : nullable(key, isString, 'expected a string or null'),
    nullableNumber,
    presentNullableNumber: <K extends string>(key: K) =>
      ifPresent(key, nullableNumber),
    nullableNumberOr: (key: string, legacyKey: string) =>
      object[key] === undefined && object[legacyKey] !== undefined
        ? nullable(legacyKey, isNumber, 'expected a finite number or null')
        : nullable(key, isNumber, 'expected a finite number or null'),
    nullableCount,
    presentNullableCount: <K extends string>(key: K) =>
      ifPresent(key, nullableCount),
    nullableUuid: (key: string) =>
      nullableLowercase(nullable(key, isUuid, 'expected a UUID or null')),
    presentNullableMember: <K extends string, T>(key: K, check: Check<T>) =>
      ifPresent(key, (field) =>
        nullable(field, check, 'expected a known value or null'),
      ),
    nullableBlob: (key: string) =>
      nullable(key, isBase64, 'expected base64 bytes or null'),
  };
}

export type Reader = ReturnType<typeof reader>;
