export const BUNDLE_EVAL_KEY = '__kitbagEvalBundle';

type EvalBundle = (bytes: ArrayBuffer, sourceUrl: string) => unknown;

interface EvalGlobal {
  [BUNDLE_EVAL_KEY]?: EvalBundle;
}

export function evaluateBundleBytes(
  bytes: ArrayBuffer,
  sourceUrl: string,
): void {
  const evalBundle = (globalThis as EvalGlobal)[BUNDLE_EVAL_KEY];
  if (evalBundle === undefined) {
    throw new Error(`${BUNDLE_EVAL_KEY} is not installed`);
  }
  evalBundle(bytes, sourceUrl);
}
