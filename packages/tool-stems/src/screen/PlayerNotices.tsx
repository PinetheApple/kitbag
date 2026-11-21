import {
  Card,
  countLabel,
  createThemedStyles,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { KB_MAX_TRACKS } from '@kitbag/core-native';
import { useStemPlayer } from '@kitbag/core-state';
import { Text } from 'react-native';

import { ExportNotice } from './ExportNotice.tsx';

export const useNoteStyles = createThemedStyles((theme) => ({
  note: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
}));

function missingNote(unloaded: number, stemCount: number): string {
  if (unloaded === stemCount)
    return 'No stem files could be opened. Nothing will play.';
  return `${countLabel(unloaded, 'stem file', 'stem files')} could not be opened. The others play.`;
}

export function Notices() {
  const styles = useNoteStyles();
  const overLimit = useStemPlayer((s) => s.overLimit);
  const stemCount = useStemPlayer((s) => s.stems.length);
  const unloaded = useStemPlayer(
    (s) => s.stems.filter((row) => !row.loaded).length,
  );
  return (
    <>
      <ExportNotice />
      {overLimit > 0 ? (
        <Card
          emphasis="warning"
          statusIcon="warning"
          statusLabel="Too many stems"
        >
          <Text style={styles.note}>
            {`The mixer plays ${String(KB_MAX_TRACKS)} stems at most, so ${String(overLimit)} of this song's stems are left out.`}
          </Text>
        </Card>
      ) : null}
      {unloaded > 0 ? (
        <Card
          emphasis="danger"
          statusIcon="failure"
          statusLabel="Stems missing"
        >
          <Text style={styles.note}>{missingNote(unloaded, stemCount)}</Text>
        </Card>
      ) : null}
    </>
  );
}
