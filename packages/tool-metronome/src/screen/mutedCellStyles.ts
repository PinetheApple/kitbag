import type { ViewStyle } from 'react-native';

const FILL = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const satisfies ViewStyle;

// Android does not anchor dashes at the corners, so narrow cells lose their ends
// and a run of muted cells reads as one dashed bar. Solid ends keep each closed.
export function mutedCellStyles(stroke: number, radius: number, color: string) {
  return {
    mutedOutline: {
      ...FILL,
      borderRadius: radius,
      borderWidth: stroke,
      borderStyle: 'dashed',
      borderColor: color,
    },
    mutedEnds: {
      ...FILL,
      borderRadius: radius,
      borderLeftWidth: stroke,
      borderRightWidth: stroke,
      borderColor: color,
    },
  } as const satisfies Record<string, ViewStyle>;
}
