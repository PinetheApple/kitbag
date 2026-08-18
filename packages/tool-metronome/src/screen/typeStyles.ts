// One adaptation of §12.2's type tokens to RN's TextStyle, shared by the
// readouts that use it. core-design cannot own this: it has no react-native
// dependency, and the cast is RN's type union, not a design value.

import { typography } from '@kitbag/core-design';
import type { TextStyle } from 'react-native';

/** §12.2 stores weights as numbers; RN's TextStyle wants its own union. */
export const DISPLAY_WEIGHT = String(
  typography.display.weight,
) as TextStyle['fontWeight'];
