// =============================================================================
// AI Video Generator — FFmpeg Engine Watermark
// =============================================================================

import type {
  FFmpegContext,
  WatermarkOperation,
  TextWatermarkConfig,
  ImageWatermarkConfig,
  CommandConfig,
} from './types';
import {
  DEFAULT_RENDER_CONFIG,
  ANCHOR_POSITIONS,
} from './constants';
import {
  ensureDir,
} from './utils';
import {
  assertValid,
  validateWatermarkOperation,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  FilterGraph,
} from './filters';

// =============================================================================
// Main Watermark Dispatcher
// =============================================================================

/**
 * Apply a watermark (text or image) to a video.
 */
export async function addWatermark(
  config: WatermarkOperation,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateWatermarkOperation, 'addWatermark');
  ensureDir(config.outputPath);

  if (config.watermark.type === 'text') {
    return addTextWatermark(config.baseInput, config.watermark, config.outputPath, ctx);
  } else if (config.watermark.type === 'image') {
    return addImageWatermark(config.baseInput, config.watermark, config.outputPath, ctx);
  } else {
    throw new Error(`Unknown watermark type`);
  }
}

// =============================================================================
// Text Watermark
// =============================================================================

/**
 * Burn a text watermark into the video using the drawtext filter.
 */
async function addTextWatermark(
  baseInput: string,
  config: TextWatermarkConfig,
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  const graph = new FilterGraph();
  const videoLabel = graph.input('v', 0);

  const pos = ANCHOR_POSITIONS[config.position];
  const xVal = config.x !== null ? config.x : undefined;
  const yVal = config.y !== null ? config.y : undefined;
  
  const finalX = xVal !== undefined ? String(xVal) : pos.x;
  const finalY = yVal !== undefined ? String(yVal) : pos.y;

  graph.drawText(
    videoLabel,
    config.text,
    {
      x: finalX,
      y: finalY,
      fontSize: config.fontSize,
      fontColor: config.fontColor,
      fontFamily: config.fontFamily || undefined,
      shadowColor: config.shadowColor,
      shadowX: config.shadowX,
      shadowY: config.shadowY,
      outlineColor: config.outlineColor,
      outlineWidth: config.outlineWidth,
      alpha: config.opacity,
    },
    'vout'
  );

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: baseInput,
        index: 0,
        duration: null,
        startTime: null,
        format: null,
        streamLoop: 0,
        extraArgs: [],
      },
    ],
    filterComplex: graph.build(),
    outputs: [
      {
        path: outputPath,
        map: ['[vout]', '0:a'],
        videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
        audioCodec: 'copy',
        videoBitrate: null,
        audioBitrate: null,
        crf: 23,
        preset: 'fast',
        tune: null,
        pixelFormat: 'yuv420p',
        fps: null,
        resolution: null,
        format: null,
        movFlags: '+faststart',
        metadata: {},
        overwrite: true,
        extraArgs: [],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 120000,
  };

  ctx.log('info', `Applying text watermark to ${baseInput}`, 'watermark');
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}

// =============================================================================
// Image Watermark
// =============================================================================

/**
 * Overlay an image watermark on the video.
 */
async function addImageWatermark(
  baseInput: string,
  config: ImageWatermarkConfig,
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  const graph = new FilterGraph();
  const baseLabel = graph.input('v', 0);
  const wmRawLabel = graph.input('v', 1);

  let processedWm = wmRawLabel;

  if (config.width !== null && config.height !== null) {
    const id = 'wm_scaled';
    graph.scale(wmRawLabel, { width: config.width, height: config.height }, id);
    processedWm = `[${id}]`;
  }

  const pos = ANCHOR_POSITIONS[config.position];
  const xStr = config.x !== null ? String(config.x) : pos.x;
  const yStr = config.y !== null ? String(config.y) : pos.y;

  const alphaStr = config.opacity < 1.0 ? `:alpha=${config.opacity}` : '';
  const filterStr = `overlay=${xStr}:${yStr}:format=auto${alphaStr}`;
  
  graph.addFilter([baseLabel, processedWm], filterStr, ['[vout]']);

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: baseInput,
        index: 0,
        duration: null,
        startTime: null,
        format: null,
        streamLoop: 0,
        extraArgs: [],
      },
      {
        path: config.imagePath,
        index: 1,
        duration: null,
        startTime: null,
        format: null,
        streamLoop: 0,
        extraArgs: [],
      },
    ],
    filterComplex: graph.build(),
    outputs: [
      {
        path: outputPath,
        map: ['[vout]', '0:a'],
        videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
        audioCodec: 'copy',
        videoBitrate: null,
        audioBitrate: null,
        crf: 23,
        preset: 'fast',
        tune: null,
        pixelFormat: 'yuv420p',
        fps: null,
        resolution: null,
        format: null,
        movFlags: '+faststart',
        metadata: {},
        overwrite: true,
        extraArgs: [],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 120000,
  };

  ctx.log('info', `Applying image watermark to ${baseInput}`, 'watermark');
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}