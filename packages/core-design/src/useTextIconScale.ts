import { useWindowDimensions } from 'react-native';

import { textIconScale } from './textScale.ts';

export function useTextIconScale(): number {
  return textIconScale(useWindowDimensions().fontScale);
}
