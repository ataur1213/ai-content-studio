// =============================================================================
// AI Video Generator — FFmpeg Engine Probe (FFprobe Integration)
// =============================================================================
// Spawns ffprobe to extract detailed metadata from media files.
// Depends on types.ts, constants.ts, utils.ts (Layer 0-2).
// =============================================================================

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type {
  MediaInfo,
  VideoStreamInfo,
  AudioStreamInfo,
  FFmpegError,
  FFmpegContext,
  FilePath,
} from './types';
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  MAX_STDERR_BUFFER,
} from './constants';
import {
  fileExists,
  getFileExtension,
  getFilename,
  finiteOr,
  withRetry,
} from './utils';

// =============================================================================
// Raw FFprobe JSON Types (Internal)
// =============================================================================

interface RawStream {
  index: number;
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  bit_rate?: string;
  pix_fmt?: string;
  sample_aspect_ratio?: string;
  display_aspect_ratio?: string;
  tags?: Record<string, string>;
  duration?: string;
  profile?: string;
  level?: number;
  color_space?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bits_per_sample?: number;
}

interface RawFormat {
  filename?: string;
  format_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

interface RawProbeData {
  streams: RawStream[];
  format: RawFormat;
}

// =============================================================================
// Core Probe Function
// =============================================================================

/**
 * Probe a media file using ffprobe and return structured metadata.
 * Includes retry logic for transient file system errors.
 */
export async function probeMedia(
  filePath: FilePath,
  ctx: FFmpegContext,
): Promise<MediaInfo> {
  const absPath = path.resolve(filePath);
  
  return withRetry(
    () => executeProbe(absPath, ctx),
    ctx.retryAttempts,
    ctx.retryDelayMs,
    'probeMedia',
    ctx.log,
  );
}

/**
 * Internal probe execution without retry wrapper.
 */
async function executeProbe(
  absPath: FilePath,
  ctx: FFmpegContext,
): Promise<MediaInfo> {
  if (!fileExists(absPath)) {
    throw createProbeError(
      `File does not exist: ${absPath}`,
      'PROBE_NOT_FOUND',
      [],
      ctx.ffprobePath,
    );
  }

  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    absPath,
  ];

  ctx.log('debug', `Executing ffprobe: ${ctx.ffprobePath} ${args.join(' ')}`, 'probe');

  try {
    const { stdout, stderr } = await spawnProcess(ctx.ffprobePath, args);
    
    if (!stdout || stdout.trim().length === 0) {
      throw createProbeError(
        'ffprobe returned empty output. File might be corrupted or unsupported.',
        'PROBE_EMPTY_OUTPUT',
        stderr.split('\n'),
        ctx.ffprobePath,
      );
    }

    let rawData: RawProbeData;
    try {
      rawData = JSON.parse(stdout) as RawProbeData;
    } catch (parseErr) {
      throw createProbeError(
        `Failed to parse ffprobe JSON output: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
        'PROBE_JSON_PARSE_ERROR',
        stderr.split('\n'),
        ctx.ffprobePath,
      );
    }

    return mapToMediaInfo(rawData, absPath);
  } catch (err) {
    if (err instanceof FFmpegProbeError) {
      throw err;
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    throw createProbeError(
      `ffprobe process failed: ${errMsg}`,
      'PROBE_SPAWN_ERROR',
      [],
      ctx.ffprobePath,
    );
  }
}

// =============================================================================
// Process Spawning Utility
// =============================================================================

/**
 * Spawn a child process and collect stdout/stderr.
 * Returns a promise that resolves when the process exits.
 */
function spawnProcess(
  binary: FilePath,
  args: string[],
  timeoutMs: number = DEFAULT_COMMAND_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
      // Prevent memory exhaustion from massive stderr
      const totalSize = stderrChunks.reduce((sum, c) => sum + c.length, 0);
      if (totalSize > MAX_STDERR_BUFFER) {
        child.stderr.destroy();
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
        reject(new Error(`Process exited with code ${code}: ${stderr.slice(0, 500)}`));
      } else {
        resolve({ stdout, stderr, exitCode: code });
      }
    });
  });
}

// =============================================================================
// Data Mapping
// =============================================================================

/**
 * Map raw ffprobe JSON to our internal MediaInfo type.
 */
function mapToMediaInfo(data: RawProbeData, filePath: FilePath): MediaInfo {
  const videoStream = extractVideoStream(data.streams);
  const audioStream = extractAudioStream(data.streams);

  const formatDuration = parseDurationString(data.format?.duration);
  const formatBitrate = parseBitrateString(data.format?.bit_rate);
  const fileSize = parseFileSizeString(data.format?.size) || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);

  // Prefer stream duration over format duration if format is missing/zero
  const duration = formatDuration > 0 
    ? formatDuration 
    : (videoStream?.duration ?? audioStream?.duration ?? 0);

  return {
    path: filePath,
    filename: getFilename(filePath),
    extension: getFileExtension(filePath),
    fileSize,
    duration: finiteOr(duration, 0),
    bitrate: formatBitrate > 0 ? formatBitrate : (videoStream?.bitrate ?? audioStream?.bitrate ?? 0),
    format: data.format?.format_name || 'unknown',
    videoStream,
    audioStream,
    createdAt: fs.existsSync(filePath) ? fs.statSync(filePath).birthtimeMs : 0,
  };
}

/**
 * Extract the best video stream from the streams array.
 */
function extractVideoStream(streams: RawStream[]): VideoStreamInfo | null {
  // Find the first valid video stream
  const raw = streams.find(s => s.codec_type === 'video' && s.width && s.height);
  if (!raw) return null;

  return {
    index: raw.index,
    codec: raw.codec_name || 'unknown',
    width: raw.width ?? 0,
    height: raw.height ?? 0,
    fps: parseFpsString(raw.r_frame_rate || raw.avg_frame_rate),
    bitrate: parseBitrateString(raw.bit_rate),
    pixelFormat: raw.pix_fmt || 'unknown',
    aspectRatio: raw.display_aspect_ratio || raw.sample_aspect_ratio || '16:9',
    rotation: parseRotation(raw.tags),
    duration: parseDurationString(raw.duration),
    profile: raw.profile || 'unknown',
    level: raw.level ?? 0,
    colorSpace: raw.color_space || 'unknown',
    hasBFrames: false, // Requires specific ffprobe flags to extract reliably, defaulting to false
  };
}

/**
 * Extract the best audio stream from the streams array.
 */
function extractAudioStream(streams: RawStream[]): AudioStreamInfo | null {
  const raw = streams.find(s => s.codec_type === 'audio' && s.channels);
  if (!raw) return null;

  return {
    index: raw.index,
    codec: raw.codec_name || 'unknown',
    sampleRate: parseInt(raw.sample_rate || '0', 10) || 0,
    channels: raw.channels ?? 0,
    channelLayout: raw.channel_layout || 'unknown',
    bitrate: parseBitrateString(raw.bit_rate),
    duration: parseDurationString(raw.duration),
    bitsPerSample: raw.bits_per_sample ?? 0,
  };
}

// =============================================================================
// Raw Value Parsers
// =============================================================================

/** Parse a duration string like "125.456000" or "00:01:25.456000" to seconds. */
function parseDurationString(value: string | undefined): number {
  if (!value || typeof value !== 'string') return 0;
  const trimmed = value.trim();
  
  // Handle HH:MM:SS.ms format
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 3) {
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      const s = parseFloat(parts[2]) || 0;
      return h * 3600 + m * 60 + s;
    }
    if (parts.length === 2) {
      const m = parseFloat(parts[0]) || 0;
      const s = parseFloat(parts[1]) || 0;
      return m * 60 + s;
    }
  }
  
  // Handle pure float
  const num = parseFloat(trimmed);
  return isFinite(num) && num > 0 ? num : 0;
}

/** Parse a bitrate string like "1256789" (bits/s) or "1256k" to bits/s. */
function parseBitrateString(value: string | undefined): number {
  if (!value || typeof value !== 'string') return 0;
  const trimmed = value.trim().toLowerCase();
  
  if (trimmed.endsWith('k')) {
    const num = parseFloat(trimmed);
    return isFinite(num) ? Math.round(num * 1000) : 0;
  }
  if (trimmed.endsWith('m')) {
    const num = parseFloat(trimmed);
    return isFinite(num) ? Math.round(num * 1000000) : 0;
  }
  
  const num = parseInt(trimmed, 10);
  return isFinite(num) ? num : 0;
}

/** Parse a file size string like "1024000" to bytes. */
function parseFileSizeString(value: string | undefined): number {
  if (!value || typeof value !== 'string') return 0;
  const num = parseInt(value.trim(), 10);
  return isFinite(num) ? num : 0;
}

/** Parse an FFmpeg FPS string like "30/1" or "29.97" to a float. */
function parseFpsString(value: string | undefined): number {
  if (!value || typeof value !== 'string') return 0;
  const trimmed = value.trim();
  
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 2) {
      const numerator = parseFloat(parts[0]) || 0;
      const denominator = parseFloat(parts[1]) || 1;
      return denominator > 0 ? numerator / denominator : 0;
    }
  }
  
  const num = parseFloat(trimmed);
  return isFinite(num) ? num : 0;
}

/** Parse rotation from stream tags (e.g., "rotate" -> "90"). */
function parseRotation(tags: Record<string, string> | undefined): number {
  if (!tags || !tags.rotate) return 0;
  const num = parseFloat(tags.rotate);
  return isFinite(num) ? num : 0;
}

export class FFmpegProbeError extends Error implements FFmpegError {
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
    this.name = 'FFmpegProbeError';
    this.code = code;
    this.stderr = stderr;
    this.exitCode = exitCode;
    this.command = command;
    this.timestamp = timestamp ?? Date.now();
    Object.setPrototypeOf(this, FFmpegProbeError.prototype);
  }
}

function createProbeError(
  message: string,
  code: string,
  stderrLines: string[],
  binary: FilePath,
): FFmpegProbeError {
  return new FFmpegProbeError(
    message,
    code,
    stderrLines.join('\n').slice(0, MAX_STDERR_BUFFER),
    [binary],
    null,
  );
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Probe a media file and return only its duration.
 * Faster than full probe if you only need the length.
 */
export async function probeDuration(
  filePath: FilePath,
  ctx: FFmpegContext,
): Promise<number> {
  const info = await probeMedia(filePath, ctx);
  return info.duration;
}

/**
 * Probe a media file and return whether it has a video stream.
 */
export async function probeHasVideo(
  filePath: FilePath,
  ctx: FFmpegContext,
): Promise<boolean> {
  const info = await probeMedia(filePath, ctx);
  return info.videoStream !== null;
}

/**
 * Probe a media file and return whether it has an audio stream.
 */
export async function probeHasAudio(
  filePath: FilePath,
  ctx: FFmpegContext,
): Promise<boolean> {
  const info = await probeMedia(filePath, ctx);
  return info.audioStream !== null;
}

/**
 * Check if a file is a valid video file (has video stream and duration > 0).
 */
export async function isValidVideoFile(
  filePath: FilePath,
  ctx: FFmpegContext,
): Promise<boolean> {
  try {
    const info = await probeMedia(filePath, ctx);
    return info.videoStream !== null && info.duration > 0;
  } catch {
    return false;
  }
}

/**
 * Check if a file is a valid audio file (has audio stream and duration > 0).
 */
export async function isValidAudioFile(
  filePath: FilePath,
  ctx: FFmpegContext,
): Promise<boolean> {
  try {
    const info = await probeMedia(filePath, ctx);
    return info.audioStream !== null && info.duration > 0;
  } catch {
    return false;
  }
}
