import { useWindowDimensions } from 'react-native';

import { isTextScaled } from './textScale.ts';

export function useTextScaled(): boolean {
  return isTextScaled(useWindowDimensions().fontScale);
}
