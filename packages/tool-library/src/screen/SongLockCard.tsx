import {
  Button,
  Card,
  Chip,
  createThemedStyles,
  RowIcon,
  songPlayer,
  textRoles,
  textStyle,
  useTextScaled,
  useTheme,
} from '@kitbag/core-design';
import {
  bpmFact,
  clickKeyLabel,
  useLiveSongPlayer,
  useSongLibrary,
  useSongPlayer,
  useSongViewing,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import { lockBadgeOf, lockIcon, lockText } from '../logic/lockText.ts';
import { playedBpm } from '../logic/playedBpm.ts';
import { REANALYZE_LABEL } from '../logic/viewText.ts';
import { useSongFailure } from './rowFailureHooks.ts';

const NO_NEIGHBOURS = {};

const useStyles = createThemedStyles((theme) => ({
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: songPlayer.lockGap,
  },
  lockStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  lead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: songPlayer.lockGap,
  },
  leadInline: { flex: 1, minWidth: 0 },
  leadStacked: { alignSelf: 'stretch' },
  lockText: { flex: 1, minWidth: 0 },
  lockTitle: { ...textStyle(textRoles.listTitle), color: theme.color.text },
  lockDetail: { ...textStyle(textRoles.listFacts), color: theme.color.text2 },
}));

export function SongLockCard({ songId }: { readonly songId: number }) {
  const styles = useStyles();
  const scaled = useTextScaled();
  const click = useSongPlayer((s) => s.click);
  const badge = useSongPlayer(lockBadgeOf);
  const speed = useSongPlayer((s) => s.speed);
  const bpm = bpmFact(useSongPlayer((s) => playedBpm(s.bpm, s.speed)));
  const toggleClick = useLiveSongPlayer((s) => s.toggleClick);
  const viewing = useSongViewing();
  const reanalyze = useSongLibrary((s) => s.reanalyze);
  const failure = useSongFailure(songId);
  const onToggle = useCallback(() => {
    void toggleClick();
  }, [toggleClick]);
  const onReanalyze = useCallback(() => {
    void reanalyze(songId);
  }, [reanalyze, songId]);
  const icon = lockIcon(badge, click, useTheme().accentInk);
  const text = lockText({
    badge,
    click,
    bpmText: bpm?.text ?? null,
    failure,
    speed,
  });
  const row = (
    <View style={[styles.lock, scaled && styles.lockStacked]}>
      <View
        style={[styles.lead, scaled ? styles.leadStacked : styles.leadInline]}
      >
        <RowIcon
          icon={icon.name}
          color={icon.color}
          border={icon.border}
          size="lockTile"
        />
        <View style={styles.lockText}>
          <Text style={styles.lockTitle}>{text.title}</Text>
          <Text style={styles.lockDetail}>{text.detail}</Text>
        </View>
      </View>
      {text.action === 'click' ? (
        <Chip
          label={click ? 'CLICK ON' : 'CLICK OFF'}
          active={click}
          accessibilityLabel={clickKeyLabel(click)}
          neighbourGapDp={NO_NEIGHBOURS}
          disabled={viewing}
          onPress={onToggle}
        />
      ) : null}
      {text.action === 'reanalyze' ? (
        <Button
          label={REANALYZE_LABEL}
          variant="tonal"
          size="small"
          onPress={onReanalyze}
        />
      ) : null}
    </View>
  );
  return click ? <Card emphasis="activeGroup">{row}</Card> : <Card>{row}</Card>;
}
