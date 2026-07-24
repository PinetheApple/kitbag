import { resolveTheme } from '@kitbag/core-design';
import { getKitbagCommands } from '@kitbag/core-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BeatSweep } from './BeatSweep';
import { EngineBpmReadout } from './EngineBpmReadout';
import { LedRow } from './LedRow';
import { STARVATION_MS, starveJsThread } from './starvation';
import { useBeatSweep } from './useBeatSweep';

// The §13.3 proving surface (SPEC §15 "one screen and no product"), NOT the
// metronome tool (Phase 3). The 60fps values come from useBeatSweep; React
// state here is human-speed ONLY — tempo, beats per bar, running (§13.4).

const theme = resolveTheme('dark');

const DEFAULT_BPM = 120;
const DEFAULT_BEATS = 4;
const BPM_STEP = 5;
const MS_PER_SECOND = 1000;
const STARVATION_SECONDS = STARVATION_MS / MS_PER_SECOND;

export function GateScreen() {
  const { barPhase, currentBeat, currentBpm } = useBeatSweep();

  // Human-speed only: these change on a tap, never per frame (§13.4).
  const [tempo, setTempo] = useState(DEFAULT_BPM);
  const [beatsPerBar] = useState(DEFAULT_BEATS);
  const [running, setRunning] = useState(false);

  // useCallback for stable identity (react/jsx-no-bind forbids inline handlers).
  // useState setters are stable, so their deps lists are empty.
  const onTempoUp = useCallback(() => {
    setTempo((prev) => prev + BPM_STEP);
  }, []);
  const onTempoDown = useCallback(() => {
    setTempo((prev) => prev - BPM_STEP);
  }, []);
  const onToggleRunning = useCallback(() => {
    setRunning((prev) => {
      const next = !prev;
      tryEngineTransport(next);
      return next;
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>60fps gate</Text>

      <BeatSweep barPhase={barPhase} />
      <LedRow currentBeat={currentBeat} beatsPerBar={beatsPerBar} />

      <View style={styles.readouts}>
        <View style={styles.readoutBlock}>
          <Text style={styles.readout}>{tempo}</Text>
          <Text style={styles.readoutLabel}>target BPM</Text>
        </View>
        <View style={styles.readoutBlock}>
          <EngineBpmReadout currentBpm={currentBpm} />
          <Text style={styles.readoutLabel}>engine BPM</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Pressable style={styles.button} onPress={onTempoDown}>
          <Text style={styles.buttonText}>-{BPM_STEP}</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={onTempoUp}>
          <Text style={styles.buttonText}>+{BPM_STEP}</Text>
        </Pressable>
      </View>

      <Pressable style={styles.button} onPress={onToggleRunning}>
        <Text style={styles.buttonText}>{running ? 'Stop' : 'Start'}</Text>
      </Pressable>

      <Pressable style={styles.starveButton} onPress={handleStarveJs}>
        <Text style={styles.buttonText}>Starve JS {STARVATION_SECONDS}s</Text>
      </Pressable>

      <Text style={styles.note}>
        Pass/fail is device-side (#33): the sweep must stay smooth while JS is
        starved. Measured from recorded output, not by ear (SPEC §14.1).
      </Text>
    </View>
  );
}

// The command TurboModule is not registered until #33; resolving it throws.
// Guard so the gate still runs without a native build — the transport call is
// best-effort here and only becomes real on device.
function tryEngineTransport(start: boolean): void {
  try {
    const commands = getKitbagCommands();
    if (start) {
      void commands.start();
    } else {
      commands.stop();
    }
  } catch {
    // No native build yet (#33): human-speed state still toggles.
  }
}

function handleStarveJs(): void {
  starveJsThread(STARVATION_MS);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: theme.bg,
    padding: 24,
  },
  title: {
    color: theme.text,
    fontSize: 22,
  },
  readouts: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 32,
  },
  readoutBlock: {
    alignItems: 'center',
  },
  readout: {
    color: theme.text,
    fontSize: 48,
    fontVariant: ['tabular-nums'],
  },
  readoutLabel: {
    color: theme.text2,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    backgroundColor: theme.surface2,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  starveButton: {
    backgroundColor: theme.surface3,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  buttonText: {
    color: theme.text,
    fontSize: 15,
  },
  note: {
    color: theme.text2,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 320,
  },
});
