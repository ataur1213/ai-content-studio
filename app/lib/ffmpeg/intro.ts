// =============================================================================
// AI Video Generator — FFmpeg Engine Intro Generation
// =============================================================================

import type {
  FFmpegContext,
  IntroConfig,
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
  validateIntroConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  FilterGraph,
} from './filters';

// =============================================================================
// Main Intro Handler
// =============================================================================

/**
 * Create an intro clip.
 * If a sourcePath is provided, it trims it to the specified duration.
 * Otherwise, it generates a colored card with text (and optional background image).
 */
export async function createIntro(
  config: IntroConfig,
  ctx: FFmpegContext,
): Promise<string> {
  if (!config.enabled) {
    throw new Error('Intro is not enabled. Check config before calling createIntro.');
  }

  assertValid(config, validateIntroConfig, 'createIntro');

  const outputPath = config.outputPath || tempVideoPath(ctx.tempDir);
  ensureDir(outputPath);

  if (config.sourcePath) {
    return extractIntroFromSource(config.sourcePath, config.duration, outputPath, ctx);
  }

  return generateIntroCard(config, outputPath, ctx);
}

// =============================================================================
// Extract from Existing Video
// =============================================================================

/**
 * Trim an existing video to act as the intro.
 */
async function extractIntroFromSource(
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

  ctx.log('info', `Extracting intro from source: ${sourcePath}`, 'intro');
  await executeFFmpeg(commandConfig, ctx);
  return outputPath;
}

// =============================================================================
// Generate Card from Scratch
// =============================================================================

/**
 * Generate an intro video card using a solid color or background image with text.
 */
async function generateIntroCard(
  config: IntroConfig,
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
    // Generate solid color background using color source filter
    graph.addFilter([], `color=c=${bgColor}:s=${w}x${h}:d=${dur}:r=${config.fps}`, ['[bg]']);
    bgLabel = '[bg]';
  }

  let currentLabel = bgLabel;

  // Draw Main Text
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

  // Draw Subtext
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
    // If there was main text but no subtext, rename the label to vout
    graph.addFilter([currentLabel], 'null', ['[vout]']);
    currentLabel = '[vout]';
  } else {
    // No text at all, just pass background through
    graph.addFilter([currentLabel], 'null', ['[vout]']);
    currentLabel = '[vout]';
  }

  // Force pixel format for H264 compatibility
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

  ctx.log('info', `Generating intro card -> ${outputPath}`, 'intro');
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}