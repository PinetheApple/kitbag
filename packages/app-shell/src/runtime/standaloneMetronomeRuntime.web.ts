import { configureStandaloneMetronomePersistence } from '@kitbag/core-state';

import {
  STANDALONE_METRONOME_KEY,
  standaloneMetronomePersistence,
} from './standaloneMetronomePreference';
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
