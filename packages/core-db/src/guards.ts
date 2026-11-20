export type Check<T> = (value: unknown) => value is T;

export const isString: Check<string> = (value) => typeof value === 'string';
export const isNumber: Check<number> = (value): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export const isBoolean: Check<boolean> = (value) => typeof value === 'boolean';
export const isRecord: Check<Record<string, unknown>> = (
  value,
): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
