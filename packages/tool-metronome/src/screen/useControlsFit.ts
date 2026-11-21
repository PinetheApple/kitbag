import { metronome } from '@kitbag/core-design';
import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import type { ScreenDensity } from '../logic/screenDensity.ts';
import { useOverflowLatch } from './useOverflowLatch.ts';
import { useScreenDensity } from './useScreenDensity.ts';

interface MeasuredContent {
  readonly height: number;
  readonly density: ScreenDensity;
}

const UNMEASURED: MeasuredContent = { height: 0, density: 'roomy' };

export function useControlsFit(windowHeight: number, layoutKey: string) {
  const [bodyHeight, setBodyHeight] = useState(0);
  const [content, setContent] = useState<MeasuredContent>(UNMEASURED);
  const scrollable =
    bodyHeight > 0 &&
    content.height > 0 &&
    Math.round(content.height) > Math.round(bodyHeight);
  const density = useScreenDensity(windowHeight, layoutKey, scrollable);
  const tight = useOverflowLatch(
    layoutKey,
    scrollable,
    density === 'compact' && content.density === 'compact',
  );
  // The fade padding is left out so it never keeps the controls scrollable.
  const fadePadding = scrollable ? metronome.scrollFade : 0;
  const handleBodyLayout = useCallback((event: LayoutChangeEvent) => {
    setBodyHeight(event.nativeEvent.layout.height);
  }, []);
  const handleContentSize = useCallback(
    (_width: number, height: number) => {
      setContent({ height: height - fadePadding, density });
    },
    [fadePadding, density],
  );
  return {
    scrollable,
    density,
    tight,
    fadePadding,
    handleBodyLayout,
    handleContentSize,
  };
}
