// =============================================================================
// AI Video Generator — FFmpeg Engine Transitions
// =============================================================================

import * as fs from 'fs';
import type {
  FFmpegContext,
  TransitionConfig,
  CommandConfig,
} from './types';
import {
  DEFAULT_RENDER_CONFIG,
} from './constants';
import {
  ensureDir,
  removeFileAsync,
} from './utils';
import {
  tempVideoPath,
} from './paths';
import {
  assertValid,
  validateTransitionConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  FilterGraph,
} from './filters';
import {
  probeDuration,
} from './probe';

// =============================================================================
// XFade Transition
// =============================================================================

/**
 * Apply a visual transition (xfade) between two video clips.
 * Automatically scales both inputs to the target resolution.
 * Handles both video (xfade) and audio (acrossfade) streams.
 */
export async function applyTransition(
  config: TransitionConfig,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateTransitionConfig, 'applyTransition');
  ensureDir(config.outputPath);

  let offset = config.offset ?? 0;
  if (config.offset === null) {
    ctx.log('info', 'Offset not provided, probing input A duration...', 'transitions');
    const durA = await probeDuration(config.inputA, ctx);
    offset = Math.max(0, durA - config.duration);
  }

  const graph = new FilterGraph();

  graph.scale(graph.input('v', 0), config.resolution, 's0');
  graph.scale(graph.input('v', 1), config.resolution, 's1');
  graph.xfade('[s0]', '[s1]', config.transition, offset, config.duration, 'vout');

  graph.addFilter(
    [graph.input('a', 0), graph.input('a', 1)],
    `acrossfade=d=${config.duration}:c1=tri:c2=tri`,
    ['[aout]']
  );

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: config.inputA,
        index: 0,
        duration: null,
        startTime: null,
        format: null,
        streamLoop: 0,
        extraArgs: [],
      },
      {
        path: config.inputB,
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
        path: config.outputPath,
        map: ['[vout]', '[aout]'],
        videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
        audioCodec: DEFAULT_RENDER_CONFIG.audioCodec,
        videoBitrate: null,
        audioBitrate: DEFAULT_RENDER_CONFIG.audioBitrate,
        crf: 23,
        preset: 'fast',
        tune: null,
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
    timeoutMs: 120000,
  };

  ctx.log('info', `Applying ${config.transition} transition (${config.duration}s) -> ${config.outputPath}`, 'transitions');
  await executeFFmpeg(commandConfig, ctx);
  
  return config.outputPath;
}

// =============================================================================
// Simple Concatenation
// =============================================================================

/**
 * Concatenate multiple video files sequentially without any transitions.
 * Uses the FFmpeg concat demuxer for maximum speed (stream copy).
 */
export async function concatClips(
  inputPaths: string[],
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  if (inputPaths.length === 0) {
    throw new Error('No input paths provided for concatenation');
  }
  if (inputPaths.length === 1) {
    throw new Error('Only one input path provided. Use copy instead of concat.');
  }

  ensureDir(outputPath);
  const concatListPath = tempVideoPath(ctx.tempDir).replace('.mp4', '.txt');

  try {
    const lines = inputPaths.map(p => {
      const escaped = p.replace(/'/g, "'\\''");
      return `file '${escaped}'`;
    }).join('\n');

    fs.writeFileSync(concatListPath, lines, 'utf-8');

    const commandConfig: CommandConfig = {
      binary: ctx.ffmpegPath,
      inputs: [
        {
          path: concatListPath,
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
          path: outputPath,
          map: [],
          videoCodec: 'copy',
          audioCodec: 'copy',
          videoBitrate: null,
          audioBitrate: null,
          crf: null,
          preset: null,
          tune: null,
          pixelFormat: null,
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
      timeoutMs: inputPaths.length * 30000,
    };

    ctx.log('info', `Concatenating ${inputPaths.length} clips -> ${outputPath}`, 'transitions');
    await executeFFmpeg(commandConfig, ctx);
    
    return outputPath;
  } finally {
    await removeFileAsync(concatListPath);
  }
}

/**
 * Concatenate multiple video files with re-encoding.
 * Use this if the input files have different codecs or framerates.
 */
export async function concatClipsReencode(
  inputPaths: string[],
  outputPath: string,
  ctx: FFmpegContext,
  targetFps: number = 30,
): Promise<string> {
  if (inputPaths.length === 0) {
    throw new Error('No input paths provided for concatenation');
  }

  ensureDir(outputPath);
  const graph = new FilterGraph();
  const inputs: CommandConfig['inputs'] = [];

  for (let i = 0; i < inputPaths.length; i++) {
    inputs.push({
      path: inputPaths[i],
      index: i,
      duration: null,
      startTime: null,
      format: null,
      streamLoop: 0,
      extraArgs: [],
    });
    
    const vidLabel = graph.input('v', i);
    const normLabel = `v${i}`;
    graph.fps(vidLabel, targetFps, normLabel);
  }

  const videoLabels = Array.from({ length: inputPaths.length }, (_, i) => `[v${i}]`);
  const audioLabels = Array.from({ length: inputPaths.length }, (_, i) => graph.input('a', i));

  graph.concatVideo(videoLabels, 'vout');
  graph.concatAudio(audioLabels, 'aout');

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs,
    filterComplex: graph.build(),
    outputs: [
      {
        path: outputPath,
        map: ['[vout]', '[aout]'],
        videoCodec: DEFAULT_RENDER_CONFIG.videoCodec,
        audioCodec: DEFAULT_RENDER_CONFIG.audioCodec,
        videoBitrate: null,
        audioBitrate: DEFAULT_RENDER_CONFIG.audioBitrate,
        crf: 23,
        preset: 'fast',
        tune: null,
        pixelFormat: 'yuv420p',
        fps: targetFps,
        resolution: null,
        format: null,
        movFlags: '+faststart',
        metadata: {},
        overwrite: true,
        extraArgs: [],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: inputPaths.length * 60000,
  };

  ctx.log('info', `Concatenating (re-encode) ${inputPaths.length} clips -> ${outputPath}`, 'transitions');
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}