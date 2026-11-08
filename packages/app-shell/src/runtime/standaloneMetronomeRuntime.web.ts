import { configureStandaloneMetronomePersistence } from '@kitbag/core-state';

import { standaloneMetronomePersistence } from './standaloneMetronomePreference';
import { storedWebPreference, WEB_KEY_PREFIX } from './storedWebPreference';
import { queriedTempoWins } from './tempoQuery';

configureStandaloneMetronomePersistence(
  queriedTempoWins(
    standaloneMetronomePersistence(
      storedWebPreference(`${WEB_KEY_PREFIX}metronomeStandalone`),
    ),
    globalThis.location.search,
  ),
);
