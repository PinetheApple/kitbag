import type { Notice } from '@kitbag/core-design';
import type { ToolListening } from '@kitbag/core-plugin-api';
import type { LeftSetlist } from '@kitbag/core-state';

import { QueueSheet } from './QueueSheet.tsx';
import { UpNextRow } from './UpNextRow.tsx';
import { useMixerFrame } from './useMixerFrame.ts';

export const listening: ToolListening<Notice, LeftSetlist> = {
  useMixerFrame,
  UpNextRow,
  QueueSheet,
};
