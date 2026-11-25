import {
  AppBar,
  Badge,
  createThemedStyles,
  screenBar,
  useQueueBarAction,
  type AppBarAction,
} from '@kitbag/core-design';
import { useSongPlayer, useUpNextCount } from '@kitbag/core-state';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { barBadge, barStatusOf } from '../logic/lockText.ts';
import { playedBpm } from '../logic/playedBpm.ts';
import type { BadgeSpec } from '../logic/rowText.ts';
import { songTitle } from '../logic/songTitle.ts';

const useStyles = createThemedStyles(() => ({
  bpm: { marginRight: screenBar.chipEnd },
}));

interface SongAppBarProps {
  readonly onBack: () => void;
  readonly onQueue: () => void;
  readonly onMenu: () => void;
}

interface BarFacts {
  readonly title: string;
  readonly artist: string | null;
  readonly bpm: number | null;
  readonly status: BadgeSpec | null;
}

// Stop closes the session while the screen is still animating out.
function useLastOpenFacts(): BarFacts {
  const open = useSongPlayer((s) => s.songId !== null);
  const title = useSongPlayer((s) => s.title);
  const artist = useSongPlayer((s) => s.artist);
  const bpm = useSongPlayer((s) => playedBpm(s.bpm, s.speed));
  const status = useSongPlayer(barStatusOf);
  const [kept, setKept] = useState<BarFacts>({ title, artist, bpm, status });
  const changed =
    kept.title !== title ||
    kept.artist !== artist ||
    kept.bpm !== bpm ||
    kept.status !== status;
  if (open && changed) setKept({ title, artist, bpm, status });
  return open ? { title, artist, bpm, status } : kept;
}

export function SongAppBar({ onBack, onQueue, onMenu }: SongAppBarProps) {
  const styles = useStyles();
  const { title, artist, status, bpm } = useLastOpenFacts();
  const shown = barBadge(status, bpm);
  const queue = useQueueBarAction(onQueue, useUpNextCount());
  const actions: readonly AppBarAction[] = useMemo(
    () => [...queue, { icon: 'more', label: 'More', onPress: onMenu }],
    [queue, onMenu],
  );
  return (
    <AppBar
      flush
      title={songTitle(title)}
      subtitle={artist ?? undefined}
      onBack={onBack}
      actions={actions}
      trailing={
        shown === null ? null : (
          <View style={styles.bpm}>
            <Badge
              label={shown.label}
              tone={shown.tone}
              {...(shown.icon === undefined ? {} : { icon: shown.icon })}
              accessibilityLabel={shown.spoken}
            />
          </View>
        )
      }
    />
  );
}
