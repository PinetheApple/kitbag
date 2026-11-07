const chain: Record<string, unknown> = new Proxy(
  {},
  { get: () => () => chain },
);

export const Gesture = new Proxy({}, { get: () => () => chain });
export const GestureDetector = 'GestureDetector';
export const GestureHandlerRootView = 'GestureHandlerRootView';

export function useReanimatedKeyboardAnimation() {
  return { height: { value: 0 }, progress: { value: 0 } };
}

export const KeyboardStickyView = 'KeyboardStickyView';

export default 'Svg';
export const Svg = 'Svg';
export const Path = 'Path';
export const Circle = 'Circle';
export const Rect = 'Rect';
export const Defs = 'Defs';
export const LinearGradient = 'LinearGradient';
export const Stop = 'Stop';
export const G = 'G';
export const Line = 'Line';
export const Text = 'SvgText';
