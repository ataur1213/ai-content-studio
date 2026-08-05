// =============================================================================
// AI Video Generator — FFmpeg Engine Utility Functions
// =============================================================================
// Pure and lightweight IO helpers used by every other module.
// Depends only on types.ts and constants.ts (Layer 0-1).
// =============================================================================

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import type {
  TimeRange,
  Resolution,
  AspectRatio,
  FilePath,
  LogLevel,
  LogEntry,
  LogFunction,
  LogCallback,
} from './types';
import {
  TEMP_FILE_PREFIX,
  TEMP_VIDEO_EXT,
  TEMP_AUDIO_EXT,
  TEMP_SUBTITLE_EXT,
  TWO_PASS_LOG_EXT,
  ASPECT_RATIOS,
  RESOLUTION_PRESETS,
  LOG_LEVEL_PRIORITY,
} from './constants';

// =============================================================================
// ID Generation
// =============================================================================

/** Generate a cryptographically random hex ID with optional prefix. */
export function generateId(prefix: string = ''): string {
  const hex = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${hex}` : hex;
}

// =============================================================================
// Numeric Helpers
// =============================================================================

/** Clamp a number between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Return value if finite and >= 0, otherwise fallback. */
export function finiteOr(value: number, fallback: number): number {
  return isFinite(value) && value >= 0 ? value : fallback;
}

/** Linear interpolation between a and b at t ∈ [0, 1]. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

// =============================================================================
// Time Formatting
// =============================================================================

/** Left-pad an integer with zeros to reach `length` digits. */
export function padZero(num: number, length: number = 2): string {
  return String(Math.floor(num)).padStart(length, '0');
}

/** Format seconds → `HH:MM:SS.mm` (general purpose). */
export function formatTime(seconds: number): string {
  const s = finiteOr(seconds, 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 100);
  return `${padZero(h)}:${padZero(m)}:${padZero(sec)}.${padZero(ms)}`;
}

/** Format seconds → SRT timestamp `HH:MM:SS,mmm`. */
export function formatSrtTime(seconds: number): string {
  const s = finiteOr(seconds, 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  return `${padZero(h)}:${padZero(m)}:${padZero(sec)},${String(ms).padStart(3, '0')}`;
}

/** Format seconds → ASS timestamp `H:MM:SS.cc`. */
export function formatAssTime(seconds: number): string {
  const s = finiteOr(seconds, 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round((s % 1) * 100);
  return `${h}:${padZero(m)}:${padZero(sec)}.${padZero(cs)}`;
}

/** Format seconds → VTT timestamp `HH:MM:SS.mmm`. */
export function formatVttTime(seconds: number): string {
  return formatSrtTime(seconds).replace(',', '.');
}

// =============================================================================
// Time Parsing
// =============================================================================

/**
 * Parse a human-readable time string into seconds.
 * Supported formats:
 *   HH:MM:SS.mmm  |  HH:MM:SS,mmm  |  HH:MM:SS
 *   MM:SS.mmm     |  MM:SS,mmm     |  MM:SS
 *   SS.mmm        |  SS,mmm        |  SS
 *   Pure float
 */
export function parseTime(raw: string): number {
  const str = raw.trim();
  if (!str) return 0;

  // HH:MM:SS[.,]frac
  let match = str.match(/^(\d+):(\d{1,2}):(\d{1,2})[.,](\d+)$/);
  if (match) {
    const fracLen = match[4].length;
    const frac = parseInt(match[4], 10) / Math.pow(10, fracLen);
    return parseInt(match[1], 10) * 3600
         + parseInt(match[2], 10) * 60
         + parseInt(match[3], 10)
         + frac;
  }

  // HH:MM:SS
  match = str.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (match) {
    return parseInt(match[1], 10) * 3600
         + parseInt(match[2], 10) * 60
         + parseInt(match[3], 10);
  }

  // MM:SS[.,]frac
  match = str.match(/^(\d{1,2}):(\d{1,2})[.,](\d+)$/);
  if (match) {
    const fracLen = match[3].length;
    const frac = parseInt(match[3], 10) / Math.pow(10, fracLen);
    return parseInt(match[1], 10) * 60
         + parseInt(match[2], 10)
         + frac;
  }

  // MM:SS
  match = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (match) {
    return parseInt(match[1], 10) * 60
         + parseInt(match[2], 10);
  }

  // Pure number
  const num = parseFloat(str);
  return isFinite(num) && num >= 0 ? num : 0;
}

// =============================================================================
// Time Range Helpers
// =============================================================================

/** Clamp a timestamp inside a range. */
export function clampToRange(seconds: number, range: TimeRange): number {
  return clamp(seconds, range.start, range.end);
}

/** Total duration of a single time range. */
export function rangeDuration(range: TimeRange): number {
  return Math.max(0, range.end - range.start);
}

/** Check whether two time ranges overlap. */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Merge overlapping / adjacent time ranges into minimal set. */
export function mergeTimeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

/** Sum of durations across merged time ranges. */
export function totalRangeDuration(ranges: TimeRange[]): number {
  return mergeTimeRanges(ranges).reduce((sum, r) => sum + rangeDuration(r), 0);
}

// =============================================================================
// Resolution Helpers
// =============================================================================

/** Determine aspect ratio label from a resolution, or '16:9' as fallback. */
export function getAspectRatio(resolution: Resolution): AspectRatio {
  const ratio = resolution.width / resolution.height;
  let closest: AspectRatio = '16:9';
  let minDiff = Infinity;
  const entries = Object.entries(ASPECT_RATIOS) as [AspectRatio, number][];
  for (const [label, value] of entries) {
    const diff = Math.abs(ratio - value);
    if (diff < minDiff) {
      minDiff = diff;
      closest = label;
    }
  }
  return closest;
}

/** Try to match a resolution to a named preset. Returns null if no match. */
export function matchResolutionPreset(resolution: Resolution): string | null {
  for (const [name, preset] of Object.entries(RESOLUTION_PRESETS)) {
    if (preset.width === resolution.width && preset.height === resolution.height) {
      return name;
    }
  }
  return null;
}

/** Compute scaled dimensions that fit within a bounding box while keeping aspect ratio. */
export function fitToBox(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: Math.round(sourceWidth * ratio),
    height: Math.round(sourceHeight * ratio),
  };
}

/** Ensure both dimensions are even (required by many FFmpeg codecs). */
export function makeEven(resolution: Resolution): Resolution {
  return {
    width: resolution.width % 2 === 0 ? resolution.width : resolution.width - 1,
    height: resolution.height % 2 === 0 ? resolution.height : resolution.height - 1,
  };
}

// =============================================================================
// File System Helpers
// =============================================================================

/** Synchronously ensure a directory exists (recursive mkdirp). */
export function ensureDir(dirPath: FilePath): void {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    return;
  }

  const fileExt = path.extname(dirPath).toLowerCase();
  const looksLikeFile =
    fileExt === '.mp4' ||
    fileExt === '.webm' ||
    fileExt === '.mkv' ||
    fileExt === '.avi' ||
    fileExt === '.mov' ||
    fileExt === '.gif' ||
    fileExt === '.mp3' ||
    fileExt === '.aac' ||
    fileExt === '.wav' ||
    fileExt === '.ogg' ||
    fileExt === '.flac' ||
    fileExt === '.png' ||
    fileExt === '.jpg' ||
    fileExt === '.jpeg' ||
    fileExt === '.webp' ||
    fileExt === '.srt' ||
    fileExt === '.ass' ||
    fileExt === '.vtt' ||
    fileExt === '.txt' ||
    fileExt === '.log';

  const targetDir = looksLikeFile ? path.dirname(dirPath) : dirPath;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

/** Asynchronously ensure a directory exists (recursive mkdirp). */
export async function ensureDirAsync(dirPath: FilePath): Promise<void> {
  const fileExt = path.extname(dirPath).toLowerCase();
  const looksLikeFile =
    fileExt === '.mp4' ||
    fileExt === '.webm' ||
    fileExt === '.mkv' ||
    fileExt === '.avi' ||
    fileExt === '.mov' ||
    fileExt === '.gif' ||
    fileExt === '.mp3' ||
    fileExt === '.aac' ||
    fileExt === '.wav' ||
    fileExt === '.ogg' ||
    fileExt === '.flac' ||
    fileExt === '.png' ||
    fileExt === '.jpg' ||
    fileExt === '.jpeg' ||
    fileExt === '.webp' ||
    fileExt === '.srt' ||
    fileExt === '.ass' ||
    fileExt === '.vtt' ||
    fileExt === '.txt' ||
    fileExt === '.log';

  const targetDir = looksLikeFile ? path.dirname(dirPath) : dirPath;
  await fs.promises.mkdir(targetDir, { recursive: true });
}

/** Check if a file exists. */
export function fileExists(filePath: FilePath): boolean {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

/** Get file size in bytes, or 0 if not found. */
export function fileSize(filePath: FilePath): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

/** Get file extension without the dot (lowercase). */
export function getFileExtension(filePath: FilePath): string {
  const ext = path.extname(filePath);
  return ext ? ext.slice(1).toLowerCase() : '';
}

/** Get filename without extension. */
export function getFilename(filePath: FilePath): string {
  return path.basename(filePath, path.extname(filePath));
}

/** Resolve a path to absolute. */
export function resolvePath(filePath: FilePath): string {
  return path.resolve(filePath);
}

/** Join path segments. */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

/** Get the directory name of a path. */
export function getDirName(filePath: FilePath): string {
  return path.dirname(filePath);
}

// =============================================================================
// Temporary File Management
// =============================================================================

/** Generate a unique temporary file path. */
export function createTempPath(
  tempDir: FilePath,
  extension: string = TEMP_VIDEO_EXT,
  prefix: string = TEMP_FILE_PREFIX,
): string {
  const id = generateId(prefix);
  return path.join(tempDir, `${id}${extension}`);
}

/** Generate a temporary video path. */
export function createTempVideoPath(tempDir: FilePath): string {
  return createTempPath(tempDir, TEMP_VIDEO_EXT, `${TEMP_FILE_PREFIX}vid`);
}

/** Generate a temporary audio path. */
export function createTempAudioPath(tempDir: FilePath): string {
  return createTempPath(tempDir, TEMP_AUDIO_EXT, `${TEMP_FILE_PREFIX}aud`);
}

/** Generate a temporary image path. */
export function createTempImagePath(tempDir: FilePath, format: string = 'png'): string {
  const ext = format.startsWith('.') ? format : `.${format}`;
  return createTempPath(tempDir, ext, `${TEMP_FILE_PREFIX}img`);
}

/** Generate a temporary subtitle path. */
export function createTempSubtitlePath(tempDir: FilePath): string {
  return createTempPath(tempDir, TEMP_SUBTITLE_EXT, `${TEMP_FILE_PREFIX}sub`);
}

/** Generate a temporary two-pass log path. */
export function createTempLogPath(tempDir: FilePath): string {
  return createTempPath(tempDir, TWO_PASS_LOG_EXT, `${TEMP_FILE_PREFIX}log`);
}

/** Synchronously delete a file if it exists. Ignores errors. */
export function removeFile(filePath: FilePath): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Intentionally swallowed — cleanup must be fault-tolerant
  }
}

/** Asynchronously delete a file if it exists. Ignores errors. */
export async function removeFileAsync(filePath: FilePath): Promise<void> {
  try {
    await fs.promises.access(filePath);
    await fs.promises.unlink(filePath);
  } catch {
    // Intentionally swallowed
  }
}

/** Synchronously delete an array of files. Ignores errors. */
export function removeFiles(filePaths: FilePath[]): void {
  for (const p of filePaths) {
    removeFile(p);
  }
}

/** Asynchronously delete an array of files. Ignores errors. */
export async function removeFilesAsync(filePaths: FilePath[]): Promise<void> {
  await Promise.all(filePaths.map(removeFileAsync));
}

/** Recursively delete a directory if it exists. Ignores errors. */
export function removeDir(dirPath: FilePath): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // Intentionally swallowed
  }
}

/** Asynchronously recursively delete a directory if it exists. Ignores errors. */
export async function removeDirAsync(dirPath: FilePath): Promise<void> {
  try {
    await fs.promises.access(dirPath);
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Intentionally swallowed
  }
}

/** List all files in a directory matching an optional extension filter. */
export function listFiles(dirPath: FilePath, extension?: string): FilePath[] {
  if (!fs.existsSync(dirPath)) return [];
  let files = fs.readdirSync(dirPath).map(f => path.join(dirPath, f));
  if (extension) {
    const ext = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
    files = files.filter(f => path.extname(f).toLowerCase() === ext);
  }
  return files;
}

// =============================================================================
// Logging
// =============================================================================

/** Create a log function bound to a specific log level and optional context. */
export function createLogFunction(
  level: LogLevel,
  context?: string,
  callback?: LogCallback,
): LogFunction {
  return (msgLevel: LogLevel, message: string, msgContext?: string, data?: unknown) => {
    const msgPriority = LOG_LEVEL_PRIORITY[msgLevel] ?? 99;
    const filterPriority = LOG_LEVEL_PRIORITY[level] ?? 0;
    if (msgPriority < filterPriority) return;

    const entry: LogEntry = {
      level: msgLevel,
      message,
      context: msgContext || context,
      timestamp: Date.now(),
      data,
    };

    if (callback) {
      callback(entry);
    }

    const prefix = entry.context ? `[${entry.context}]` : '';
    const ts = new Date(entry.timestamp).toISOString();

    switch (msgLevel) {
      case 'debug':
        console.debug(`${ts} ${prefix} ${message}`, data ?? '');
        break;
      case 'info':
        console.info(`${ts} ${prefix} ${message}`, data ?? '');
        break;
      case 'warn':
        console.warn(`${ts} ${prefix} ${message}`, data ?? '');
        break;
      case 'error':
        console.error(`${ts} ${prefix} ${message}`, data ?? '');
        break;
      case 'silent':
        break;
    }
  };
}

/** Create a no-op log function that discards all messages. */
export function createNoopLog(): LogFunction {
  return () => {
    // intentionally empty
  };
}

// =============================================================================
// String Helpers
// =============================================================================

/** Escape a string for use in an FFmpeg filter value (wrap in single quotes, escape inner single quotes). */
export function escapeFilterValue(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/** Convert a camelCase or snake_case string to kebab-case for CLI flags. */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

/** Truncate a string to maxLength and append ellipsis if truncated. */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/** Repeat a string N times. */
export function repeat(str: string, count: number): string {
  return new Array(Math.max(0, count)).fill(str).join('');
}

// =============================================================================
// Async Utilities
// =============================================================================

/** Sleep for a given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Execute an async function with retries and exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number,
  baseDelayMs: number,
  context?: string,
  log?: LogFunction,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLast = attempt === attempts;
      if (isLast) break;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      log?.(
        'warn',
        `Attempt ${attempt}/${attempts} failed. Retrying in ${delay}ms...`,
        context,
        { error: err instanceof Error ? err.message : String(err) },
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

// =============================================================================
// Array Helpers
// =============================================================================

/** Chunk an array into smaller arrays of max `size`. */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Flatten an array of arrays one level deep. */
export function flatten<T>(arrays: T[][]): T[] {
  return arrays.reduce<T[]>((acc, arr) => acc.concat(arr), []);
}

/** Remove duplicates from an array using a key extractor. */
export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Group array items by a key extractor. */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  const groups = {} as Record<K, T[]>;
  for (const item of array) {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

// =============================================================================
// Misc Helpers
// =============================================================================

/** Convert bytes to a human-readable string (e.g., "10.5 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Convert seconds to a human-readable duration string (e.g., "2m 15s"). */
export function formatDuration(seconds: number): string {
  const s = finiteOr(seconds, 0);
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Deep clone a plain object via JSON serialization (safe for configs). */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Pick specific keys from an object. */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/** Omit specific keys from an object. */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

/** Check if a value is a non-null object (not array, not null). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Safely parse JSON, returning fallback on failure. */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
