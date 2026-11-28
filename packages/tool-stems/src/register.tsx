import type { ToolPlugin } from '@kitbag/core-plugin-api';
import type { ComponentType } from 'react';

import { StemsHostContext, type StemsHost } from './host.ts';
import { manifest } from './manifest.ts';
import {
  StemPlayerScreen,
  type StemPlayerScreenProps,
} from './screen/StemPlayerScreen.tsx';
import { CameraExplainerScreen } from './stemDeck/CameraExplainerScreen.tsx';
import { ConnectScreen } from './stemDeck/ConnectScreen.tsx';
import { ImportProgressScreen } from './stemDeck/ImportProgressScreen.tsx';
import { SongListScreen } from './stemDeck/SongListScreen.tsx';

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
    id: manifest.id,
    name: manifest.name,
    icon: manifest.icon,
    routes: [
      { path: manifest.routes.stemSet, screen: StemPlayer },
      { path: manifest.routes.stemDeck, screen: ConnectScreen },
      { path: manifest.routes.stemDeckCamera, screen: CameraExplainerScreen },
      { path: manifest.routes.stemDeckImport, screen: ImportProgressScreen },
      { path: manifest.routes.stemDeckSongs, screen: SongListScreen },
    ],
    screens: { player: StemPlayer },
  };
}
