// =============================================================================
// AI Video Generator — FFmpeg Engine Image Operations
// =============================================================================

import * as fs from 'fs';
import type {
  FFmpegContext,
  ImageToVideoConfig,
  KenBurnsConfig,
  SlideshowConfig,
  CommandConfig,
} from './types';
import {
  DEFAULT_RENDER_CONFIG,
} from './constants';
import {
  tempVideoPath,
} from './paths';
import {
  ensureDir,
  removeFileAsync,
} from './utils';
import {
  assertValid,
  validateImageToVideoConfig,
  validateKenBurnsConfig,
  validateSlideshowConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  FilterGraph,
  generateKenBurnsFilter,
} from './filters';

// =============================================================================
// Image to Video
// =============================================================================

/**
 * Convert a single still image into a video clip.
 */
export async function imageToVideo(
  config: ImageToVideoConfig,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateImageToVideoConfig, 'imageToVideo');

  ensureDir(config.outputPath);
  
  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: config.imagePath,
        index: 0,
        duration: null,
        startTime: null,
        format: null,
        streamLoop: 1,
        extraArgs: ['-framerate', String(config.fps)],
      },
    ],
    filterComplex: null,
    outputs: [
      {
        path: config.outputPath,
        map: ['0:v'],
        videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
        audioCodec: null,
        videoBitrate: null,
        audioBitrate: null,
        crf: 23,
        preset: 'fast',
        tune: 'stillimage',
        pixelFormat: config.pixelFormat,
        fps: config.fps,
        resolution: config.resolution,
        format: null,
        movFlags: null,
        metadata: {},
        overwrite: true,
        extraArgs: ['-t', String(config.duration)],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 60000,
  };

  ctx.log('info', `Converting image to video: ${config.imagePath} -> ${config.outputPath}`, 'images');
  await executeFFmpeg(commandConfig, ctx);
  
  ctx.log('info', 'Image to video conversion completed', 'images');
  return config.outputPath;
}

// =============================================================================
// Ken Burns Effect
// =============================================================================

/**
 * Apply a Ken Burns (pan and zoom) effect to a still image to create a dynamic video.
 */
export async function kenBurnsEffect(
  config: KenBurnsConfig,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateKenBurnsConfig, 'kenBurnsEffect');

  ensureDir(config.outputPath);

  const totalFrames = Math.ceil(config.duration * config.fps);
  const w = config.resolution.width;
  const h = config.resolution.height;

  const zoompanFilter = generateKenBurnsFilter(
    w,
    h,
    totalFrames,
    config.direction,
    config.zoomFactor,
  );

  // zoompan outputs RGB by default, so we force yuv420p for H.264 compatibility
  const finalFilter = `${zoompanFilter},format=yuv420p`;

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: config.imagePath,
        index: 0,
        duration: null,
        startTime: null,
        format: null,
        streamLoop: 1,
        extraArgs: ['-framerate', String(config.fps)],
      },
    ],
    filterComplex: finalFilter,
    outputs: [
      {
        path: config.outputPath,
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
        extraArgs: ['-t', String(config.duration)],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 120000,
  };

  ctx.log('info', `Applying Ken Burns (${config.direction}) to: ${config.imagePath}`, 'images');
  await executeFFmpeg(commandConfig, ctx);
  
  ctx.log('info', 'Ken Burns effect completed', 'images');
  return config.outputPath;
}

// =============================================================================
// Slideshow Creation
// =============================================================================

/**
 * Create a video slideshow from multiple images with optional xfade transitions.
 */
export async function createSlideshow(
  config: SlideshowConfig,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateSlideshowConfig, 'createSlideshow');

  ensureDir(config.outputPath);

  if (config.transition !== 'none' && config.images.length > 30) {
    ctx.log('warn', `Slideshow has ${config.images.length} images. Falling back to concat demuxer for stability.`, 'images');
    return createSimpleSlideshow(config, ctx);
  }

  if (config.transition === 'none' || config.images.length === 1) {
    return createSimpleSlideshow(config, ctx);
  }

  return createXfadeSlideshow(config, ctx);
}

/**
 * Fast slideshow using the concat demuxer. No transitions.
 */
async function createSimpleSlideshow(
  config: SlideshowConfig,
  ctx: FFmpegContext,
): Promise<string> {
  const concatFilePath = tempVideoPath(ctx.tempDir).replace('.mp4', '.txt');
  
  try {
    const lines = config.images.map(img => {
      const escapedPath = img.replace(/'/g, "'\\''");
      return `file '${escapedPath}'`;
    }).join('\n');

    fs.writeFileSync(concatFilePath, lines, 'utf-8');

    const commandConfig: CommandConfig = {
      binary: ctx.ffmpegPath,
      inputs: [
        {
          path: concatFilePath,
          index: 0,
          duration: null,
          startTime: null,
          format: 'concat',
          streamLoop: 0,
          extraArgs: ['-safe', '0'],
        },
      ],
      filterComplex: null,
      outputs: [
        {
          path: config.outputPath,
          map: ['0:v'],
          videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
          audioCodec: null,
          videoBitrate: null,
          audioBitrate: null,
          crf: 23,
          preset: 'fast',
          tune: 'stillimage',
          pixelFormat: config.pixelFormat,
          fps: config.fps,
          resolution: config.resolution,
          format: null,
          movFlags: null,
          metadata: {},
          overwrite: true,
          extraArgs: [
            '-vsync', 'vfr',
            '-r', String(config.fps),
          ],
        },
      ],
      globalArgs: ['-hide_banner'],
      timeoutMs: config.images.length * 30000,
    };

    ctx.log('info', `Creating simple slideshow (${config.images.length} images)`, 'images');
    await executeFFmpeg(commandConfig, ctx);
    return config.outputPath;
  } finally {
    await removeFileAsync(concatFilePath);
  }
}

/**
 * High-quality slideshow using complex filter graph and xfade transitions.
 */
async function createXfadeSlideshow(
  config: SlideshowConfig,
  ctx: FFmpegContext,
): Promise<string> {
  const graph = new FilterGraph();
  const inputs: CommandConfig['inputs'] = [];
  const fps = config.fps;
  const transDur = config.transitionDuration;
  const imgDur = config.durationPerImage;
  
  const getOffset = (index: number) => index * (imgDur - transDur);

  for (let i = 0; i < config.images.length; i++) {
    inputs.push({
      path: config.images[i],
      index: i,
      duration: imgDur,
      startTime: null,
      format: null,
      streamLoop: 1,
      extraArgs: ['-framerate', String(fps)],
    });
  }

  let prevLabel = graph.input('v', 0);
  const s0Id = 's0';
  graph.scale(prevLabel, config.resolution, s0Id);
  prevLabel = `[${s0Id}]`;

  for (let i = 1; i < config.images.length; i++) {
    const currRaw = graph.input('v', i);
    const sId = `s${i}`;
    graph.scale(currRaw, config.resolution, sId);
    const scaledCurr = `[${sId}]`;
    
    const outId = i === config.images.length - 1 ? 'vout' : `xf${i}`;
    const offset = getOffset(i);
    
    graph.xfade(
      prevLabel,
      scaledCurr,
      config.transition,
      offset,
      transDur,
      outId
    );

    prevLabel = `[${outId}]`;
  }

  graph.format(prevLabel, config.pixelFormat, 'vout_final');

  const totalDuration = (config.images.length * imgDur) - ((config.images.length - 1) * transDur);

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs,
    filterComplex: graph.build(),
    outputs: [
      {
        path: config.outputPath,
        map: [],
        videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
        audioCodec: null,
        videoBitrate: null,
        audioBitrate: null,
        crf: 23,
        preset: 'fast',
        tune: 'stillimage',
        pixelFormat: config.pixelFormat,
        fps: fps,
        resolution: null,
        format: null,
        movFlags: null,
        metadata: {},
        overwrite: true,
        extraArgs: ['-t', String(totalDuration)],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: config.images.length * 60000,
  };

  ctx.log('info', `Creating xfade slideshow (${config.images.length} images, ${config.transition})`, 'images');
  await executeFFmpeg(commandConfig, ctx);
  
  ctx.log('info', 'Xfade slideshow completed', 'images');
  return config.outputPath;
}