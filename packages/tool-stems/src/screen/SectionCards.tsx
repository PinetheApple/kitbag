import {
  asPercent,
  createThemedStyles,
  Icon,
  oneLineFloor,
  radius,
  size,
  space,
  stemSections,
  stemSectionsMix,
  stemSectionsText,
  textStyle,
  useOneLineFit,
  useReduceMotion,
  useTheme,
  withAlpha,
} from '@kitbag/core-design';
import {
  formatClockSeconds,
  NO_SECTION,
  sectionAt,
  useStemPlayer,
} from '@kitbag/core-state';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  isSectionLoop,
  sectionCardWidth,
  sectionProgress,
  sectionRange,
  songSeconds,
  type StemSection,
} from '../logic/sectionView.ts';

const screenInset = space.screenInset;

const useStyles = createThemedStyles((theme) => ({
  scroller: { flexGrow: 0, flexShrink: 0, marginHorizontal: -screenInset },
  content: { gap: stemSections.cardGap, paddingHorizontal: screenInset },
  card: {
    minHeight: stemSections.cardMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: stemSections.cardRadius,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
    overflow: 'hidden',
  },
  cardCurrent: {
    backgroundColor: theme.accentTextFill,
    borderColor: theme.accentTextFill,
  },
  text: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingLeft: stemSections.cardLeft,
  },
  name: {
    ...textStyle(stemSectionsText.name),
    color: theme.color.text,
  },
  range: {
    ...textStyle(stemSectionsText.range),
    color: theme.color.text2,
  },
  onFill: { color: theme.color.onAccent },
  loopKey: {
    width: stemSections.loopKey,
    height: stemSections.loopKey,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loopOn: {
    backgroundColor: withAlpha(
      theme.color.accent,
      stemSectionsMix.loopKeyOnIdle,
    ),
  },
  loopOnCurrent: {
    backgroundColor: withAlpha(theme.color.onAccent, stemSectionsMix.loopKeyOn),
  },
  progress: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: stemSections.progressHeight,
    backgroundColor: theme.color.onAccent,
  },
}));

function CardProgress({
  section,
  songSec,
}: {
  readonly section: StemSection;
  readonly songSec: SharedValue<number>;
}) {
  const styles = useStyles();
  const width = useAnimatedStyle(
    () => ({ width: asPercent(sectionProgress(songSec.value, section)) }),
    [section, songSec],
  );
  return (
    <Animated.View pointerEvents="none" style={[styles.progress, width]} />
  );
}

function CardName({
  name,
  current,
}: {
  readonly name: string;
  readonly current: boolean;
}) {
  const styles = useStyles();
  const { fontScale } = useWindowDimensions();
  const role = stemSectionsText.name;
  const nameStyle = [styles.name, current && styles.onFill];
  const fit = useOneLineFit({
    text: name,
    role,
    floor: oneLineFloor(fontScale, role.size, stemSections.nameMinSize),
    style: nameStyle,
  });
  return (
    <View onLayout={fit.onAvailableLayout}>
      {fit.measurer}
      <Text
        style={[nameStyle, fit.style]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {name}
      </Text>
    </View>
  );
}

interface SectionCardProps {
  readonly index: number;
  readonly section: StemSection;
  readonly current: boolean;
  readonly looped: boolean;
  readonly width: number;
  readonly songSec: SharedValue<number>;
}

const SectionCard = memo(function SectionCard({
  index,
  section,
  current,
  looped,
  width,
  songSec,
}: SectionCardProps) {
  const styles = useStyles();
  const theme = useTheme();
  const jumpToSection = useStemPlayer((s) => s.jumpToSection);
  const loopSection = useStemPlayer((s) => s.loopSection);
  const markLoop = useStemPlayer((s) => s.markLoop);
  const jump = useCallback(() => {
    void jumpToSection(index);
  }, [jumpToSection, index]);
  const hold = useCallback(() => {
    void (looped ? jumpToSection(index) : loopSection(index));
  }, [looped, jumpToSection, loopSection, index]);
  const toggleLoop = useCallback(() => {
    void (looped ? markLoop() : loopSection(index));
  }, [looped, markLoop, loopSection, index]);
  const idleColor = looped ? theme.accentInk : 'text2';
  const keyColor = current ? 'onAccent' : idleColor;
  const spoken = `${section.name}, ${formatClockSeconds(section.startSec)} to ${formatClockSeconds(section.endSec)}`;
  return (
    <View style={[styles.card, current && styles.cardCurrent, { width }]}>
      <Pressable
        testID={`section-card-${String(index)}`}
        accessibilityRole="button"
        accessibilityLabel={`Jump to ${spoken}`}
        accessibilityHint="Hold to loop this section"
        accessibilityState={{ selected: current }}
        style={styles.text}
        onPress={jump}
        onLongPress={hold}
      >
        <CardName name={section.name} current={current} />
        <Text
          style={[styles.range, current && styles.onFill]}
          numberOfLines={1}
        >
          {sectionRange(section)}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${looped ? 'Stop looping' : 'Loop'} ${spoken}`}
        accessibilityState={{ selected: looped }}
        style={[
          styles.loopKey,
          looped && (current ? styles.loopOnCurrent : styles.loopOn),
        ]}
        onPress={toggleLoop}
      >
        <Icon name="repeat" size="sectionLoop" color={keyColor} />
      </Pressable>
      {current ? <CardProgress section={section} songSec={songSec} /> : null}
    </View>
  );
});

// Crossing into another section is the only thing that reaches JS (SPEC §13.3).
function useCurrentSection(
  songSec: SharedValue<number>,
  sections: readonly StemSection[],
): number {
  const [current, setCurrent] = useState(NO_SECTION);
  useAnimatedReaction(
    () => sectionAt(sections, songSec.value),
    (now, before) => {
      if (now !== before) scheduleOnRN(setCurrent, now);
    },
    [sections, songSec],
  );
  return current;
}

export function SectionCards({
  songSec,
}: {
  readonly songSec: SharedValue<number>;
}) {
  const styles = useStyles();
  const sections = useStemPlayer((s) => s.sections);
  const loop = useStemPlayer((s) => s.loop);
  const durationSec = useStemPlayer(songSeconds);
  const { fontScale } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const current = useCurrentSection(songSec, sections);
  const width = sectionCardWidth(fontScale);
  const list = useRef<ScrollView>(null);
  const [viewport, setViewport] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setViewport(event.nativeEvent.layout.width);
  }, []);
  useEffect(() => {
    if (current === NO_SECTION || viewport === 0) return;
    const left = screenInset + current * (width + stemSections.cardGap);
    list.current?.scrollTo({
      x: Math.max(0, left - (viewport - width) / 2),
      animated: !reduceMotion,
    });
  }, [current, viewport, width, reduceMotion]);
  return (
    <ScrollView
      ref={list}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.content}
      onLayout={onLayout}
    >
      {sections.map((section, index) => (
        <SectionCard
          key={`${String(section.startSec)}-${String(index)}`}
          index={index}
          section={section}
          current={index === current}
          looped={isSectionLoop(loop, section, durationSec)}
          width={width}
          songSec={songSec}
        />
      ))}
    </ScrollView>
  );
}
