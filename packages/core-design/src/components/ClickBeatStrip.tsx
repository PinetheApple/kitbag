import { Fragment } from 'react';
import { Text, View } from 'react-native';

import { metronome } from '../metronomeRoles.ts';
import { radius, size, space, textRoles } from '../roles.ts';
import { DASHED, TRANSPARENT } from '../styleConstants.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export type ClickBeatLevel = 'bar' | 'group' | 'click' | 'silent';

export const clickBeatCopy = {
  bar: 'bar accent',
  group: 'group accent',
  click: 'click',
  silent: 'silent',
  halfBeat: 'half-beat click',
} as const;

// The mockup's CSS dot is 32% of the ring's farthest-corner radius, which
// draws at 45% of the ring's inside width.
const CENTRE_DOT_SHARE = 0.45;

const ledInside = size.ledMain - size.ledMainBorder * 2;
const swatchInside = metronome.legendSwatch - metronome.legendAccentBorder * 2;

const useStyles = createThemedStyles((theme) => {
  const centreDot = (inside: number) => ({
    width: inside * CENTRE_DOT_SHARE,
    height: inside * CENTRE_DOT_SHARE,
    borderRadius: radius.circle,
    backgroundColor: theme.color.accent,
  });
  const ring = {
    backgroundColor: TRANSPARENT,
    borderColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;
  const plain = {
    backgroundColor: theme.color.surface2,
    borderColor: theme.color.line,
  };
  const silent = {
    backgroundColor: TRANSPARENT,
    borderColor: theme.color.decor,
    borderStyle: DASHED,
  } as const;
  return {
    strip: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: space.ledGroupGap,
    },
    halfStrip: { gap: space.ledHalfBeatGroupGap },
    beatGroup: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.ledGap,
    },
    halfGroup: { gap: space.chipGap },
    beat: {
      width: size.ledMain,
      alignItems: 'center',
      gap: metronome.beatMarkerGap,
    },
    number: {
      ...textStyle(textRoles.beatMarker),
      lineHeight: metronome.beatMarkerLineHeight,
      color: theme.color.text2,
    },
    led: {
      width: size.ledMain,
      height: size.ledMain,
      borderRadius: radius.circle,
      borderWidth: size.ledMainBorder,
    },
    ring,
    plain,
    silent,
    centreDot: centreDot(ledInside),
    halfBeatDot: {
      ...plain,
      width: size.ledTiny,
      height: size.ledTiny,
      borderRadius: radius.circle,
      borderWidth: size.ledTinyBorder,
    },
    halfBeatPlace: { marginTop: (size.ledMain - size.ledTiny) / 2 },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      columnGap: metronome.legendGap,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.chipGap,
    },
    legendLabel: {
      ...textStyle(textRoles.legend),
      lineHeight: metronome.legendRow,
      color: theme.color.text2,
    },
    swatch: {
      width: metronome.legendSwatch,
      height: metronome.legendSwatch,
      borderRadius: radius.circle,
      borderWidth: metronome.legendSwatchBorder,
    },
    swatchRing: { ...ring, borderWidth: metronome.legendAccentBorder },
    swatchDot: centreDot(swatchInside),
  };
});

type Styles = ReturnType<typeof useStyles>;

function lookOf(styles: Styles, level: ClickBeatLevel) {
  if (level === 'click') return styles.plain;
  if (level === 'silent') return styles.silent;
  return styles.ring;
}

function Led({ level, styles }: { level: ClickBeatLevel; styles: Styles }) {
  return (
    <View style={[styles.led, lookOf(styles, level)]}>
      {level === 'bar' ? <View style={styles.centreDot} /> : null}
    </View>
  );
}

export function clickBeatLabel(
  groups: readonly (readonly ClickBeatLevel[])[],
  halfBeats: boolean,
): string {
  const beats = groups
    .flat()
    .map((level, i) => `${String(i + 1)} ${clickBeatCopy[level]}`);
  const tail = halfBeats
    ? `, each followed by a ${clickBeatCopy.halfBeat}`
    : '';
  return `Beats ${beats.join(', ')}${tail}`;
}

export function groupStarts(
  groups: readonly (readonly ClickBeatLevel[])[],
): number[] {
  let next = 1;
  return groups.map((group) => {
    const first = next;
    next += group.length;
    return first;
  });
}

export interface ClickBeatStripProps {
  readonly groups: readonly (readonly ClickBeatLevel[])[];
  readonly halfBeats: boolean;
}

export function ClickBeatStrip({ groups, halfBeats }: ClickBeatStripProps) {
  const styles = useStyles();
  const firstBeats = groupStarts(groups);
  return (
    <View
      accessible
      accessibilityLabel={clickBeatLabel(groups, halfBeats)}
      style={[styles.strip, halfBeats && styles.halfStrip]}
    >
      {groups.map((group, g) => (
        <View key={g} style={[styles.beatGroup, halfBeats && styles.halfGroup]}>
          {group.map((level, i) => (
            <Fragment key={i}>
              <View style={styles.beat}>
                <Led level={level} styles={styles} />
                <Text style={styles.number}>
                  {String((firstBeats[g] ?? 1) + i)}
                </Text>
              </View>
              {halfBeats ? (
                <View style={[styles.halfBeatDot, styles.halfBeatPlace]} />
              ) : null}
            </Fragment>
          ))}
        </View>
      ))}
    </View>
  );
}

type LegendKey = ClickBeatLevel | 'halfBeat';

function Swatch({ item, styles }: { item: LegendKey; styles: Styles }) {
  if (item === 'halfBeat') return <View style={styles.halfBeatDot} />;
  const ringed = item === 'bar' || item === 'group';
  return (
    <View
      style={[styles.swatch, ringed ? styles.swatchRing : lookOf(styles, item)]}
    >
      {item === 'bar' ? <View style={styles.swatchDot} /> : null}
    </View>
  );
}

export interface ClickBeatLegendProps {
  readonly silent: boolean;
  readonly halfBeats: boolean;
}

export function ClickBeatLegend({ silent, halfBeats }: ClickBeatLegendProps) {
  const styles = useStyles();
  const items: LegendKey[] = [
    'bar',
    'group',
    'click',
    ...(silent ? (['silent'] as const) : []),
    ...(halfBeats ? (['halfBeat'] as const) : []),
  ];
  return (
    <View importantForAccessibility="no-hide-descendants" style={styles.legend}>
      {items.map((item) => (
        <View key={item} style={styles.legendItem}>
          <Swatch item={item} styles={styles} />
          <Text style={styles.legendLabel}>{clickBeatCopy[item]}</Text>
        </View>
      ))}
    </View>
  );
}
