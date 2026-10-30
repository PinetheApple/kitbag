const HIDDEN = 0;
const SHOWN = 1;

export function trackOpacity(shown: boolean): number {
  'worklet';
  return shown ? SHOWN : HIDDEN;
}
