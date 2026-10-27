export const ANALYSIS_STATUS = {
  pending: 'pending',
  analyzing: 'analyzing',
  done: 'done',
  failed: 'failed',
} as const;

export type AnalysisStatus =
  (typeof ANALYSIS_STATUS)[keyof typeof ANALYSIS_STATUS];

export const ANALYSIS_STATUSES = Object.values(ANALYSIS_STATUS) as [
  AnalysisStatus,
  ...AnalysisStatus[],
];
