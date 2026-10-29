import {
  createThemedStyles,
  Icon,
  type IconName,
  metronomeSheet,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

export const usePracticeStyles = createThemedStyles((theme) => ({
  section: {
    gap: space.controlGap,
    paddingVertical: metronomeSheet.practiceSectionV,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  last: {
    borderBottomWidth: 0,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
  },
  title: {
    ...textStyle(textRoles.practiceHeading),
    color: theme.color.text,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.controlGap,
  },
  label: {
    ...textStyle(textRoles.practiceRow),
    color: theme.color.text2,
  },
  grow: {
    flexGrow: 1,
  },
  headingFill: {
    flex: 1,
    marginLeft: space.controlGap,
  },
}));

interface PracticeSectionProps {
  readonly icon: IconName;
  readonly title: string;
  readonly heading?: ReactNode;
  readonly last?: boolean;
  readonly children?: ReactNode;
}

export function PracticeSection({
  icon,
  title,
  heading,
  last = false,
  children,
}: PracticeSectionProps) {
  const styles = usePracticeStyles();
  return (
    <View style={[styles.section, last && styles.last]}>
      <View style={styles.heading}>
        <Icon name={icon} size="practiceHeading" color="text2" />
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {heading}
      </View>
      {children}
    </View>
  );
}
