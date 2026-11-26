import { QUEUE_TEXT } from '../queueText.ts';
import { MenuRow } from './MenuRow.tsx';
import { useQueueKeys, type QueuePresses } from './useQueuePresses.ts';

export function QueueMenuRows({
  presses,
  queued,
}: {
  readonly presses: QueuePresses;
  readonly queued: boolean;
}) {
  const keys = useQueueKeys(presses, queued);
  return (
    <>
      <MenuRow
        icon="playNext"
        label={QUEUE_TEXT.playNext}
        onPress={keys.playNext}
      />
      <MenuRow
        icon="addToQueue"
        label={keys.addLabel}
        onPress={keys.addToQueue}
      />
    </>
  );
}
