import { useCallback, useMemo, useState } from 'react';
import {
  useWindowDimensions,
  type LayoutChangeEvent,
  type TextStyle,
} from 'react-native';

import {
  fitOneLine,
  oneLineFloor,
  oneLineMeasure,
  type OneLineFit,
} from './oneLineFit.ts';

interface TextMeasure {
  readonly text: string;
  readonly width: number;
}

export interface OneLineFitLayout {
  readonly fit: OneLineFit | undefined;
  readonly style: TextStyle;
  readonly onAvailableLayout: (event: LayoutChangeEvent) => void;
  readonly onTextLayout: (event: LayoutChangeEvent) => void;
}

export function useOneLineFit(
  text: string,
  size: number,
  minSize: number,
): OneLineFitLayout {
  const { fontScale } = useWindowDimensions();
  const [available, setAvailable] = useState<number>();
  const [measure, setMeasure] = useState<TextMeasure>();
  const onAvailableLayout = useCallback((event: LayoutChangeEvent) => {
    setAvailable(event.nativeEvent.layout.width);
  }, []);
  const onTextLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setMeasure({ text, width: event.nativeEvent.layout.width });
    },
    [text],
  );
  const fit =
    available === undefined || measure?.text !== text
      ? undefined
      : fitOneLine({
          available,
          textWidth: measure.width,
          size,
          floor: oneLineFloor(fontScale, size, minSize),
        });
  const fontSize = fit?.fontSize;
  const style = useMemo<TextStyle>(
    () => (fontSize === undefined ? oneLineMeasure.hidden : { fontSize }),
    [fontSize],
  );
  return { fit, style, onAvailableLayout, onTextLayout };
}
