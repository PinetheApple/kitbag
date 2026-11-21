const noGesture = (): Record<string, never> => ({});

export const usePanGesture = noGesture;
export const useTapGesture = noGesture;
export const useCompetingGestures = noGesture;
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
export const Canvas = 'Canvas';
export const Group = 'Group';
export const RoundedRect = 'RoundedRect';
