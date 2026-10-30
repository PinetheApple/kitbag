export interface Bounds {
  readonly min: number;
  readonly max: number;
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

export interface TunerFields {
  readonly note: TunerField;
  readonly cents: TunerField;
  readonly confidence: TunerField;
}

// Parsers throw rather than guess: a silently wrong constant is the
// sync_screen.dart:14 defect (SPEC §2.3, §13.7).
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

/**
 * `#define NAME <number>` from a C header, where the value may be negative in
 * parentheses (`(-1)`) or fractional (`0.95`). Anything else throws.
 */
export function parseDefineNumber(header: string, name: string): number {
  const match = new RegExp(
    `#define\\s+${name}\\s+(?:\\((-?\\d+(?:\\.\\d+)?)\\)|(-?\\d+(?:\\.\\d+)?))(?![\\w.])`,
  ).exec(header);
  if (match === null) fail(`#define ${name}`);
  return Number(match[1] ?? match[2]);
}

/** `static constexpr int NAME = <int>;` from a C++ header. */
export function parseConstexprInt(source: string, name: string): number {
  const match = new RegExp(
    `static\\s+constexpr\\s+int\\s+${name}\\s*=\\s*(-?\\d+)\\s*;`,
  ).exec(source);
  if (match === null) fail(`constexpr int ${name}`);
  return Number(match[1]);
}

/** `static|inline constexpr double NAME = <number>;` from a C++ header. */
export function parseConstexprDouble(source: string, name: string): number {
  const match = new RegExp(
    `(?:static|inline)\\s+constexpr\\s+double\\s+${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*;`,
  ).exec(source);
  if (match === null) fail(`constexpr double ${name}`);
  return Number(match[1]);
}

/** `static constexpr float NAME = <number>f;` from a C++ header. */
export function parseConstexprFloat(source: string, name: string): number {
  const match = new RegExp(
    `static\\s+constexpr\\s+float\\s+${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)f\\s*;`,
  ).exec(source);
  if (match === null) fail(`constexpr float ${name}`);
  return Number(match[1]);
}

/** `static constexpr int NAME[] = {a, kB, ...};`; named members resolve in `source`. */
export function parseConstexprIntArray(source: string, name: string): number[] {
  const match = new RegExp(
    `static\\s+constexpr\\s+int\\s+${name}\\s*\\[[^\\]]*\\]\\s*=\\s*\\{([^}]*)\\}`,
  ).exec(source);
  if (match === null) fail(`constexpr int ${name}[]`);
  const values = (match[1] ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (values.length === 0) fail(`integer members of ${name}[]`);
  return values.map((v) => {
    if (/^-?\d+$/.test(v)) return Number(v);
    const named = new RegExp(
      `static\\s+constexpr\\s+int\\s+${v}\\s*=\\s*(-?\\d+)\\s*;`,
    ).exec(source);
    if (named === null) fail(`integer member ${v} of ${name}[]`);
    return Number(named[1]);
  });
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
export function parseTunerFields(apiHeader: string): TunerFields {
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
