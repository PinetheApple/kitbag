// Pure parse + render for the generated native constants (SPEC §13.7).
//
// This module is the ONLY logic behind src/generated/nativeConstants.gen.ts. It
// takes the raw text of the engine's own source files and extracts the
// cross-boundary constants from where the engine already defines them — it never
// restates a value. A caller (scripts/generate-constants.ts) reads the files;
// this module does no I/O, which is what makes it unit-testable and lets the
// drift guard re-render deterministically.
//
// §13.7's rule: cross-boundary constants have exactly one owner. Here the owner
// is the C/C++ source; this file mirrors it, and generate:check fails the build
// if the mirror drifts. Every parser below THROWS if its target is missing —
// never guesses — because a generator that silently emits a wrong value is the
// exact `sync_screen.dart:14` defect (SPEC §2.3, §13.7) with a new coat of paint.

export interface NativeSources {
  /** native/audio_core/include/kitbag_api.h — the shipped C ABI. */
  readonly apiHeader: string;
  /** native/audio_core/src/mixer/mixer.h — kMaxTracks lives here, not the ABI. */
  readonly mixerHeader: string;
  /** native/audio_core/src/metronome/metronome.h — kSoundCount lives here. */
  readonly metronomeHeader: string;
  /** native/audio_core/src/metronome/metronome_render.cpp — the sound presets. */
  readonly metronomeRender: string;
}

export interface EnumMember {
  readonly name: string;
  readonly value: number;
}

export interface RangeBound {
  readonly min: number;
  readonly max: number;
  /** true when the upper bound is exclusive, e.g. `[0, 1)`. */
  readonly maxExclusive: boolean;
}

export interface TunerField {
  readonly offset: number;
  readonly width: number;
  readonly signed: boolean;
  readonly scale: number;
}

export interface NativeConstants {
  readonly maxGridBeats: number;
  readonly maxTracks: number;
  readonly soundNames: readonly string[];
  readonly result: readonly EnumMember[];
  readonly accent: readonly EnumMember[];
  readonly latencyOffsetMsBounds: RangeBound;
  readonly barPhaseBounds: RangeBound;
  readonly tunerFields: {
    readonly note: TunerField;
    readonly cents: TunerField;
    readonly confidence: TunerField;
  };
}

function fail(what: string): never {
  throw new Error(
    `native-constants: could not extract ${what} from the engine source. ` +
      `The header layout changed; update the parser rather than the generated ` +
      `output (SPEC §13.7 — one owner per constant).`,
  );
}

/** `#define NAME <int>` from a C header. */
export function parseDefineInt(header: string, name: string): number {
  const match = new RegExp(`#define\\s+${name}\\s+(-?\\d+)\\b`).exec(header);
  if (match === null) fail(`#define ${name}`);
  return Number(match[1]);
}

/** `static constexpr int NAME = <int>;` from a C++ header. */
export function parseConstexprInt(source: string, name: string): number {
  const match = new RegExp(
    `static\\s+constexpr\\s+int\\s+${name}\\s*=\\s*(-?\\d+)\\s*;`,
  ).exec(source);
  if (match === null) fail(`constexpr int ${name}`);
  return Number(match[1]);
}

/** Members of `typedef enum NAME { A = 0, B = 1, ... }`, in declaration order. */
export function parseEnum(source: string, enumName: string): EnumMember[] {
  const block = new RegExp(`enum\\s+${enumName}\\s*\\{([^}]*)\\}`).exec(source);
  if (block === null) fail(`enum ${enumName}`);
  const body = block[1] ?? '';
  const members: EnumMember[] = [];
  const memberRe = /([A-Z_][A-Z0-9_]*)\s*=\s*(-?\d+)/g;
  let m: RegExpExecArray | null = memberRe.exec(body);
  while (m !== null) {
    members.push({ name: m[1] ?? '', value: Number(m[2]) });
    m = memberRe.exec(body);
  }
  if (members.length === 0) fail(`members of enum ${enumName}`);
  return members;
}

/**
 * A `[min, max]` / `[min, max)` range from a documenting comment. `marker` is a
 * substring that uniquely precedes the bracket on the same line, so the parser
 * anchors to the intended comment and not just any range in the file.
 */
export function parseRangeAfter(source: string, marker: string): RangeBound {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `${escaped}[^\\[]*\\[\\s*(-?\\d+)\\s*,\\s*(-?\\d+)\\s*([\\])])`,
  ).exec(source);
  if (match === null) fail(`range after "${marker}"`);
  const [, minStr, maxStr, closeStr] = match;
  return {
    min: Number(minStr),
    max: Number(maxStr),
    maxExclusive: closeStr === ')',
  };
}

/**
 * The ordered sound names. The engine has no ABI-exported string table for
 * these — the only machine-readable owner is the trailing comment on each row of
 * the `kSounds` preset array in metronome_render.cpp (`{...},  // beep`). We
 * mirror those verbatim (lowercase engine ids; display casing is a §12 concern),
 * and cross-check the count against Metronome::kSoundCount so a preset added
 * without a name — or vice versa — fails the build instead of silently
 * truncating the list.
 */
export function parseSoundNames(
  metronomeRender: string,
  metronomeHeader: string,
): string[] {
  const expectedCount = parseConstexprInt(metronomeHeader, 'kSoundCount');
  const table =
    /constexpr\s+SoundPreset\s+kSounds\[[^\]]*\]\s*=\s*\{([\s\S]*?)\};/.exec(
      metronomeRender,
    );
  if (table === null) fail('the kSounds preset table');
  const body = table[1] ?? '';
  const names: string[] = [];
  const rowRe = /\}\s*,\s*\/\/\s*([a-z0-9-]+)/g;
  let m: RegExpExecArray | null = rowRe.exec(body);
  while (m !== null) {
    names.push(m[1] ?? '');
    m = rowRe.exec(body);
  }
  if (names.length !== expectedCount) {
    fail(
      `${String(expectedCount)} sound names to match kSoundCount, found ` +
        `${String(names.length)} (${names.join(', ')})`,
    );
  }
  return names;
}

// One parsed bit-layout row, before it is normalised into a TunerField (which
// stores width rather than the header's inclusive hi bit).
interface TunerRow {
  offset: number;
  hi: number;
  signed: boolean;
  scale: number;
}

/**
 * The tuner-snapshot bit layout, parsed from the field table in the
 * kb_tuner_snapshot doc comment. Signedness and the ×N scale come from the same
 * table, so the decode in src/host/snapshot.ts cannot drift from what
 * Tuner::PackSnapshot produces (SPEC §13.2).
 */
export function parseTunerFields(
  apiHeader: string,
): NativeConstants['tunerFields'] {
  const rowRe = /bits\s+(\d+)-(\d+)\s+(u?int16)\s+([^\n]*)/g;
  const rows: TunerRow[] = [];
  let m: RegExpExecArray | null = rowRe.exec(apiHeader);
  while (m !== null) {
    const [, offsetStr, hiStr, typeStr, rest] = m;
    const scaleMatch = /x(\d+)/.exec(rest ?? '');
    rows.push({
      offset: Number(offsetStr),
      hi: Number(hiStr),
      signed: typeStr === 'int16',
      scale: scaleMatch === null ? 1 : Number(scaleMatch[1]),
    });
    m = rowRe.exec(apiHeader);
  }
  const [note, cents, confidence] = rows;
  if (note === undefined || cents === undefined || confidence === undefined) {
    fail('the three kb_tuner_snapshot bit-layout rows');
  }
  const toField = (r: TunerRow): TunerField => ({
    offset: r.offset,
    width: r.hi - r.offset + 1,
    signed: r.signed,
    scale: r.scale,
  });
  return {
    note: toField(note),
    cents: toField(cents),
    confidence: toField(confidence),
  };
}

export function collectConstants(sources: NativeSources): NativeConstants {
  return {
    maxGridBeats: parseDefineInt(sources.apiHeader, 'KB_MAX_GRID_BEATS'),
    maxTracks: parseConstexprInt(sources.mixerHeader, 'kMaxTracks'),
    soundNames: parseSoundNames(
      sources.metronomeRender,
      sources.metronomeHeader,
    ),
    result: parseEnum(sources.apiHeader, 'kb_result'),
    accent: parseEnum(sources.apiHeader, 'kb_accent'),
    latencyOffsetMsBounds: parseRangeAfter(
      sources.apiHeader,
      'Output latency offset in ms',
    ),
    barPhaseBounds: parseRangeAfter(
      sources.apiHeader,
      'Position within the bar,',
    ),
    tunerFields: parseTunerFields(sources.apiHeader),
  };
}

// --- rendering --------------------------------------------------------------

function renderEnum(name: string, members: readonly EnumMember[]): string {
  const lines = members.map((mem) => `  ${mem.name}: ${String(mem.value)},`);
  return (
    `export const ${name} = {\n${lines.join('\n')}\n} as const;\n` +
    `export type ${name} = (typeof ${name})[keyof typeof ${name}];\n`
  );
}

function renderField(field: TunerField): string {
  return (
    `{ offset: ${String(field.offset)}, width: ${String(field.width)}, ` +
    `signed: ${String(field.signed)}, scale: ${String(field.scale)} }`
  );
}

/** Deterministic, prettier-free (`.gen.ts` is prettier-ignored) TS source. */
export function renderConstants(c: NativeConstants): string {
  const soundNames = c.soundNames.map((n) => `'${n}'`).join(', ');
  return `// GENERATED — DO NOT EDIT. Owner: native/audio_core (SPEC §13.7).
// Regenerate: pnpm --filter @kitbag/core-native generate
// Verify (CI drift guard): pnpm --filter @kitbag/core-native generate:check
//
// Every value here is extracted from the engine's own source, never retyped.
// Hand-edits are reverted by the next regenerate and fail generate:check.

/** Max beats a single measured grid may carry (KB_MAX_GRID_BEATS). */
export const KB_MAX_GRID_BEATS = ${String(c.maxGridBeats)};

/** Mixer track count (Mixer::kMaxTracks, SPEC §7.4). */
export const KB_MAX_TRACKS = ${String(c.maxTracks)};

/**
 * Metronome sound ids, indexed by native sound id (SPEC §5.3, §13.7). Lowercase
 * engine tokens; display casing is a §12 concern, not an engine constant.
 */
export const KB_SOUND_NAMES = [${soundNames}] as const;
export type KbSoundName = (typeof KB_SOUND_NAMES)[number];

/** kb_result codes. */
${renderEnum('KB_RESULT', c.result)}
/** kb_accent enum. */
${renderEnum('KB_ACCENT', c.accent)}
/** Metronome output-latency offset range, in ms (kb_metronome_set_latency_offset). */
export const KB_LATENCY_OFFSET_MS_BOUNDS = {
  min: ${String(c.latencyOffsetMsBounds.min)},
  max: ${String(c.latencyOffsetMsBounds.max)},
} as const;

/** Bar-phase range for the beat sweep (kb_metronome_bar_phase). */
export const KB_BAR_PHASE_BOUNDS = {
  min: ${String(c.barPhaseBounds.min)},
  max: ${String(c.barPhaseBounds.max)},
  maxExclusive: ${String(c.barPhaseBounds.maxExclusive)},
} as const;

/** One packed field of kb_tuner_snapshot. */
export interface KbTunerField {
  readonly offset: number;
  readonly width: number;
  readonly signed: boolean;
  readonly scale: number;
}

/**
 * kb_tuner_snapshot bit layout (SPEC §13.2). LSB-first packed fields; decode in
 * src/host/snapshot.ts reads these so it cannot drift from Tuner::PackSnapshot.
 */
export const KB_TUNER_SNAPSHOT_FIELDS = {
  note: ${renderField(c.tunerFields.note)},
  cents: ${renderField(c.tunerFields.cents)},
  confidence: ${renderField(c.tunerFields.confidence)},
} as const;
`;
}
