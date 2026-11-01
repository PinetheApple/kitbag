import {
  createRigClick,
  metronomeStore,
  type RigClickStore,
} from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { attachRig } from './rigClickLifecycle.ts';
import { rigEngineDeps } from './rigRuntime';

const holdEngine = () => metronomeStore.getState().holdEngine();

export function useRigClickSession(): RigClickStore {
  const [click] = useState(() => createRigClick(rigEngineDeps));
  useFocusEffect(
    useCallback(
      () => attachRig(click.getState(), holdEngine, AppState),
      [click],
    ),
  );
  return click;
}
