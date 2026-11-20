import { STEM_SET_PITCH } from '@kitbag/core-db/src/stem-speed-key';

export { UNITY_GAIN } from '@kitbag/core-db/src/units';

export const UNSHIFTED_KEY = STEM_SET_PITCH.unshifted;

export function soloAfter(
  soloed: readonly boolean[],
  index: number,
  additive: boolean,
): boolean[] {
  if (additive) return soloed.map((on, i) => (i === index ? !on : on));
  const alone = soloed.every((on, i) => on === (i === index));
  return soloed.map((_, i) => !alone && i === index);
}
