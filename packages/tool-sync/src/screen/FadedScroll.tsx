import {
  createThemedStyles,
  fadeToClear,
  metronome,
  usePlayerScroll,
} from '@kitbag/core-design';
import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';

export const SCROLL_FADE_ID = 'play-along-scroll-fade';

const useStyles = createThemedStyles((theme) => ({
  scrollBox: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: metronome.scrollFade,
    pointerEvents: 'none',
    ...fadeToClear(theme.color.bg, 'to top'),
  },
}));

interface FadedScrollProps {
  readonly children: ReactNode;
  readonly overlay: ReactNode;
}

export function FadedScroll({ children, overlay }: FadedScrollProps) {
  const styles = useStyles();
  const scroll = usePlayerScroll();
  const ref = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (scroll.scrollEnabled) ref.current?.flashScrollIndicators();
  }, [scroll.scrollEnabled]);
  return (
    <View style={styles.scrollBox}>
      <ScrollView
        ref={ref}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={scroll.scrollEnabled}
        persistentScrollbar
        {...scroll}
      >
        {children}
      </ScrollView>
      {scroll.scrollEnabled ? (
        <View testID={SCROLL_FADE_ID} style={styles.fade} />
      ) : null}
      {overlay}
    </View>
  );
}
