import type { AnalysisResultRecord } from '@kitbag/core-db';
import type { AnalysisResult } from '@kitbag/core-native';

function knownLength(durationSec: number) {
  return Number.isFinite(durationSec) && durationSec > 0;
}

export function resultRecord(result: AnalysisResult): AnalysisResultRecord {
  const filePath = result.relativePath;
  if (!result.ok) return { filePath, ok: false, error: result.error };
  return {
    filePath,
    ok: true,
    bpm: result.bpm > 0 ? result.bpm : null,
    beats: result.beats,
    downbeats: result.downbeats,
    waveformPath:
      result.waveformRelativePath === '' ? null : result.waveformRelativePath,
    durationSec: knownLength(result.durationSec) ? result.durationSec : null,
    analysisVersion: result.analysisVersion ?? null,
  };
}
