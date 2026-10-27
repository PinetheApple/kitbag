import {
  Badge,
  Button,
  Card,
  createThemedStyles,
  Icon,
  inset,
  minTouchTargetDp,
  RowText,
  space,
  textRoles,
  textStyle,
  usePlainRowStyles,
} from '@kitbag/core-design';
import {
  analysisFailure,
  songBadge,
  useSongLibrary,
  type AnalysisFailure,
  type LibraryRow,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { failureText } from '../logic/notices.ts';
import {
  rowSubtitle,
  songBadges,
  spokenRow,
  stemBadges,
  type BadgeSpec,
} from '../logic/rowText.ts';

const useStyles = createThemedStyles((theme) => ({
  group: { gap: space.controlGap },
  badges: {
    flexShrink: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: space.chipGap,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
  },
  more: {
    width: minTouchTargetDp,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -inset.rowV,
  },
  failure: {
    gap: space.controlGap,
    alignItems: 'flex-start',
  },
  failureText: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text,
  },
}));

function Badges({ badges }: { readonly badges: readonly BadgeSpec[] }) {
  const styles = useStyles();
  return (
    <View style={styles.badges}>
      {badges.map((badge) => (
        <Badge
          key={badge.key}
          label={badge.label}
          tone={badge.tone}
          {...(badge.icon === undefined ? {} : { icon: badge.icon })}
          accessibilityLabel={badge.spoken}
        />
      ))}
    </View>
  );
}

interface FailedCardProps {
  readonly failure: AnalysisFailure;
  readonly onRetry: () => void;
}

function AnalysisFailedCard({ failure, onRetry }: FailedCardProps) {
  const styles = useStyles();
  const { status, text, canRetry } = failureText(failure);
  return (
    <Card
      emphasis={failure.keptGrid ? 'warning' : 'danger'}
      statusIcon={failure.keptGrid ? 'warning' : 'failure'}
      statusLabel={status}
    >
      <View style={styles.failure}>
        <Text style={styles.failureText}>{text}</Text>
        {canRetry ? (
          <Button label="Re-analyze" variant="tonal" onPress={onRetry} />
        ) : null}
      </View>
    </Card>
  );
}

function rowBadges(row: LibraryRow) {
  if (row.kind === 'stems') return stemBadges(row.stemCount);
  return songBadges(row, songBadge(row));
}

export interface LibraryRowViewProps {
  readonly row: LibraryRow;
  readonly onActions: (row: LibraryRow) => void;
}

export function LibraryRowView({ row, onActions }: LibraryRowViewProps) {
  const styles = useStyles();
  const rowStyles = usePlainRowStyles();
  const reanalyze = useSongLibrary((s) => s.reanalyze);
  const badges = rowBadges(row);
  const codes = useSongLibrary((s) => s.codes);
  const failure = row.kind === 'song' ? analysisFailure(row, codes) : null;
  const openActions = useCallback(() => {
    onActions(row);
  }, [onActions, row]);
  const retry = useCallback(() => {
    void reanalyze(row.id);
  }, [reanalyze, row.id]);
  return (
    <View style={styles.group}>
      <View style={rowStyles.row}>
        <Pressable
          accessible
          accessibilityLabel={spokenRow(
            row,
            badges,
            failure === null ? null : failureText(failure).status,
          )}
          style={styles.body}
          onLongPress={openActions}
        >
          <RowText title={row.title} subtitle={rowSubtitle(row)} />
          <Badges badges={badges} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${row.title}`}
          style={styles.more}
          onPress={openActions}
        >
          <Icon name="more" size="action" color="text2" />
        </Pressable>
      </View>
      {failure === null ? null : (
        <AnalysisFailedCard failure={failure} onRetry={retry} />
      )}
    </View>
  );
}
