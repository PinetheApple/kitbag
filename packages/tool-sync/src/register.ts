import type {
  HomeSubtextContribution,
  MiniPlayerContribution,
  ToolPlugin,
} from '@kitbag/core-plugin-api';
import type { SessionChooser } from '@kitbag/core-state';

import { chooseSession } from './logic/chooseSession.ts';
import { manifest } from './manifest.ts';
import {
  PlayAlongMiniPlayer,
  useLockedSubtext,
  usePlayAlongMiniShown,
} from './screen/PlayAlongMiniPlayer.tsx';
import { PlayAlongScreen } from './screen/PlayAlongScreen.tsx';

export interface MediaSessionContribution {
  readonly choose: SessionChooser;
}

export interface SyncPlugin extends ToolPlugin {
  readonly miniPlayer: MiniPlayerContribution;
  readonly useHomeSubtext: HomeSubtextContribution;
  readonly mediaSession: MediaSessionContribution;
}

export function register(): SyncPlugin {
  const { id, name, icon } = manifest;
  return {
    id,
    name,
    icon,
    routes: [{ path: manifest.routes.home, screen: PlayAlongScreen }],
    miniPlayer: {
      Player: PlayAlongMiniPlayer,
      useShown: usePlayAlongMiniShown,
    },
    useHomeSubtext: useLockedSubtext,
    mediaSession: { choose: chooseSession },
  };
}
