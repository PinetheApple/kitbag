import { EmptyState, ListRow } from '@kitbag/core-design';

export function NothingPlaying() {
  return (
    <EmptyState
      icon="song"
      title="Nothing is playing"
      reason="Play a song in Spotify, YouTube Music or any music app, and it shows up here."
    />
  );
}

export function NotFollowingRow({ onPress }: { readonly onPress: () => void }) {
  return (
    <ListRow
      icon="info"
      title="Not following an app"
      subtitle="Turn on notification access to follow Spotify"
      onPress={onPress}
    />
  );
}
