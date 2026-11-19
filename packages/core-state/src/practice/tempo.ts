export interface TempoAverage {
  readonly bpmMs: number;
  readonly ms: number;
  readonly bpm: number;
  readonly sampledAt: number | null;
}

export function startAverage(at: number, bpm: number): TempoAverage {
  return { bpmMs: 0, ms: 0, bpm, sampledAt: at };
}

export function sampled(
  tempo: TempoAverage,
  at: number,
  bpm: number,
): TempoAverage {
  if (tempo.sampledAt === null) return { ...tempo, bpm, sampledAt: at };
  const elapsed = Math.max(0, at - tempo.sampledAt);
  return {
    bpmMs: tempo.bpmMs + tempo.bpm * elapsed,
    ms: tempo.ms + elapsed,
    bpm,
    sampledAt: at,
  };
}

export function averageBpm(tempo: TempoAverage): number {
  return tempo.ms > 0 ? tempo.bpmMs / tempo.ms : tempo.bpm;
}
