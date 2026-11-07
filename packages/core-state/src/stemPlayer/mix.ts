export const UNITY_GAIN = 1;
export const UNSHIFTED_KEY = 0;

export function soloAfter(
  soloed: readonly boolean[],
  index: number,
  additive: boolean,
): boolean[] {
  if (additive) return soloed.map((on, i) => (i === index ? !on : on));
  const alone = soloed.every((on, i) => on === (i === index));
  return soloed.map((_, i) => !alone && i === index);
}
