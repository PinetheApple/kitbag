import { Badge, CheckListRow } from '@kitbag/core-design';
import type { StemDeckSong } from '@kitbag/core-state';
import { useCallback } from 'react';

import { songFacts } from './logic/songFacts.ts';

const IN_LIBRARY = 'IN LIBRARY';

export interface SongPickRowProps {
  readonly song: StemDeckSong;
  readonly picked: boolean;
  readonly onToggle: (jobId: string) => void;
}

export function SongPickRow({ song, picked, onToggle }: SongPickRowProps) {
  const toggle = useCallback(() => {
    onToggle(song.jobId);
  }, [onToggle, song.jobId]);
  const facts = songFacts(song);
  return (
    <CheckListRow
      title={song.title}
      facts={facts}
      checked={picked}
      onToggle={toggle}
      accessibilityLabel={`${song.title}, ${facts}${song.inLibrary ? ', in library' : ''}`}
      trailing={
        song.inLibrary ? (
          <Badge
            variant="list"
            tone="success"
            icon="check"
            label={IN_LIBRARY}
          />
        ) : undefined
      }
    />
  );
}
