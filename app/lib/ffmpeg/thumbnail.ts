// =============================================================================
// AI Video Generator — FFmpeg Engine Thumbnail Generation
// =============================================================================

import * as path from 'path';
import type {
  FFmpegContext,
  ThumbnailConfig,
  ThumbnailResult,
  CommandConfig,
  ImageFormat,
} from './types';
import {
  IMAGE_ENCODER_MAP,
} from './constants';
import {
  ensureDir,
  formatTime,
  fileSize,
} from './utils';
import {
  assertValid,
  validateThumbnailConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  probeDuration,
} from './probe';

const VALID_IMAGE_FORMATS: ReadonlySet<ImageFormat> = new Set<ImageFormat>([
  'png', 'jpg', 'jpeg', 'webp',
]);

function normalizeImageFormat(raw: ImageFormat): ImageFormat {
  if (VALID_IMAGE_FORMATS.has(raw)) return raw;
  return 'jpg';
}

// =============================================================================
// Main Thumbnail Handler
// =============================================================================

/**
 * Generate thumbnails from a video.
 * If specific timestamps are provided, extracts exactly those frames.
 * If `count` is provided instead, evenly distributes that many thumbnails across the video duration.
 * Runs extractions in parallel for maximum speed.
 */
export async function generateThumbnails(
  config: ThumbnailConfig,
  ctx: FFmpegContext,
): Promise<ThumbnailResult[]> {
  assertValid(config, validateThumbnailConfig, 'generateThumbnails');
  ensureDir(config.outputDir);

  const normalizedFormat = normalizeImageFormat(config.format);

  let targetTimestamps = config.timestamps;

  // If no explicit timestamps, calculate even distribution based on count
  if ((!targetTimestamps || targetTimestamps.length === 0) && config.count !== null && config.count > 0) {
    ctx.log('info', `No timestamps provided. Probing duration to distribute ${config.count} thumbnails evenly.`, 'thumbnail');
    const duration = await probeDuration(config.inputPath, ctx);
    
    if (duration <= 0) {
      throw new Error(`Cannot determine duration of ${config.inputPath} for thumbnail distribution.`);
    }

    targetTimestamps = [];
    for (let i = 0; i < config.count; i++) {
      // Add a small offset (1s) to avoid pure black frames at the very start
      const t = Math.min(duration - 0.1, (duration * (i + 1)) / (config.count + 1));
      targetTimestamps.push(t);
    }
  }

  if (!targetTimestamps || targetTimestamps.length === 0) {
    throw new Error('Must provide either `timestamps` or `count` in ThumbnailConfig.');
  }

  ctx.log('info', `Generating ${targetTimestamps.length} thumbnails from ${config.inputPath}`, 'thumbnail');

  // Execute extractions in parallel for speed
  const promises = targetTimestamps.map((timestamp, index) => {
    const filename = config.filenamePattern
      .replace('{index}', String(index + 1))
      .replace('{timestamp}', formatTime(timestamp).replace(/:/g, '-'));
    
    const finalFilename = filename.endsWith(`.${normalizedFormat}`) ? filename : `${filename}.${normalizedFormat}`;
    const outputPath = path.join(config.outputDir, finalFilename);

    return extractSingleFrame(config.inputPath, timestamp, outputPath, config.width, config.height, normalizedFormat, config.quality, ctx);
  });

  const results = await Promise.all(promises);
  
  ctx.log('info', `Successfully generated ${results.length} thumbnails`, 'thumbnail');
  return results;
}

// =============================================================================
// Single Frame Extraction
// =============================================================================

/**
 * Extract a single frame from a video at a specific timestamp.
 * Highly optimized to only decode the exact frame needed.
 */
async function extractSingleFrame(
  inputPath: string,
  timestamp: number,
  outputPath: string,
  width: number,
  height: number,
  format: ImageFormat,
  quality: number,
  ctx: FFmpegContext,
): Promise<ThumbnailResult> {
  // Input seeking (-ss) before input is much faster for single frames
  const encoder = IMAGE_ENCODER_MAP[format];
  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: inputPath,
        index: 0,
        duration: null,
        startTime: timestamp,
        format: null,
        streamLoop: 0,
        extraArgs: [],
      },
    ],
    filterComplex: null,
    outputs: [
      {
        path: outputPath,
        map: [],
        videoCodec: null, // Images don't use standard video codecs
        audioCodec: null,
        videoBitrate: null,
        audioBitrate: null,
        crf: null,
        preset: null,
        tune: null,
        pixelFormat: null,
        fps: null,
        resolution: null,
        format: null,
        movFlags: null,
        metadata: {},
        overwrite: true,
        extraArgs: [
          '-frames:v', '1',
          '-c:v', encoder,
          '-q:v', String(quality),
          '-s', `${width}x${height}`,
        ],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 30000, // 30s max per thumbnail
  };

  await executeFFmpeg(commandConfig, ctx);

  return {
    path: outputPath,
    timestamp,
    width,
    height,
    size: fileSize(outputPath),
  };
}