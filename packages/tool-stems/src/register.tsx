import type { ToolPlugin } from '@kitbag/core-plugin-api';
import type { ComponentType } from 'react';

import { StemsHostContext, type StemsHost } from './host.ts';
import {
  StemPlayerScreen,
  type StemPlayerScreenProps,
} from './screen/StemPlayerScreen.tsx';
import { CameraExplainerScreen } from './stemDeck/CameraExplainerScreen.tsx';
import { ConnectScreen } from './stemDeck/ConnectScreen.tsx';
import { ImportProgressScreen } from './stemDeck/ImportProgressScreen.tsx';
import { SongListScreen } from './stemDeck/SongListScreen.tsx';

const STEMS_ROUTES = {
  stemSet: '/stems/[id]',
  stemDeck: '/stemdeck',
  stemDeckCamera: '/stemdeck/camera',
  stemDeckImport: '/stemdeck/import',
  stemDeckSongs: '/stemdeck/songs',
} as const;

export interface StemsScreens {
  readonly player: ComponentType<StemPlayerScreenProps>;
}

export interface StemsPlugin extends ToolPlugin {
  readonly screens: StemsScreens;
}

export function register(host: StemsHost): StemsPlugin {
  function StemPlayer(props: StemPlayerScreenProps) {
    return (
      <StemsHostContext.Provider value={host}>
        <StemPlayerScreen {...props} />
      </StemsHostContext.Provider>
    );
  }
  return {
    id: 'stems',
    name: 'Stem songs',
    icon: 'stems',
    routes: [
      { path: STEMS_ROUTES.stemSet, screen: StemPlayer },
      { path: STEMS_ROUTES.stemDeck, screen: ConnectScreen },
      { path: STEMS_ROUTES.stemDeckCamera, screen: CameraExplainerScreen },
      { path: STEMS_ROUTES.stemDeckImport, screen: ImportProgressScreen },
      { path: STEMS_ROUTES.stemDeckSongs, screen: SongListScreen },
    ],
    screens: { player: StemPlayer },
  };
}
