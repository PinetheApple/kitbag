import {
  createThemedStyles,
  EmptyState,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import type { StemPlayerStatus } from '@kitbag/core-state';
import { Text } from 'react-native';

import { UNAVAILABLE_TEXT, unsupportedFormatText } from '../logic/notices.ts';
import { BACK_TO_SONGS } from '../logic/viewText.ts';
import { useSongFailure, useSongFiles } from './rowFailureHooks.ts';

const NOT_PLAYED_TITLE = 'This song would not play';
const NOT_PLAYED_REASON =
  'The file could not be read, its format may not be supported, or the audio engine did not start.';

const useStyles = createThemedStyles((theme) => ({
  note: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
}));

interface NotPlayedText {
  readonly title: string;
  readonly reason: string;
}

function useNotPlayedText(songId: number): NotPlayedText {
  const failure = useSongFailure(songId);
  const files = useSongFiles(songId);
  if (files === 'unavailable')
    return { title: UNAVAILABLE_TEXT.status, reason: UNAVAILABLE_TEXT.text };
  if (failure?.kind === 'unsupported')
    return {
      title: NOT_PLAYED_TITLE,
      reason: unsupportedFormatText(failure.format, failure.supported),
    };
  return { title: NOT_PLAYED_TITLE, reason: NOT_PLAYED_REASON };
}

export function NotReady({
  songId,
  status,
  onBack,
}: {
  readonly songId: number;
  readonly status: StemPlayerStatus;
  readonly onBack: () => void;
}) {
  const styles = useStyles();
  const notPlayed = useNotPlayedText(songId);
  if (status === 'failed')
    return (
      <EmptyState
        icon="song"
        title={notPlayed.title}
        reason={notPlayed.reason}
        actionLabel={BACK_TO_SONGS}
        onAction={onBack}
      />
    );
  if (status === 'missing')
    return (
      <EmptyState
        icon="song"
        title="This song is gone"
        reason="It was deleted from the library. Pick another song there."
        actionLabel={BACK_TO_SONGS}
        onAction={onBack}
      />
    );
  if (status === 'idle') return null;
  return (
    <Text accessibilityLiveRegion="polite" style={styles.note}>
      Opening the song…
    </Text>
  );
}
