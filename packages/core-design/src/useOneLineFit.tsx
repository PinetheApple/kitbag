import { useCallback, useMemo, useState, type ReactElement } from 'react';
import {
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import {
  fittedStyle,
  measureOneLine,
  resizeOneLine,
  startOneLine,
  type OneLineMeasurement,
  type OneLineParams,
} from './oneLineFit.ts';
import type { TypeRole } from './tokens.ts';

// Yoga sizes an absolute child of a row to its max-content width, so the
// measurer reports the unwrapped line however narrow the row is.
const measureRow = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  flexDirection: 'row',
  opacity: 0,
} as const;
const measureText = { position: 'absolute' } as const;
const unmeasured = { opacity: 0 } as const;

interface OneLineMeasurerProps {
  readonly text: string;
  readonly generation: number;
  readonly candidate: number;
  readonly style: StyleProp<TextStyle>;
  readonly onMeasure: (measurement: OneLineMeasurement) => void;
}

function OneLineMeasurer({
  text,
  generation,
  candidate,
  style,
  onMeasure,
}: OneLineMeasurerProps) {
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onMeasure({
        generation,
        candidate,
        textWidth: event.nativeEvent.layout.width,
      });
    },
    [onMeasure, generation, candidate],
  );
  return (
    <View
      style={measureRow}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[style, measureText]} onLayout={handleLayout}>
        {text}
      </Text>
    </View>
  );
}

export interface OneLineFitOptions {
  readonly text: string;
  readonly role: TypeRole;
  readonly floor: number;
  readonly style: StyleProp<TextStyle>;
}

export interface OneLineFitLayout {
  readonly style: TextStyle;
  readonly onAvailableLayout: (event: LayoutChangeEvent) => void;
  readonly measurer: ReactElement;
}

export function useOneLineFit({
  text,
  role,
  floor,
  style,
}: OneLineFitOptions): OneLineFitLayout {
  const { fontScale, scale } = useWindowDimensions();
  const params: OneLineParams = useMemo(
    () => ({ size: role.size, floor, onePx: 1 / (scale * fontScale) }),
    [role.size, floor, scale, fontScale],
  );
  const [state, setState] = useState(() => startOneLine(text, role.size));
  if (state.text !== text) setState(startOneLine(text, role.size, state));
  const onAvailableLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      setState((s) => resizeOneLine(s, width, params));
    },
    [params],
  );
  const onMeasure = useCallback(
    (measurement: OneLineMeasurement) => {
      setState((s) => measureOneLine(s, measurement, params));
    },
    [params],
  );
  const fitStyle = useMemo<TextStyle>(
    () =>
      state.shown === undefined ? unmeasured : fittedStyle(role, state.shown),
    [role, state.shown],
  );
  const measurer = (
    <OneLineMeasurer
      key={[state.generation, state.candidate].join(':')}
      text={state.text}
      generation={state.generation}
      candidate={state.candidate}
      style={[style, fittedStyle(role, state.candidate)]}
      onMeasure={onMeasure}
    />
  );
  return { style: fitStyle, onAvailableLayout, measurer };
}
