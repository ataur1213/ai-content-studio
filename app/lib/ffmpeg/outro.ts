// =============================================================================
// AI Video Generator — FFmpeg Engine Outro Generation
// =============================================================================

import type {
  FFmpegContext,
  OutroConfig,
  CommandConfig,
} from './types';
import {
  DEFAULT_RENDER_CONFIG,
  DEFAULT_CARD_BG_COLOR,
  DEFAULT_CARD_TEXT_COLOR,
  DEFAULT_CARD_FONT_SIZE,
} from './constants';
import {
  ensureDir,
} from './utils';
import {
  tempVideoPath,
} from './paths';
import {
  assertValid,
  validateOutroConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  FilterGraph,
} from './filters';

// =============================================================================
// Main Outro Handler
// =============================================================================

/**
 * Create an outro clip.
 * If a sourcePath is provided, it trims it to the specified duration.
 * Otherwise, it generates a colored card with text (and optional background image).
 */
export async function createOutro(
  config: OutroConfig,
  ctx: FFmpegContext,
): Promise<string> {
  if (!config.enabled) {
    throw new Error('Outro is not enabled. Check config before calling createOutro.');
  }

  assertValid(config, validateOutroConfig, 'createOutro');

  const outputPath = config.outputPath || tempVideoPath(ctx.tempDir);
  ensureDir(outputPath);

  if (config.sourcePath) {
    return extractOutroFromSource(config.sourcePath, config.duration, outputPath, ctx);
  }

  return generateOutroCard(config, outputPath, ctx);
}

// =============================================================================
// Extract from Existing Video
// =============================================================================

/**
 * Trim an existing video to act as the outro.
 */
async function extractOutroFromSource(
  sourcePath: string,
  duration: number,
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: sourcePath,
        index: 0,
        duration: duration,
        startTime: null,
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
        videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
        audioCodec: DEFAULT_RENDER_CONFIG.audioCodec,
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
    timeoutMs: 60000,
  };

  ctx.log('info', `Extracting outro from source: ${sourcePath}`, 'outro');
  await executeFFmpeg(commandConfig, ctx);
  return outputPath;
}

// =============================================================================
// Generate Card from Scratch
// =============================================================================

/**
 * Generate an outro video card using a solid color or background image with text.
 */
async function generateOutroCard(
  config: OutroConfig,
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  const graph = new FilterGraph();
  const inputs: CommandConfig['inputs'] = [];
  let bgLabel: string;

  const w = config.resolution.width;
  const h = config.resolution.height;
  const dur = config.duration;
  const bgColor = config.backgroundColor || DEFAULT_CARD_BG_COLOR;
  const txtColor = config.textColor || DEFAULT_CARD_TEXT_COLOR;
  const fontSize = config.fontSize || DEFAULT_CARD_FONT_SIZE;

  if (config.backgroundImagePath) {
    inputs.push({
      path: config.backgroundImagePath,
      index: 0,
      duration: null,
      startTime: null,
      format: null,
      streamLoop: 1,
      extraArgs: ['-framerate', String(config.fps)],
    });
    
    const rawBg = graph.input('v', 0);
    graph.scale(rawBg, config.resolution, 'bg');
    bgLabel = '[bg]';
  } else {
    graph.addFilter([], `color=c=${bgColor}:s=${w}x${h}:d=${dur}:r=${config.fps}`, ['[bg]']);
    bgLabel = '[bg]';
  }

  let currentLabel = bgLabel;

  if (config.text) {
    const mainTextY = config.subtext ? '(H-h)/2 - 40' : '(H-h)/2';
    graph.drawText(
      currentLabel,
      config.text,
      {
        x: '(W-w)/2',
        y: mainTextY,
        fontSize: fontSize,
        fontColor: txtColor,
        fontFamily: config.fontPath || undefined,
        shadowColor: 'black@0.5',
        shadowX: 2,
        shadowY: 2,
      },
      'with_main'
    );
    currentLabel = '[with_main]';
  }

  if (config.subtext && config.text) {
    const subFontSize = Math.max(12, Math.round(fontSize * 0.6));
    graph.drawText(
      currentLabel,
      config.subtext,
      {
        x: '(W-w)/2',
        y: '(H-h)/2 + 40',
        fontSize: subFontSize,
        fontColor: txtColor,
        fontFamily: config.fontPath || undefined,
      },
      'vout'
    );
    currentLabel = '[vout]';
  } else if (config.text) {
    graph.addFilter([currentLabel], 'null', ['[vout]']);
    currentLabel = '[vout]';
  } else {
    graph.addFilter([currentLabel], 'null', ['[vout]']);
    currentLabel = '[vout]';
  }

  graph.format(currentLabel, 'yuv420p', 'final');

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs,
    filterComplex: graph.build(),
    outputs: [
      {
        path: outputPath,
        map: [],
        videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
        audioCodec: null,
        videoBitrate: null,
        audioBitrate: null,
        crf: 23,
        preset: 'fast',
        tune: 'stillimage',
        pixelFormat: 'yuv420p',
        fps: config.fps,
        resolution: null,
        format: null,
        movFlags: null,
        metadata: {},
        overwrite: true,
        extraArgs: [],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 60000,
  };

  ctx.log('info', `Generating outro card -> ${outputPath}`, 'outro');
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}