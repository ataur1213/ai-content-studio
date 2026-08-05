// =============================================================================
// Analysis Job Processor — Scene Detection, Silence Detection
// =============================================================================

import type {
  VideoJob,
  FFmpegOperation,
  FFmpegProgress,
  JobResult,
} from './types';
import type {
  SceneDetectionConfig,
  SceneDetectionResult,
  SilenceDetectionConfig,
} from '../ffmpeg/analyze';
import type { TimeRange, Timestamp } from '../ffmpeg/types';
import { VideoService } from '../video-service';

// Initialize Video Service (singleton)
let videoService: VideoService | null = null;

async function getVideoService(): Promise<VideoService> {
  if (!videoService) {
    videoService = new VideoService();
    await videoService.initialize();
  }
  return videoService;
}

// Progress callback type
type ProgressCallback = (progress: FFmpegProgress) => void;

// Type guards for metadata values
function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function getNumberMetadata(metadata: VideoJob['metadata'], key: string): number | undefined {
  if (!metadata) return undefined;
  const value = metadata[key];
  return isNumber(value) ? value : undefined;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export interface ViralMomentScoringWeights {
  readonly cut: number;
  readonly duration: number;
  readonly position: number;
}

export interface ViralMomentDetectionConfig {
  readonly topK?: number;
  readonly minDurationSec?: number;
  readonly maxDurationSec?: number;
  readonly preferredDurationSec?: number;
  readonly minScore?: number;
  readonly minGapSec?: number;
  readonly weights?: Partial<ViralMomentScoringWeights>;
}

export interface ViralMomentScoreBreakdown {
  readonly cutScore: number;
  readonly durationScore: number;
  readonly positionScore: number;
  readonly weightedScore: number;
}

export interface ViralMomentCandidate {
  readonly id: string;
  readonly range: TimeRange;
  readonly duration: number;
  readonly rank: number;
  readonly score: number;
  readonly breakdown: ViralMomentScoreBreakdown;
}

export interface ViralMomentDetectionResult {
  readonly inputPath: string;
  readonly duration: number;
  readonly config: Required<ViralMomentDetectionConfig> & { readonly weights: ViralMomentScoringWeights };
  readonly candidates: ReadonlyArray<ViralMomentCandidate>;
  readonly viralMoments: ReadonlyArray<ViralMomentCandidate>;
}

type ResolvedViralMomentDetectionConfig = Required<ViralMomentDetectionConfig> & { readonly weights: ViralMomentScoringWeights };

function normalizeWeights(raw: ViralMomentScoringWeights): ViralMomentScoringWeights {
  const sum = raw.cut + raw.duration + raw.position;
  if (!isFinite(sum) || sum <= 0) {
    return { cut: 0.65, duration: 0.25, position: 0.1 };
  }
  return {
    cut: raw.cut / sum,
    duration: raw.duration / sum,
    position: raw.position / sum,
  };
}

function resolveViralMomentConfig(config?: ViralMomentDetectionConfig): ResolvedViralMomentDetectionConfig {
  const defaults: ResolvedViralMomentDetectionConfig = {
    topK: 5,
    minDurationSec: 2,
    maxDurationSec: 15,
    preferredDurationSec: 6,
    minScore: 0.35,
    minGapSec: 0,
    weights: normalizeWeights({ cut: 0.65, duration: 0.25, position: 0.1 }),
  };

  if (!config) return defaults;

  const topK = Math.max(1, Math.floor(config.topK ?? defaults.topK));
  const minDurationSec = Math.max(0, config.minDurationSec ?? defaults.minDurationSec);
  const maxDurationSec = Math.max(minDurationSec, config.maxDurationSec ?? defaults.maxDurationSec);
  const preferredDurationSec = Math.max(0.1, config.preferredDurationSec ?? defaults.preferredDurationSec);
  const minScore = clampNumber(config.minScore ?? defaults.minScore, 0, 1);
  const minGapSec = Math.max(0, config.minGapSec ?? defaults.minGapSec);

  const rawWeights: ViralMomentScoringWeights = {
    cut: config.weights?.cut ?? defaults.weights.cut,
    duration: config.weights?.duration ?? defaults.weights.duration,
    position: config.weights?.position ?? defaults.weights.position,
  };

  return {
    topK,
    minDurationSec,
    maxDurationSec,
    preferredDurationSec,
    minScore,
    minGapSec,
    weights: normalizeWeights(rawWeights),
  };
}

function buildConfigFromMetadata(metadata: VideoJob['metadata']): ViralMomentDetectionConfig {
  return {
    topK: getNumberMetadata(metadata, 'viralTopK'),
    minDurationSec: getNumberMetadata(metadata, 'viralMinDurationSec'),
    maxDurationSec: getNumberMetadata(metadata, 'viralMaxDurationSec'),
    preferredDurationSec: getNumberMetadata(metadata, 'viralPreferredDurationSec'),
    minScore: getNumberMetadata(metadata, 'viralMinScore'),
    minGapSec: getNumberMetadata(metadata, 'viralMinGapSec'),
    weights: {
      cut: getNumberMetadata(metadata, 'viralCutWeight'),
      duration: getNumberMetadata(metadata, 'viralDurationWeight'),
      position: getNumberMetadata(metadata, 'viralPositionWeight'),
    },
  };
}

function scoreDuration(duration: number, preferred: number): number {
  const delta = Math.abs(duration - preferred);
  const score = 1 - delta / preferred;
  return clampNumber(score, 0, 1);
}

function scorePosition(midpoint: number, totalDuration: number): number {
  if (totalDuration <= 0) return 0;
  const t = clampNumber(midpoint / totalDuration, 0, 1);
  const score = 1 - Math.abs(t - 0.5) * 2;
  return clampNumber(score, 0, 1);
}

function findBoundaryCutScore(
  cuts: SceneDetectionResult['cuts'],
  segmentStart: Timestamp,
): number {
  const epsilon = 0.05;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestScore = 0;

  for (const c of cuts) {
    const score = c.score ?? 0;
    if (!isFinite(c.time) || !isFinite(score)) continue;
    const distance = Math.abs(c.time - segmentStart);
    if (distance <= epsilon) {
      return clampNumber(score, 0, 1);
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      bestScore = score;
    }
  }

  if (!isFinite(bestDistance) || bestDistance === Number.POSITIVE_INFINITY) return 0;
  if (bestDistance > 0.25) return 0;
  return clampNumber(bestScore, 0, 1);
}

function createCandidateId(range: TimeRange): string {
  const startMs = Math.max(0, Math.round(range.start * 1000));
  const endMs = Math.max(0, Math.round(range.end * 1000));
  return `vm_${startMs}_${endMs}`;
}

function scoreSegment(
  scene: SceneDetectionResult,
  range: TimeRange,
  cfg: ResolvedViralMomentDetectionConfig,
): Omit<ViralMomentCandidate, 'rank'> {
  const duration = Math.max(0, range.end - range.start);
  const midpoint = (range.start + range.end) / 2;

  const cutScore = range.start <= 0 ? 0 : findBoundaryCutScore(scene.cuts, range.start);
  const durationScore = scoreDuration(duration, cfg.preferredDurationSec);
  const positionScore = scorePosition(midpoint, scene.duration);

  const weightedScore =
    cfg.weights.cut * cutScore +
    cfg.weights.duration * durationScore +
    cfg.weights.position * positionScore;

  return {
    id: createCandidateId(range),
    range,
    duration,
    score: clampNumber(weightedScore, 0, 1),
    breakdown: {
      cutScore,
      durationScore,
      positionScore,
      weightedScore: clampNumber(weightedScore, 0, 1),
    },
  };
}

export function detectViralMomentsFromSceneDetection(
  scene: SceneDetectionResult,
  config?: ViralMomentDetectionConfig,
): ViralMomentDetectionResult {
  const cfg = resolveViralMomentConfig(config);

  const candidatesUnranked: Array<Omit<ViralMomentCandidate, 'rank'>> = [];
  for (const range of scene.segments) {
    const duration = range.end - range.start;
    if (!isFinite(duration)) continue;
    if (duration < cfg.minDurationSec) continue;
    if (duration > cfg.maxDurationSec) continue;
    candidatesUnranked.push(scoreSegment(scene, range, cfg));
  }

  candidatesUnranked.sort((a, b) => b.score - a.score);

  const candidates: ViralMomentCandidate[] = candidatesUnranked.map((c, idx) => ({
    ...c,
    rank: idx + 1,
  }));

  const eligible = candidates.filter((c) => c.score >= cfg.minScore);

  const selected: ViralMomentCandidate[] = [];
  for (const candidate of eligible) {
    if (selected.length >= cfg.topK) break;
    if (cfg.minGapSec <= 0) {
      selected.push(candidate);
      continue;
    }

    const candidateMid = (candidate.range.start + candidate.range.end) / 2;
    const tooClose = selected.some((s) => {
      const mid = (s.range.start + s.range.end) / 2;
      return Math.abs(mid - candidateMid) < cfg.minGapSec;
    });

    if (!tooClose) {
      selected.push(candidate);
    }
  }

  return {
    inputPath: scene.inputPath,
    duration: scene.duration,
    config: cfg,
    candidates,
    viralMoments: selected,
  };
}

export interface AutoClipExtractionConfig {
  readonly topK?: number;
  readonly minDurationSec?: number;
  readonly maxDurationSec?: number;
  readonly targetDurationSec?: number;
  readonly minGapSec?: number;
}

export interface AutoClip {
  readonly id: string;
  readonly sourceViralMomentId: string;
  readonly range: TimeRange;
  readonly duration: number;
  readonly score: number;
}

export interface AutoClipExtractionResult {
  readonly inputPath: string;
  readonly duration: number;
  readonly config: Required<AutoClipExtractionConfig>;
  readonly clips: ReadonlyArray<AutoClip>;
}

type ResolvedAutoClipExtractionConfig = Required<AutoClipExtractionConfig>;

function resolveAutoClipConfig(config?: AutoClipExtractionConfig): ResolvedAutoClipExtractionConfig {
  const defaults: ResolvedAutoClipExtractionConfig = {
    topK: 5,
    minDurationSec: 3,
    maxDurationSec: 15,
    targetDurationSec: 8,
    minGapSec: 0,
  };

  if (!config) return defaults;

  const topK = Math.max(1, Math.floor(config.topK ?? defaults.topK));
  const minDurationSec = Math.max(0, config.minDurationSec ?? defaults.minDurationSec);
  const maxDurationSec = Math.max(minDurationSec, config.maxDurationSec ?? defaults.maxDurationSec);
  const targetDurationSec = clampNumber(config.targetDurationSec ?? defaults.targetDurationSec, minDurationSec, maxDurationSec);
  const minGapSec = Math.max(0, config.minGapSec ?? defaults.minGapSec);

  return {
    topK,
    minDurationSec,
    maxDurationSec,
    targetDurationSec,
    minGapSec,
  };
}

function buildAutoClipConfigFromMetadata(metadata: VideoJob['metadata']): AutoClipExtractionConfig {
  return {
    topK: getNumberMetadata(metadata, 'autoClipTopK'),
    minDurationSec: getNumberMetadata(metadata, 'autoClipMinDurationSec'),
    maxDurationSec: getNumberMetadata(metadata, 'autoClipMaxDurationSec'),
    targetDurationSec: getNumberMetadata(metadata, 'autoClipTargetDurationSec'),
    minGapSec: getNumberMetadata(metadata, 'autoClipMinGapSec'),
  };
}

function clampRange(range: TimeRange, duration: number): TimeRange {
  const start = clampNumber(range.start, 0, duration);
  const end = clampNumber(range.end, 0, duration);
  if (end <= start) {
    return { start, end: start };
  }
  return { start, end };
}

function fitRangeToDuration(
  midpoint: Timestamp,
  targetDurationSec: number,
  totalDurationSec: number,
): TimeRange {
  const half = targetDurationSec / 2;
  let start = midpoint - half;
  let end = midpoint + half;

  if (start < 0) {
    end = Math.min(totalDurationSec, end + (-start));
    start = 0;
  }

  if (end > totalDurationSec) {
    const overflow = end - totalDurationSec;
    start = Math.max(0, start - overflow);
    end = totalDurationSec;
  }

  return clampRange({ start, end }, totalDurationSec);
}

function rangesOverlap(a: TimeRange, b: TimeRange, gapSec: number): boolean {
  const aStart = a.start - gapSec;
  const aEnd = a.end + gapSec;
  const bStart = b.start - gapSec;
  const bEnd = b.end + gapSec;
  return aStart < bEnd && aEnd > bStart;
}

function createClipId(range: TimeRange): string {
  const startMs = Math.max(0, Math.round(range.start * 1000));
  const endMs = Math.max(0, Math.round(range.end * 1000));
  return `clip_${startMs}_${endMs}`;
}

export function extractAutoClipsFromViralMoments(
  viralMoments: ViralMomentDetectionResult,
  config?: AutoClipExtractionConfig,
): AutoClipExtractionResult {
  const cfg = resolveAutoClipConfig(config);
  const total = viralMoments.duration;

  const sorted = [...viralMoments.viralMoments].sort((a, b) => b.score - a.score);

  const selected: AutoClip[] = [];
  for (const moment of sorted) {
    if (selected.length >= cfg.topK) break;

    const midpoint = (moment.range.start + moment.range.end) / 2;
    const baseDuration = moment.range.end - moment.range.start;
    const desiredDuration = clampNumber(baseDuration, cfg.minDurationSec, cfg.maxDurationSec);
    const targetDuration = clampNumber(cfg.targetDurationSec, cfg.minDurationSec, cfg.maxDurationSec);
    const finalDuration = Math.abs(desiredDuration - targetDuration) < 1e-9 ? desiredDuration : targetDuration;

    const range = fitRangeToDuration(midpoint, finalDuration, total);
    const duration = range.end - range.start;

    if (!isFinite(duration) || duration < cfg.minDurationSec || duration > cfg.maxDurationSec) {
      continue;
    }

    const overlaps = selected.some((s) => rangesOverlap(range, s.range, cfg.minGapSec));
    if (overlaps) {
      continue;
    }

    selected.push({
      id: createClipId(range),
      sourceViralMomentId: moment.id,
      range,
      duration,
      score: moment.score,
    });
  }

  selected.sort((a, b) => a.range.start - b.range.start);

  return {
    inputPath: viralMoments.inputPath,
    duration: viralMoments.duration,
    config: cfg,
    clips: selected,
  };
}

async function executeDetectScenes(
  job: VideoJob,
  onProgress?: ProgressCallback,
): Promise<JobResult> {
  const service = await getVideoService();
  const startTime = Date.now();

  const inputPath = job.inputs[0]?.path;
  if (!inputPath) {
    throw new Error('No input provided for detect-scenes');
  }

  const threshold =
    getNumberMetadata(job.metadata, 'threshold') ??
    getNumberMetadata(job.metadata, 'sceneThreshold');
  const minSceneDurationSec =
    getNumberMetadata(job.metadata, 'minSceneDurationSec') ??
    getNumberMetadata(job.metadata, 'minSceneDuration');

  onProgress?.({ percentage: 0 });

  const sceneConfig: SceneDetectionConfig = {
    inputPath,
    threshold,
    minSceneDurationSec,
    timeoutMs: job.timeout * 1000,
  };

  const sceneResult = await service.detectScenes(sceneConfig);

  onProgress?.({ percentage: 70 });

  const viralConfig = buildConfigFromMetadata(job.metadata);
  const viralMoments = detectViralMomentsFromSceneDetection(sceneResult, viralConfig);
  const autoClipConfig = buildAutoClipConfigFromMetadata(job.metadata);
  const autoClips = extractAutoClipsFromViralMoments(viralMoments, autoClipConfig);

  onProgress?.({ percentage: 100 });

  return {
    outputPaths: [sceneResult.inputPath],
    processingDuration: Date.now() - startTime,
    metadata: {
      scenes: sceneResult,
      viralMoments,
      autoClips,
    },
  };
}

async function executeDetectSilence(
  job: VideoJob,
  onProgress?: ProgressCallback,
): Promise<JobResult> {
  const service = await getVideoService();
  const startTime = Date.now();

  const inputPath = job.inputs[0]?.path;
  if (!inputPath) {
    throw new Error('No input provided for detect-silence');
  }

  const noiseDb =
    getNumberMetadata(job.metadata, 'noiseDb') ??
    getNumberMetadata(job.metadata, 'silenceNoiseDb');
  const minSilenceDurationSec =
    getNumberMetadata(job.metadata, 'minSilenceDurationSec') ??
    getNumberMetadata(job.metadata, 'minSilenceDuration');

  onProgress?.({ percentage: 0 });

  const silenceConfig: SilenceDetectionConfig = {
    inputPath,
    noiseDb,
    minSilenceDurationSec,
    timeoutMs: job.timeout * 1000,
  };

  const silenceResult = await service.detectSilence(silenceConfig);

  onProgress?.({ percentage: 100 });

  return {
    outputPaths: [silenceResult.inputPath],
    processingDuration: Date.now() - startTime,
    metadata: {
      silence: silenceResult,
    },
  };
}

// =============================================================================
// Export Analysis Operations
// =============================================================================
export async function executeOperation(
  job: VideoJob,
  onProgress?: ProgressCallback
): Promise<JobResult> {
  const operation: FFmpegOperation = job.operation;

  switch (operation) {
    case 'detect-scenes': {
      return await executeDetectScenes(job, onProgress);
    }
    case 'detect-silence': {
      return await executeDetectSilence(job, onProgress);
    }
    default:
      throw new Error(`Operation ${operation} not implemented yet`);
  }
}

export { getVideoService };
