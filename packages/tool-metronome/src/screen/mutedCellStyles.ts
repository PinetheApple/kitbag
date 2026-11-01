import { StyleSheet, type ViewStyle } from 'react-native';

// Android does not anchor dashes at the corners, so narrow cells lose their ends
// and a run of muted cells reads as one dashed bar. Solid ends keep each closed.
export function mutedCellStyles(stroke: number, radius: number, color: string) {
  return {
    mutedOutline: {
      ...StyleSheet.absoluteFill,
      borderRadius: radius,
      borderWidth: stroke,
      borderStyle: 'dashed',
      borderColor: color,
    },
    mutedEnds: {
      ...StyleSheet.absoluteFill,
      borderRadius: radius,
      borderLeftWidth: stroke,
      borderRightWidth: stroke,
      borderColor: color,
    },
  } as const satisfies Record<string, ViewStyle>;
}
