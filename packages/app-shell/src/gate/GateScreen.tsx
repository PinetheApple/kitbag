import { resolveTheme } from '@kitbag/core-design';
import { getKitbagCommands, getKitbagHostObject } from '@kitbag/core-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BeatSweep } from './BeatSweep';
import { bootstrapKitbagRuntime } from './bootstrapRuntime';
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

const SECONDS_PER_MINUTE = 60;
// A long measured grid so the sweep runs continuously through the gate + the
// starvation test. Well under the engine's KB_MAX_GRID_BEATS cap (kitbag_api.h);
// the constant is engine-owned, not restated here (§13.7).
const GATE_GRID_BEATS = 2000;

export function GateScreen() {
  const { barPhase, currentBeat, currentBpm } = useBeatSweep();

  const [tempo, setTempo] = useState(DEFAULT_BPM);
  const [beatsPerBar] = useState(DEFAULT_BEATS);
  const [running, setRunning] = useState(false);

  // One-time runtime install: publishes the HostObject onto the UI runtime so
  // useBeatSweep's worklet can read it (see bootstrapRuntime.ts). This is
  // human-speed setup, NOT a frame driver — the §13.3 ban on effect-driven
  // animation does not apply to a once-at-mount install. Guarded: with no native
  // build the sweep just holds at 0 (#33 verifies on device).
  useEffect(() => {
    try {
      bootstrapKitbagRuntime();
    } catch {
      // No native module registered yet (#33).
    }
  }, []);

  // useCallback for stable identity (react/jsx-no-bind forbids inline handlers).
  // tempo + running are in deps so the closures are never stale: we read the
  // current tempo to compute next and gate the live engine call on running.
  // While running, a tempo change must reach the engine so it applies live over
  // the running metronome (SPEC §5.3) — the §5.8 mid-bar-glitch-free test needs
  // this. When stopped, Start sends the value (tryDriveEngineOnStart).
  const onTempoUp = useCallback(() => {
    const next = tempo + BPM_STEP;
    setTempo(next);
    if (running) {
      trySetEngineTempo(next);
    }
  }, [tempo, running]);
  const onTempoDown = useCallback(() => {
    const next = tempo - BPM_STEP;
    setTempo(next);
    if (running) {
      trySetEngineTempo(next);
    }
  }, [tempo, running]);
  const onToggleRunning = useCallback(() => {
    setRunning((prev) => {
      const next = !prev;
      if (next) {
        tryDriveEngineOnStart(tempo, beatsPerBar);
      } else {
        tryStopEngine();
      }
      return next;
    });
  }, [tempo, beatsPerBar]);

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

// Drive the engine so bar_phase advances. The command TurboModule is not
// registered until #33; resolving it throws, so this is guarded — the gate still
// renders (sweep held at 0) without a native build.
//
// Two things are required for the sweep to move, and start() is only the first:
// kb_engine_start opens the audio device (advances the frame clock) but leaves the
// metronome's running_ false, and bar_phase is published ONLY while running_
// (metronome.cpp PublishBlockMirrors). So we also issue metronomeStart
// (kb_metronome_start_at, added to §13.2's spec — a recorded spec change per
// runbook §3a, NOT a fudge) to flip running_ true; without it the sweep stays
// frozen at 0 even on a perfect UI-runtime install.
//
// ORDER + SHARED ANCHOR (non-obvious): capture the anchor frame ONCE and reuse it
// for both setGrid and metronomeStart so they align. setGrid anchors beat 0 at
// that frame; metronomeStart starts the transport at the SAME frame, so running_
// flips at beat 0 and the sweep starts at phase 0 rather than mid-bar. setGrid is
// issued BEFORE metronomeStart because the engine seeds the grid cursor from the
// live grid when the deferred start fires (metronome_render.cpp BeginPendingStart),
// so the grid must already be published by then.
function tryDriveEngineOnStart(bpm: number, beatsPerBar: number): void {
  try {
    const commands = getKitbagCommands();
    void commands.start();
    commands.setTempo(bpm);
    commands.setBeats(beatsPerBar);
    const secondsPerBeat = SECONDS_PER_MINUTE / bpm;
    const beatTimesSec = Array.from(
      { length: GATE_GRID_BEATS },
      (_, i) => i * secondsPerBeat,
    );
    // One anchor for both the grid and the transport start (see above).
    const anchorFrame = getKitbagHostObject().frames_rendered;
    void commands.setGrid(beatTimesSec, anchorFrame);
    commands.metronomeStart(anchorFrame);
  } catch {
    // No native build yet (#33): human-speed state still toggles.
  }
}

// Apply a live tempo change to a running metronome (SPEC §5.3). Same setTempo
// TurboModule command tryDriveEngineOnStart uses at Start — one command path, not
// a second (§13.7). Guarded like the other helpers: with no native build the
// human-speed state still updates.
function trySetEngineTempo(bpm: number): void {
  try {
    getKitbagCommands().setTempo(bpm);
  } catch {
    // No native build yet (#33): human-speed state still toggles.
  }
}

function tryStopEngine(): void {
  try {
    getKitbagCommands().stop();
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
