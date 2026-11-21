import { Platform } from 'react-native';

import { withAlpha } from '../theme.ts';

const CLEAR = 0;

export type FadeDirection = 'to top' | 'to bottom';

// Web drops experimental_backgroundImage, so it gets a solid band instead.
export function fadeToClear(color: string, direction: FadeDirection) {
  return Platform.OS === 'web'
    ? { backgroundColor: color }
    : {
        experimental_backgroundImage: `linear-gradient(${direction}, ${color}, ${withAlpha(color, CLEAR)})`,
      };
}
