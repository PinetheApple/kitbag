import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export const PLAYER_SCROLL_ID = 'player-scroll';

export interface PlayerScrollState {
  readonly scrollEnabled: boolean;
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly onContentSizeChange: (width: number, height: number) => void;
}

export function usePlayerScroll(): PlayerScrollState {
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setViewport(event.nativeEvent.layout.height);
  }, []);
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    setContent(height);
  }, []);
  return {
    scrollEnabled: Math.round(content) > Math.round(viewport),
    onLayout,
    onContentSizeChange,
  };
}
