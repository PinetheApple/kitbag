import { STANDALONE_METRONOME_KEY } from '@kitbag/core-db';
import {
  configureStandaloneMetronomePersistence,
  flushStandaloneMetronomePersistence,
} from '@kitbag/core-state';

import { onAppBackground } from './appState';
import { standaloneMetronomePersistence } from './standaloneMetronomePreference';
import { storedWebPreference, WEB_KEY_PREFIX } from './storedWebPreference';
import { queriedTempoWins } from './tempoQuery';

configureStandaloneMetronomePersistence(
  queriedTempoWins(
    standaloneMetronomePersistence(
      storedWebPreference(`${WEB_KEY_PREFIX}${STANDALONE_METRONOME_KEY}`),
    ),
    globalThis.location.search,
  ),
);
onAppBackground(flushStandaloneMetronomePersistence);
