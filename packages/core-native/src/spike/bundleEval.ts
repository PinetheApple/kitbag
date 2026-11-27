export const BUNDLE_EVAL_KEY = '__kitbagEvalBundle';
export const HBC_VERSION_KEY = '__kitbagHbcFileVersion';

type LocationFn = (location: string) => unknown;

type SpikeGlobal = Partial<
  Record<typeof BUNDLE_EVAL_KEY | typeof HBC_VERSION_KEY, LocationFn>
>;

function installed(key: keyof SpikeGlobal): LocationFn {
  const fn = (globalThis as SpikeGlobal)[key];
  if (fn === undefined) throw new Error(`${key} is not installed`);
  return fn;
}

export function evaluateBundle(location: string): void {
  installed(BUNDLE_EVAL_KEY)(location);
}

export function hbcFileVersion(location: string): number {
  return Number(installed(HBC_VERSION_KEY)(location));
}
