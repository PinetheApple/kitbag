import { MINUS } from '../text.ts';

export function formatOffsetMs(offsetMs: number): string {
  if (offsetMs === 0) return '0 ms';
  const sign = offsetMs > 0 ? '+' : MINUS;
  return `${sign}${String(Math.abs(offsetMs))} ms`;
}
