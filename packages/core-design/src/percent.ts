const PERCENT = 100;

export type Percent = `${number}%`;

export function asPercent(fraction: number): Percent {
  return `${String(fraction * PERCENT)}%` as Percent;
}
