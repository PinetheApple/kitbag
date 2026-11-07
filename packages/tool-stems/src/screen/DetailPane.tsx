import {
  createThemedStyles,
  Icon,
  radius,
  size,
  stemSections,
  stemSectionsText,
  textStyle,
  hitBoxStyle,
  hitExtension,
  minTouchTargetDp,
} from '@kitbag/core-design';
import { lyricLineAt, useStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { detailPaneKind } from '../logic/detailView.ts';
import { SectionCards } from './SectionCards.tsx';
import { StageLyrics, useLyricStyles } from './StageLyrics.tsx';

const CHIP_HIT_BOX = hitBoxStyle(
  hitExtension(minTouchTargetDp, stemSections.chipHeight, {}),
);

const useStyles = createThemedStyles((theme) => ({
  head: {
    minHeight: stemSections.headMinHeight,
    marginBottom: stemSections.headBottom,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: stemSections.headGap,
  },
  label: {
    ...textStyle(stemSectionsText.label),
    color: theme.color.text2,
  },
  chip: {
    minHeight: stemSections.chipHeight,
    paddingLeft: stemSections.chipLeft,
    paddingRight: stemSections.chipRight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemSections.chipGap,
    borderRadius: radius.chip,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  chipText: {
    ...textStyle(stemSectionsText.chip),
    color: theme.color.text,
  },
  noSync: {
    ...textStyle(stemSectionsText.noSync),
    color: theme.color.text2,
    marginTop: stemSections.noSyncTop,
    marginBottom: stemSections.noSyncBottom,
  },
  plain: {
    ...textStyle(stemSectionsText.plain),
    lineHeight: stemSections.plainLineHeight,
    color: theme.color.text,
    paddingBottom: stemSections.plainBottom,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: stemSections.emptyGap,
    paddingHorizontal: stemSections.emptyH,
  },
  emptyTitle: {
    ...textStyle(stemSectionsText.emptyTitle),
    color: theme.color.text,
  },
  emptyBody: {
    ...textStyle(stemSectionsText.emptyBody),
    lineHeight: stemSectionsText.emptyBody.size * stemSections.emptyBodyRatio,
    color: theme.color.text2,
    textAlign: 'center',
  },
}));

function LyricsHead({
  synced,
  songSec,
}: {
  readonly synced: boolean;
  readonly songSec: SharedValue<number>;
}) {
  const styles = useStyles();
  const lines = useStemPlayer((s) => s.lyrics.lines);
  const beginRetime = useStemPlayer((s) => s.beginRetime);
  const open = useCallback(() => {
    beginRetime(lyricLineAt(lines, songSec.value));
  }, [beginRetime, lines, songSec]);
  return (
    <View style={styles.head}>
      <Text style={styles.label}>Lyrics</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={synced ? 'Retime lyrics' : 'Tap along to sync'}
        style={CHIP_HIT_BOX}
        onPress={open}
      >
        <View style={styles.chip}>
          <Icon name="tapAlong" size="lyricsChip" color="text2" />
          <Text style={styles.chipText}>
            {synced ? 'Retime' : 'Tap along to sync'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function PlainLyrics() {
  const styles = useStyles();
  const lyricStyles = useLyricStyles();
  const plain = useStemPlayer((s) => s.lyrics.plain);
  return (
    <ScrollView
      style={lyricStyles.view}
      contentContainerStyle={lyricStyles.content}
    >
      <Text style={styles.noSync}>Not synced · plain text from the bundle</Text>
      <Text style={styles.plain}>{plain}</Text>
    </ScrollView>
  );
}

function Instrumental() {
  const styles = useStyles();
  return (
    <View style={styles.empty}>
      <Icon name="song" size="lyricsEmpty" color="text2" />
      <Text style={styles.emptyTitle}>Instrumental</Text>
      <Text style={styles.emptyBody}>
        No lyrics in this song. The tab shows sections only.
      </Text>
    </View>
  );
}

export function DetailPane({
  songSec,
}: {
  readonly songSec: SharedValue<number>;
}) {
  const hasSections = useStemPlayer((s) => s.sections.length > 0);
  const pane = useStemPlayer((s) => detailPaneKind(s.lyrics));
  return (
    <>
      {hasSections ? <SectionCards songSec={songSec} /> : null}
      {pane === 'stage' || pane === 'plain' ? (
        <LyricsHead synced={pane === 'stage'} songSec={songSec} />
      ) : null}
      {pane === 'stage' ? <StageLyrics songSec={songSec} /> : null}
      {pane === 'plain' ? <PlainLyrics /> : null}
      {pane === 'instrumental' ? <Instrumental /> : null}
    </>
  );
}
