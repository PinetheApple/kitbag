export function tapsLeftText(landed: number, needed: number): string {
  const left = needed - landed;
  return left === 1 ? '1 more tap' : `${String(left)} more taps`;
}
