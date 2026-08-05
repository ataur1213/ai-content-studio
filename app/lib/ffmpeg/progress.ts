// =============================================================================
// AI Video Generator — FFmpeg Engine Progress Parser
// =============================================================================
// Parses FFmpeg stderr output in real-time to extract rendering progress.
// Zero file system dependencies — purely string-based parsing.
// Depends on types.ts, constants.ts, utils.ts (Layer 0-2).
// =============================================================================

import type {
  RenderProgress,
  RenderStatus,
  Timestamp,
} from './types';
import {
  PROGRESS_REGEX,
  DURATION_REGEX,
} from './constants';
import {
  parseTime,
} from './utils';

// =============================================================================
// Local Types (Internal to Progress Parser)
// =============================================================================

/** Raw parsed data from a single FFmpeg progress line (before tracker enrichment). */
interface ParsedProgressLine {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSizeKb: number;
  timemark: string;
  percentage: number;
  speed: number;
}

// =============================================================================
// Internal State
// =============================================================================

/** Internal progress tracker state for a single FFmpeg process. */
export interface ProgressTracker {
  /** Total duration of the output in seconds (parsed from input or estimated). */
  totalDuration: number;
  /** Last parsed progress snapshot. */
  lastProgress: RenderProgress;
  /** Raw stderr buffer for debugging. */
  stderrBuffer: string[];
  /** Maximum buffer size before old lines are dropped. */
  maxBufferSize: number;
  /** Whether the process has emitted at least one frame line. */
  started: boolean;
  /** Timestamp when the first frame was parsed. */
  startTimeMs: number;
}

/**
 * Create a new progress tracker instance.
 * @param totalDuration - Expected output duration in seconds. If 0, percentage will be estimated from speed.
 */
export function createProgressTracker(totalDuration: number = 0): ProgressTracker {
  return {
    totalDuration,
    lastProgress: createEmptyProgress(),
    stderrBuffer: [],
    maxBufferSize: 1000,
    started: false,
    startTimeMs: 0,
  };
}

/** Create an empty/zeroed progress object. */
export function createEmptyProgress(): RenderProgress {
  return {
    frames: 0,
    currentFps: 0,
    currentKbps: 0,
    targetSizeKb: 0,
    timemark: '00:00:00.00',
    percentage: 0,
    speed: 0,
    status: 'idle',
    estimatedTimeRemainingMs: null,
  };
}

// =============================================================================
// FFmpeg Stderr Line Parsing
// =============================================================================

/**
 * Parse a single line of FFmpeg stderr output.
 * Returns a partial ParsedProgressLine if the line contains progress data, or null.
 */
export function parseProgressLine(line: string): ParsedProgressLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const match = trimmed.match(PROGRESS_REGEX);
  if (!match) return null;

  const frames = parseInt(match[1].trim(), 10) || 0;
  const fps = parseFloat(match[2].trim()) || 0;
  const sizeStr = match[4].trim();
  const timemark = match[5].trim();
  const bitrateStr = match[6].trim();
  const speedStr = match[7].trim();

  // Parse size string (e.g., "1024kB", "5.2MB")
  const targetSizeKb = parseSizeToKb(sizeStr);

  // Parse bitrate string (e.g., "1256.2kbits/s")
  const currentKbps = parseBitrateToKbps(bitrateStr);

  // Parse speed string (e.g., "1.2x", "2.5x")
  const speed = parseSpeed(speedStr);

  return {
    frames,
    currentFps: fps,
    currentKbps,
    targetSizeKb,
    timemark,
    percentage: 0, // Calculated later by tracker
    speed,
  };
}

/**
 * Parse an FFmpeg stderr line to extract total duration.
 * This appears near the start of processing.
 */
export function parseDurationLine(line: string): Timestamp | null {
  const match = line.match(DURATION_REGEX);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const centis = match[4].length === 2
    ? parseInt(match[4], 10) / 100
    : parseInt(match[4].slice(0, 2), 10) / 100;

  return hours * 3600 + minutes * 60 + seconds + centis;
}

// =============================================================================
// Size / Bitrate / Speed Parsers
// =============================================================================

/** Parse a human-readable size string to kilobytes. */
function parseSizeToKb(sizeStr: string): number {
  const str = sizeStr.trim().toLowerCase();
  if (!str) return 0;

  const numMatch = str.match(/^([\d.]+)(kb|mb|gb|b)?$/);
  if (!numMatch) return 0;

  const value = parseFloat(numMatch[1]);
  if (!isFinite(value)) return 0;

  const unit = numMatch[2] || 'b';
  switch (unit) {
    case 'gb': return value * 1024 * 1024;
    case 'mb': return value * 1024;
    case 'kb': return value;
    case 'b':  return value / 1024;
    default:   return 0;
  }
}

/** Parse a bitrate string like "1256.2kbits/s" to kbps. */
function parseBitrateToKbps(bitrateStr: string): number {
  const str = bitrateStr.trim().toLowerCase().replace(/\s*/g, '');
  if (!str) return 0;

  // Match patterns like "1256.2kbits/s" or "1.2mbits/s"
  const match = str.match(/^([\d.]+)\s*(kbits|mbits|bits)?\/?s?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  if (!isFinite(value)) return 0;

  const unit = match[2] || 'kbits';
  switch (unit) {
    case 'mbits': return value * 1024;
    case 'kbits': return value;
    case 'bits':  return value / 1024;
    default:      return 0;
  }
}

/** Parse a speed string like "1.2x" or "N/A" to a multiplier. */
function parseSpeed(speedStr: string): number {
  const str = speedStr.trim().toLowerCase();
  if (!str || str === 'n/a') return 0;

  const match = str.match(/^([\d.]+)x?$/);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  return isFinite(value) ? value : 0;
}

// =============================================================================
// Progress Tracker Update
// =============================================================================

/**
 * Feed a chunk of stderr data to the progress tracker.
 * Parses lines, updates internal state, and returns the latest progress
 * only if it changed from the previous update.
 */
export function updateTracker(
  tracker: ProgressTracker,
  chunk: string,
  status: RenderStatus,
): RenderProgress | null {
  // Split chunk into lines and buffer them
  const lines = chunk.split('\n');
  let changed = false;

  for (const line of lines) {
    // Buffer all lines for debugging
    tracker.stderrBuffer.push(line);
    if (tracker.stderrBuffer.length > tracker.maxBufferSize) {
      tracker.stderrBuffer.shift();
    }

    // Try to extract duration from early lines
    if (!tracker.started && tracker.totalDuration <= 0) {
      const dur = parseDurationLine(line);
      if (dur !== null && dur > 0) {
        tracker.totalDuration = dur;
      }
    }

    // Try to parse progress
    const parsed = parseProgressLine(line);
    if (parsed) {
      if (!tracker.started) {
        tracker.started = true;
        tracker.startTimeMs = Date.now();
      }

      // Calculate percentage
      const currentTime = parseTime(parsed.timemark);
      if (tracker.totalDuration > 0) {
        parsed.percentage = Math.min(100, (currentTime / tracker.totalDuration) * 100);
      }

      // Estimate remaining time
      const elapsedMs = Date.now() - tracker.startTimeMs;
      let estimatedTimeRemainingMs: number | null = null;
      if (parsed.percentage > 0 && parsed.speed > 0 && elapsedMs > 500) {
        const remainingFraction = (100 - parsed.percentage) / parsed.percentage;
        estimatedTimeRemainingMs = Math.round(elapsedMs * remainingFraction);
      }

      // Update tracker state
      tracker.lastProgress = {
        frames: parsed.frames,
        currentFps: parsed.currentFps,
        currentKbps: parsed.currentKbps,
        targetSizeKb: parsed.targetSizeKb,
        timemark: parsed.timemark,
        percentage: parsed.percentage,
        speed: parsed.speed,
        status,
        estimatedTimeRemainingMs,
      };

      changed = true;
    }
  }

  // Always update status even if no frame progress
  if (tracker.lastProgress.status !== status) {
    tracker.lastProgress.status = status;
    changed = true;
  }

  return changed ? { ...tracker.lastProgress } : null;
}

/**
 * Finalize the tracker after the process ends.
 * Sets status to the provided terminal status and ensures percentage is 100% on success.
 */
export function finalizeTracker(
  tracker: ProgressTracker,
  success: boolean,
): RenderProgress {
  const final: RenderProgress = {
    ...tracker.lastProgress,
    status: success ? 'completed' : 'failed',
    estimatedTimeRemainingMs: null,
  };

  if (success) {
    final.percentage = 100;
  }

  tracker.lastProgress = final;
  return { ...final };
}

// =============================================================================
// Progress Formatting
// =============================================================================

/** Format a progress object as a human-readable string. */
export function formatProgress(progress: RenderProgress): string {
  const pct = progress.percentage.toFixed(1).padStart(6);
  const fps = progress.currentFps.toFixed(1).padStart(6);
  const speed = progress.speed > 0 ? `${progress.speed.toFixed(2)}x` : '  N/A ';
  const time = progress.timemark;
  const size = progress.targetSizeKb > 1024
    ? `${(progress.targetSizeKb / 1024).toFixed(1)}MB`
    : `${progress.targetSizeKb.toFixed(0)}KB`;

  const eta = progress.estimatedTimeRemainingMs !== null
    ? `ETA ${formatEta(progress.estimatedTimeRemainingMs)}`
    : '';

  return `[${pct}%] fps=${fps} speed=${speed} time=${time} size=${size} ${eta}`.trim();
}

/** Format milliseconds into a human-readable ETA string. */
export function formatEta(ms: number): string {
  if (!isFinite(ms) || ms < 0) return 'N/A';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

// =============================================================================
// Progress Callback Utilities
// =============================================================================

/** Create a throttled progress callback that fires at most once per `intervalMs`. */
export function createThrottledCallback(
  callback: (progress: RenderProgress) => void,
  intervalMs: number = 500,
): (progress: RenderProgress) => void {
  let lastCallTime = 0;
  let pendingProgress: RenderProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (progress: RenderProgress) => {
    pendingProgress = progress;
    const now = Date.now();

    if (now - lastCallTime >= intervalMs) {
      // Enough time has passed — call immediately
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastCallTime = now;
      callback(progress);
      pendingProgress = null;
    } else if (!timer) {
      // Schedule a deferred call to ensure final progress isn't lost
      timer = setTimeout(() => {
        timer = null;
        lastCallTime = Date.now();
        if (pendingProgress) {
          callback(pendingProgress);
          pendingProgress = null;
        }
      }, intervalMs - (now - lastCallTime));
    }
  };
}

/** Create a no-op progress callback that discards all updates. */
export function createNoopProgressCallback(): (progress: RenderProgress) => void {
  return () => {
    // intentionally empty
  };
}

/** Create a logging progress callback that writes progress to console. */
export function createLoggingProgressCallback(
  log?: (level: string, message: string) => void,
): (progress: RenderProgress) => void {
  const logger = log ?? ((level: string, message: string) => {
    if (level === 'info') console.info(message);
    else if (level === 'debug') console.debug(message);
  });

  return (progress: RenderProgress) => {
    if (progress.status === 'completed' || progress.status === 'failed') return;
    logger('info', formatProgress(progress));
  };
}

// =============================================================================
// Error Detection from Stderr
// =============================================================================

/** Common FFmpeg error patterns in stderr. */
const ERROR_PATTERNS: ReadonlyArray<RegExp> = [
  /error/i,
  /invalid data found/i,
  /no such file or directory/i,
  /permission denied/i,
  /cannot open/i,
  /unknown encoder/i,
  /encoder not found/i,
  /unsupported codec/i,
  /failed to load/i,
  /allocation failed/i,
  /too many packets/i,
  /numerical result out of range/i,
  /invalid argument/i,
  /not found/i,
];

/**
 * Check if a line from stderr indicates an error condition.
 * Note: FFmpeg writes progress info to stderr, so not all stderr is an error.
 * This function looks for specific error patterns.
 */
export function isErrorLine(line: string): boolean {
  // Skip lines that are clearly progress info
  if (PROGRESS_REGEX.test(line)) return false;
  if (line.trim().startsWith('frame=')) return false;
  if (line.includes('Press [q] to stop')) return false;
  if (line.includes('Building fontconfig')) return false;
  if (line.match(/^[\s]*$/)) return false;

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(line)) return true;
  }
  return false;
}

/**
 * Extract error message from stderr buffer.
 * Returns the first matching error line, or null if no error detected.
 */
export function extractErrorMessage(stderrLines: string[]): string | null {
  for (const line of stderrLines) {
    if (isErrorLine(line)) {
      return line.trim();
    }
  }
  return null;
}

/**
 * Check if stderr indicates the process is still initializing
 * (e.g., probing inputs, building filter graphs).
 */
export function isInitLine(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  return (
    trimmed.startsWith('input #') ||
    trimmed.startsWith('output #') ||
    trimmed.includes('stream mapping') ||
    trimmed.includes('press [q]') ||
    trimmed.includes('building fontconfig') ||
    trimmed.includes('filter graph') ||
    trimmed.includes('parsing') ||
    trimmed.includes('detected') ||
    trimmed.includes('using ') ||
    trimmed.startsWith('configuration:')
  );
}