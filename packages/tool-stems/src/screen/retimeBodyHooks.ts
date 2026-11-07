import { useStemPlayer, type RetimeState } from '@kitbag/core-state';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LayoutChangeEvent,
  ScrollView,
  TextLayoutEvent,
} from 'react-native';

import { overflows, pinnedLinesFit } from '../logic/retimeLayout.ts';

type Recording = Extract<RetimeState, { readonly kind: 'recording' }>;
type RetimeLayoutMode = 'drawn' | 'pinned' | 'scrolling';

// One way only, so a layout can never flip back between lines.
export function useRetimeLayout() {
  const [mode, setMode] = useState<RetimeLayoutMode>('drawn');
  const heights = useRef({
    viewport: 0,
    content: 0,
    body: 0,
    controls: 0,
    currentLine: 0,
  });
  const checkOverflow = useCallback(() => {
    const { viewport, content } = heights.current;
    if (overflows(viewport, content)) setMode('pinned');
  }, []);
  const checkPin = useCallback(() => {
    const { body, controls, currentLine } = heights.current;
    if (!pinnedLinesFit(body, controls, currentLine)) setMode('scrolling');
  }, []);
  const onViewport = useCallback(
    (event: LayoutChangeEvent) => {
      heights.current.viewport = event.nativeEvent.layout.height;
      checkOverflow();
    },
    [checkOverflow],
  );
  const onContent = useCallback(
    (_: number, height: number) => {
      heights.current.content = height;
      checkOverflow();
    },
    [checkOverflow],
  );
  const onPinnedBody = useCallback(
    (event: LayoutChangeEvent) => {
      heights.current.body = event.nativeEvent.layout.height;
      checkPin();
    },
    [checkPin],
  );
  const onControls = useCallback(
    (event: LayoutChangeEvent) => {
      heights.current.controls = event.nativeEvent.layout.height;
      checkPin();
    },
    [checkPin],
  );
  // Measured because Android 14+ scales large text non-linearly: 26 sp at 2.0
  // renders about 40 dp per line, where size x fontScale says 65.
  const onCurrentLine = useCallback(
    (event: TextLayoutEvent) => {
      heights.current.currentLine = event.nativeEvent.lines[0]?.height ?? 0;
      checkPin();
    },
    [checkPin],
  );
  return {
    mode,
    onViewport,
    onContent,
    onPinnedBody,
    onControls,
    onCurrentLine,
  };
}

export function useRetimeScroll(retime: Recording, followsLine: boolean) {
  const failure = useStemPlayer((s) => s.retimeFailure);
  const list = useRef<ScrollView>(null);
  const tops = useRef({ lines: 0, row: 0 });
  const holdingCard = useRef(false);
  const scrollToLineToTap = useCallback(() => {
    if (!followsLine || holdingCard.current) return;
    list.current?.scrollTo({
      y: tops.current.lines + tops.current.row,
      animated: false,
    });
  }, [followsLine]);
  const onLinesLayout = useCallback(
    (event: LayoutChangeEvent) => {
      tops.current.lines = event.nativeEvent.layout.y;
      scrollToLineToTap();
    },
    [scrollToLineToTap],
  );
  const onCurrentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      tops.current.row = event.nativeEvent.layout.y;
      scrollToLineToTap();
    },
    [scrollToLineToTap],
  );
  useEffect(() => {
    holdingCard.current = false;
    scrollToLineToTap();
  }, [retime.nextLine, scrollToLineToTap]);
  // After the effect above, so a card that arrives with a tap still wins.
  useEffect(() => {
    holdingCard.current = failure !== null;
    if (failure === null) scrollToLineToTap();
    else list.current?.scrollTo({ y: 0, animated: false });
  }, [failure, scrollToLineToTap]);
  return { list, onLinesLayout, onCurrentLayout };
}
