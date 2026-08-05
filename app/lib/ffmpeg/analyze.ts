import { spawn } from 'child_process';
import * as path from 'path';

import type {
  FFmpegContext,
  FFmpegError,
  FilePath,
  RenderConfig,
  RenderResult,
  RenderProgressCallback,
  TimeRange,
  Timestamp,
} from './types';
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  MAX_STDERR_BUFFER,
} from './constants';
import {
  ensureDir,
  fileExists,
  finiteOr,
  withRetry,
} from './utils';
import {
  probeDuration,
} from './probe';
import {
  render,
} from './render';

export interface SceneDetectionConfig {
  readonly inputPath: FilePath;
  readonly threshold?: number;
  readonly minSceneDurationSec?: number;
  readonly timeoutMs?: number;
}

export interface SceneCut {
  readonly time: Timestamp;
  readonly score: number | null;
}

export interface SceneDetectionResult {
  readonly inputPath: FilePath;
  readonly duration: number;
  readonly threshold: number;
  readonly minSceneDurationSec: number;
  readonly cuts: ReadonlyArray<SceneCut>;
  readonly segments: ReadonlyArray<TimeRange>;
}

export interface SilenceDetectionConfig {
  readonly inputPath: FilePath;
  readonly noiseDb?: number;
  readonly minSilenceDurationSec?: number;
  readonly timeoutMs?: number;
}

export interface SilenceInterval {
  readonly start: Timestamp;
  readonly end: Timestamp;
  readonly duration: number;
}

export interface SilenceDetectionResult {
  readonly inputPath: FilePath;
  readonly duration: number;
  readonly noiseDb: number;
  readonly minSilenceDurationSec: number;
  readonly silences: ReadonlyArray<SilenceInterval>;
  readonly nonSilence: ReadonlyArray<TimeRange>;
}

export class FFmpegAnalyzeError extends Error implements FFmpegError {
  public readonly code: string;
  public readonly stderr: string;
  public readonly exitCode: number | null;
  public readonly command: string[];
  public readonly timestamp: number;

  constructor(
    message: string,
    code: string,
    stderr: string,
    command: string[],
    exitCode: number | null = null,
    timestamp?: number,
  ) {
    super(message);
    this.name = 'FFmpegAnalyzeError';
    this.code = code;
    this.stderr = stderr;
    this.exitCode = exitCode;
    this.command = command;
    this.timestamp = timestamp ?? Date.now();
    Object.setPrototypeOf(this, FFmpegAnalyzeError.prototype);
  }
}

export async function detectScenes(
  config: SceneDetectionConfig,
  ctx: FFmpegContext,
): Promise<SceneDetectionResult> {
  const threshold = clampNumber(config.threshold ?? 0.4, 0, 1);
  const minSceneDurationSec = Math.max(0, finiteOr(config.minSceneDurationSec ?? 0.5, 0.5));
  const timeoutMs = Math.max(1, Math.floor(config.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS));

  const absPath = path.resolve(config.inputPath);
  if (!fileExists(absPath)) {
    throw createAnalyzeError(
      `File does not exist: ${absPath}`,
      'ANALYZE_NOT_FOUND',
      '',
      [ctx.ffmpegPath, '-i', absPath],
      null,
    );
  }

  return withRetry(
    async () => {
      const duration = finiteOr(await probeDuration(absPath, ctx), 0);
      if (duration <= 0) {
        throw createAnalyzeError(
          `Invalid media duration: ${duration}`,
          'ANALYZE_INVALID_DURATION',
          '',
          [ctx.ffmpegPath, '-i', absPath],
          null,
        );
      }

      const vf = `select='gt(scene\\,${threshold})',metadata=print:file=-`;
      const args = [
        '-hide_banner',
        '-nostdin',
        '-loglevel', 'info',
        '-i', absPath,
        '-an',
        '-vf', vf,
        '-f', 'null',
        '-',
      ];

      ctx.log('debug', `Executing scene detection: ${ctx.ffmpegPath} ${args.join(' ')}`, 'analyze.scenes');
      const proc = await spawnProcess(ctx.ffmpegPath, args, timeoutMs);

      const cutsRaw = parseSceneCuts(proc.stdout, proc.stderr);
      const cuts = normalizeCuts(cutsRaw, duration, minSceneDurationSec);

      return {
        inputPath: absPath,
        duration,
        threshold,
        minSceneDurationSec,
        cuts,
        segments: buildSegmentsFromCuts(duration, cuts),
      };
    },
    ctx.retryAttempts,
    ctx.retryDelayMs,
    'detectScenes',
    ctx.log,
  );
}

export async function detectSilence(
  config: SilenceDetectionConfig,
  ctx: FFmpegContext,
): Promise<SilenceDetectionResult> {
  const noiseDb = clampNumber(config.noiseDb ?? -30, -120, 0);
  const minSilenceDurationSec = Math.max(0, finiteOr(config.minSilenceDurationSec ?? 0.4, 0.4));
  const timeoutMs = Math.max(1, Math.floor(config.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS));

  const absPath = path.resolve(config.inputPath);
  if (!fileExists(absPath)) {
    throw createAnalyzeError(
      `File does not exist: ${absPath}`,
      'ANALYZE_NOT_FOUND',
      '',
      [ctx.ffmpegPath, '-i', absPath],
      null,
    );
  }

  return withRetry(
    async () => {
      const duration = finiteOr(await probeDuration(absPath, ctx), 0);
      if (duration <= 0) {
        throw createAnalyzeError(
          `Invalid media duration: ${duration}`,
          'ANALYZE_INVALID_DURATION',
          '',
          [ctx.ffmpegPath, '-i', absPath],
          null,
        );
      }

      const af = `silencedetect=noise=${noiseDb}dB:d=${minSilenceDurationSec}`;
      const args = [
        '-hide_banner',
        '-nostdin',
        '-loglevel', 'info',
        '-i', absPath,
        '-vn',
        '-af', af,
        '-f', 'null',
        '-',
      ];

      ctx.log('debug', `Executing silence detection: ${ctx.ffmpegPath} ${args.join(' ')}`, 'analyze.silence');
      const proc = await spawnProcess(ctx.ffmpegPath, args, timeoutMs);

      const silences = normalizeSilences(parseSilenceIntervals(proc.stderr), duration);

      return {
        inputPath: absPath,
        duration,
        noiseDb,
        minSilenceDurationSec,
        silences,
        nonSilence: invertIntervals(duration, silences),
      };
    },
    ctx.retryAttempts,
    ctx.retryDelayMs,
    'detectSilence',
    ctx.log,
  );
}

export interface ClipRange {
  readonly id: string;
  readonly range: TimeRange;
}

export interface ClipRenderConfig {
  readonly inputPath: FilePath;
  readonly clips: ReadonlyArray<ClipRange>;
  readonly outputDir: FilePath;
  readonly filenameTemplate?: string;
  readonly renderConfig: Omit<RenderConfig, 'outputPath' | 'startTime' | 'duration'>;
  readonly minDurationSec?: number;
  readonly maxDurationSec?: number;
  readonly preventOverlap?: boolean;
}

export interface ClipRenderItemResult {
  readonly clip: ClipRange;
  readonly outputPath: FilePath;
  readonly render: RenderResult;
}

export interface ClipRenderBatchResult {
  readonly inputPath: FilePath;
  readonly duration: number;
  readonly success: boolean;
  readonly results: ReadonlyArray<ClipRenderItemResult>;
  readonly renderTimeMs: number;
}

export async function renderClipsFromRanges(
  config: ClipRenderConfig,
  ctx: FFmpegContext,
  onProgress?: RenderProgressCallback,
): Promise<ClipRenderBatchResult> {
  const startTime = Date.now();
  const absPath = path.resolve(config.inputPath);

  if (!fileExists(absPath)) {
    throw createAnalyzeError(
      `File does not exist: ${absPath}`,
      'CLIP_RENDER_NOT_FOUND',
      '',
      [ctx.ffmpegPath, '-i', absPath],
      null,
    );
  }

  const mediaDuration = finiteOr(await probeDuration(absPath, ctx), 0);
  if (mediaDuration <= 0) {
    throw createAnalyzeError(
      `Invalid media duration: ${mediaDuration}`,
      'CLIP_RENDER_INVALID_DURATION',
      '',
      [ctx.ffmpegPath, '-i', absPath],
      null,
    );
  }

  ensureDir(config.outputDir);

  const minDurationSec = Math.max(0, finiteOr(config.minDurationSec ?? 0, 0));
  const maxDurationSec = Math.max(minDurationSec, finiteOr(config.maxDurationSec ?? mediaDuration, mediaDuration));
  const preventOverlap = config.preventOverlap ?? true;

  const normalized = config.clips.map((c) => {
    const start = clampNumber(finiteOr(c.range.start, 0), 0, mediaDuration);
    const end = clampNumber(finiteOr(c.range.end, 0), 0, mediaDuration);
    const range: TimeRange = end >= start ? { start, end } : { start: end, end: start };
    const duration = range.end - range.start;
    if (!isFinite(duration) || duration <= 0) {
      throw createAnalyzeError(
        `Invalid clip duration: ${duration}`,
        'CLIP_RENDER_INVALID_CLIP',
        '',
        [],
        null,
      );
    }
    if (duration < minDurationSec || duration > maxDurationSec) {
      throw createAnalyzeError(
        `Clip duration out of bounds: ${duration}s (min=${minDurationSec}s max=${maxDurationSec}s)`,
        'CLIP_RENDER_DURATION_OUT_OF_BOUNDS',
        '',
        [],
        null,
      );
    }
    return { clip: c, range, duration };
  });

  if (preventOverlap) {
    const sorted = [...normalized].sort((a, b) => a.range.start - b.range.start);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (cur.range.start < prev.range.end) {
        throw createAnalyzeError(
          `Overlapping clip ranges: [${prev.range.start}, ${prev.range.end}] overlaps [${cur.range.start}, ${cur.range.end}]`,
          'CLIP_RENDER_OVERLAP',
          '',
          [],
          null,
        );
      }
    }
  }

  const total = normalized.length;
  if (total === 0) {
    return {
      inputPath: absPath,
      duration: mediaDuration,
      success: true,
      results: [],
      renderTimeMs: Date.now() - startTime,
    };
  }

  const formatExt = String(config.renderConfig.format);
  const ext = formatExt.startsWith('.') ? formatExt : `.${formatExt}`;
  const template = (config.filenameTemplate ?? '{id}' + ext).trim();

  const safeId = (raw: string): string => raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  const buildOutputPath = (clipId: string): FilePath => {
    const filename = template.includes('{id}')
      ? template.replaceAll('{id}', safeId(clipId))
      : `${safeId(clipId)}${ext}`;
    return path.join(config.outputDir, filename);
  };

  const results: ClipRenderItemResult[] = [];
  let allSuccess = true;

  for (let index = 0; index < normalized.length; index++) {
    const item = normalized[index];
    const outputPath = buildOutputPath(item.clip.id);

    const perClipProgress: RenderProgressCallback | undefined = onProgress
      ? (p) => {
          const pct = p.percentage ?? 0;
          const overall = ((index + clampNumber(pct, 0, 100) / 100) / total) * 100;
          onProgress({
            ...p,
            percentage: clampNumber(overall, 0, 100),
          });
        }
      : undefined;

    const clipRenderConfig: RenderConfig = {
      ...config.renderConfig,
      outputPath,
      startTime: item.range.start,
      duration: item.duration,
    };

    const renderResult = await render(absPath, clipRenderConfig, ctx, perClipProgress);
    if (!renderResult.success) {
      allSuccess = false;
    }

    results.push({
      clip: { ...item.clip, range: item.range },
      outputPath,
      render: renderResult,
    });
  }

  return {
    inputPath: absPath,
    duration: mediaDuration,
    success: allSuccess,
    results,
    renderTimeMs: Date.now() - startTime,
  };
}

function spawnProcess(
  binary: FilePath,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutSize = 0;
    let stderrSize = 0;

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdoutSize < MAX_STDERR_BUFFER) {
        stdoutChunks.push(chunk);
        stdoutSize += chunk.length;
      } else {
        child.stdout?.destroy();
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderrSize < MAX_STDERR_BUFFER) {
        stderrChunks.push(chunk);
        stderrSize += chunk.length;
      } else {
        child.stderr?.destroy();
      }
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');

      if (code !== 0 && code !== null) {
        reject(
          createAnalyzeError(
            `Process exited with code ${code}`,
            'ANALYZE_EXIT_ERROR',
            stderr,
            [binary, ...args],
            code,
          )
        );
        return;
      }

      resolve({ stdout, stderr, exitCode: code });
    });
  });
}

function parseSceneCuts(stdout: string, stderr: string): SceneCut[] {
  const fromMeta = parseSceneCutsFromMetadata(stdout);
  if (fromMeta.length > 0) return fromMeta;
  return parseSceneCutsFromShowInfo(stderr);
}

function parseSceneCutsFromMetadata(stdout: string): SceneCut[] {
  const lines = stdout.split(/\r?\n/);
  const results: SceneCut[] = [];
  let currentTime: number | null = null;
  let currentScore: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;

    const ptsMatch = /pts_time:([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (ptsMatch) {
      currentTime = parseFloat(ptsMatch[1]);
      currentScore = null;
      continue;
    }

    const scoreMatch = /lavfi\.scene_score=([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (scoreMatch && currentTime !== null) {
      currentScore = parseFloat(scoreMatch[1]);
      const time = finiteOr(currentTime, -1);
      const score = finiteOr(currentScore, -1);
      if (time >= 0) {
        results.push({ time, score: score >= 0 ? score : null });
      }
      currentTime = null;
      currentScore = null;
      continue;
    }
  }

  return results;
}

function parseSceneCutsFromShowInfo(stderr: string): SceneCut[] {
  const lines = stderr.split(/\r?\n/);
  const results: SceneCut[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (!line.includes('pts_time:')) continue;
    const m = /pts_time:([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (!m) continue;
    const time = finiteOr(parseFloat(m[1]), -1);
    if (time >= 0) {
      results.push({ time, score: null });
    }
  }

  return results;
}

function normalizeCuts(
  cuts: ReadonlyArray<SceneCut>,
  duration: number,
  minSceneDurationSec: number,
): SceneCut[] {
  const sorted = [...cuts]
    .map((c) => ({ time: finiteOr(c.time, -1), score: c.score === null ? null : finiteOr(c.score, -1) }))
    .filter((c) => c.time > 0 && c.time < duration && isFinite(c.time))
    .sort((a, b) => a.time - b.time);

  const out: SceneCut[] = [];
  let lastCut = 0;
  for (const c of sorted) {
    if (c.time - lastCut < minSceneDurationSec) continue;
    out.push({ time: c.time, score: c.score !== null && c.score >= 0 ? c.score : null });
    lastCut = c.time;
  }
  return out;
}

function buildSegmentsFromCuts(
  duration: number,
  cuts: ReadonlyArray<SceneCut>,
): TimeRange[] {
  const points = [0, ...cuts.map(c => c.time), duration]
    .map((t) => finiteOr(t, 0))
    .filter((t) => t >= 0 && t <= duration)
    .sort((a, b) => a - b);

  const segments: TimeRange[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end > start) {
      segments.push({ start, end });
    }
  }
  return segments;
}

function parseSilenceIntervals(stderr: string): Array<{ start: number; end: number | null; duration: number | null }> {
  const lines = stderr.split(/\r?\n/);
  const intervals: Array<{ start: number; end: number | null; duration: number | null }> = [];
  let currentStart: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;

    const startMatch = /silence_start:\s*([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (startMatch) {
      currentStart = finiteOr(parseFloat(startMatch[1]), -1);
      if (currentStart >= 0) {
        intervals.push({ start: currentStart, end: null, duration: null });
      } else {
        currentStart = null;
      }
      continue;
    }

    const endMatch = /silence_end:\s*([0-9]+(?:\.[0-9]+)?)\s*\|\s*silence_duration:\s*([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (endMatch) {
      const end = finiteOr(parseFloat(endMatch[1]), -1);
      const dur = finiteOr(parseFloat(endMatch[2]), -1);

      const last = intervals.length > 0 ? intervals[intervals.length - 1] : null;
      if (last && last.end === null && last.duration === null) {
        last.end = end >= 0 ? end : null;
        last.duration = dur >= 0 ? dur : null;
      }
      currentStart = null;
      continue;
    }
  }

  return intervals;
}

function normalizeSilences(
  intervals: Array<{ start: number; end: number | null; duration: number | null }>,
  duration: number,
): SilenceInterval[] {
  const normalized: SilenceInterval[] = [];
  for (const i of intervals) {
    const start = finiteOr(i.start, -1);
    const end = i.end === null ? duration : finiteOr(i.end, -1);
    if (start < 0 || end < 0) continue;
    if (end <= start) continue;
    if (start > duration) continue;
    const clampedStart = clampNumber(start, 0, duration);
    const clampedEnd = clampNumber(end, 0, duration);
    const dur = finiteOr(i.duration ?? (clampedEnd - clampedStart), clampedEnd - clampedStart);
    normalized.push({ start: clampedStart, end: clampedEnd, duration: Math.max(0, dur) });
  }

  normalized.sort((a, b) => a.start - b.start);

  const merged: SilenceInterval[] = [];
  for (const cur of normalized) {
    const last = merged.length > 0 ? merged[merged.length - 1] : null;
    if (!last) {
      merged.push(cur);
      continue;
    }
    if (cur.start <= last.end) {
      const end = Math.max(last.end, cur.end);
      const start = last.start;
      merged[merged.length - 1] = { start, end, duration: Math.max(0, end - start) };
      continue;
    }
    merged.push(cur);
  }

  return merged;
}

function invertIntervals(duration: number, intervals: ReadonlyArray<SilenceInterval>): TimeRange[] {
  const ranges: TimeRange[] = [];
  let cursor = 0;

  for (const i of intervals) {
    if (i.start > cursor) {
      ranges.push({ start: cursor, end: i.start });
    }
    cursor = Math.max(cursor, i.end);
  }
  if (cursor < duration) {
    ranges.push({ start: cursor, end: duration });
  }
  return ranges;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function createAnalyzeError(
  message: string,
  code: string,
  stderr: string,
  command: string[],
  exitCode: number | null,
): FFmpegAnalyzeError {
  return new FFmpegAnalyzeError(
    message,
    code,
    stderr.slice(0, MAX_STDERR_BUFFER),
    command,
    exitCode,
  );
}
