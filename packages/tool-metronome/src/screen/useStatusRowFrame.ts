import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { statusRowHeight } from '../logic/belowTempo.ts';

export function useStatusRowFrame(): { readonly height: number } {
  const { fontScale } = useWindowDimensions();
  return useMemo(() => ({ height: statusRowHeight(fontScale) }), [fontScale]);
}
