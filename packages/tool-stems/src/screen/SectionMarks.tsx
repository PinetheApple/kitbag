import {
  asPercent,
  createThemedStyles,
  sliderGeometry,
  stemSections,
  stemSectionsMix,
  withAlpha,
} from '@kitbag/core-design';
import { sectionAt, useStemPlayer } from '@kitbag/core-state';
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { sectionBoundaries } from '../logic/sectionView.ts';

const sliderTrack = sliderGeometry.seek.track;

const useStyles = createThemedStyles((theme) => ({
  tint: {
    position: 'absolute',
    top: (sliderTrack - stemSections.tintHeight) / 2,
    height: stemSections.tintHeight,
    borderRadius: stemSections.tintRadius,
    backgroundColor: withAlpha(theme.color.accent, stemSectionsMix.tint),
  },
  notch: {
    position: 'absolute',
    top: (sliderTrack - stemSections.notchHeight) / 2,
    height: stemSections.notchHeight,
    width: stemSections.notchWidth,
    marginLeft: -stemSections.notchWidth / 2,
    backgroundColor: theme.color.surface1,
  },
}));

export function SectionTint({
  songSec,
  durationSec,
}: {
  readonly songSec: SharedValue<number>;
  readonly durationSec: number;
}) {
  const styles = useStyles();
  const sections = useStemPlayer((s) => s.sections);
  const current = useDerivedValue(
    () => sectionAt(sections, songSec.value),
    [sections, songSec],
  );
  const placed = useAnimatedStyle(() => {
    const section = sections[current.value];
    if (section === undefined || durationSec <= 0) return { opacity: 0 };
    const end = Math.min(section.endSec, durationSec);
    return {
      opacity: 1,
      left: asPercent(section.startSec / durationSec),
      width: asPercent((end - section.startSec) / durationSec),
    };
  }, [sections, durationSec, current]);
  if (sections.length === 0) return null;
  return <Animated.View pointerEvents="none" style={[styles.tint, placed]} />;
}

export function SectionNotches({
  durationSec,
}: {
  readonly durationSec: number;
}) {
  const styles = useStyles();
  const sections = useStemPlayer((s) => s.sections);
  const notches = useMemo(
    () => sectionBoundaries(sections, durationSec),
    [sections, durationSec],
  );
  return (
    <>
      {notches.map((at) => (
        <View
          key={at}
          pointerEvents="none"
          style={[styles.notch, { left: asPercent(at) }]}
        />
      ))}
    </>
  );
}
