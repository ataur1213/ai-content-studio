// =============================================================================
// AI Video Generator — FFmpeg Engine Overlays & Animations
// =============================================================================

import type {
  FFmpegContext,
  OverlayConfig,
  AnimationConfig,
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
  validateOverlayConfig,
  validateAnimationConfig,
} from './validate';
import {
  executeFFmpeg,
} from './command';
import {
  FilterGraph,
} from './filters';

// =============================================================================
// Single Overlay
// =============================================================================

/**
 * Apply a single image or video overlay on top of a base video.
 * Handles timing, positioning, and opacity.
 */
export async function addOverlay(
  config: OverlayConfig,
  ctx: FFmpegContext,
): Promise<string> {
  assertValid(config, validateOverlayConfig, 'addOverlay');
  ensureDir(config.outputPath);

  const graph = new FilterGraph();
  const baseVideoLabel = graph.input('v', 0);
  const overlayRawLabel = graph.input('v', config.overlayInputIndex);

  let processedOverlay = overlayRawLabel;

  // Scale overlay if explicit dimensions are provided
  if (config.timing.width !== null && config.timing.height !== null) {
    const id = 'scaled_ov';
    graph.scale(overlayRawLabel, { width: config.timing.width, height: config.timing.height }, id);
    processedOverlay = `[${id}]`;
  }

  // Build custom overlay filter string to support opacity and precise timing
  const pos = ANCHOR_POSITIONS[config.timing.position];
  const xStr = config.timing.x !== null ? String(config.timing.x) : pos.x;
  const yStr = config.timing.y !== null ? String(config.timing.y) : pos.y;
  const alphaStr = config.timing.opacity < 1.0 ? `:alpha=${config.timing.opacity}` : '';
  const endTime = config.timing.startTime + config.timing.duration;
  
  const filterStr = `overlay=${xStr}:${yStr}:enable='between(t,${config.timing.startTime},${endTime})':format=auto${alphaStr}`;
  
  graph.addFilter(
    [baseVideoLabel, processedOverlay],
    filterStr,
    ['[vout]']
  );

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: config.baseInput,
        index: 0,
        duration: null,
        startTime: null,
        format: null,
        streamLoop: 0,
        extraArgs: [],
      },
      {
        path: config.overlayPath,
        index: config.overlayInputIndex,
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

  ctx.log('info', `Applying overlay to ${config.baseInput} -> ${config.outputPath}`, 'overlays');
  await executeFFmpeg(commandConfig, ctx);
  
  return config.outputPath;
}

// =============================================================================
// Multiple Animations (Like, Subscribe, Follow, etc.)
// =============================================================================

/**
 * Apply multiple timed animations (social icons, effects) to a base video.
 * Chains overlay filters efficiently in a single FFmpeg pass.
 */
export async function addAnimations(
  baseVideoPath: string,
  animations: AnimationConfig[],
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  if (animations.length === 0) {
    throw new Error('No animations provided');
  }

  for (let i = 0; i < animations.length; i++) {
    assertValid(animations[i], validateAnimationConfig, `animations[${i}]`);
  }

  ensureDir(outputPath);

  // If no animations, or we just want to copy (fallback)
  if (animations.length === 0) {
    const commandConfig: CommandConfig = {
      binary: ctx.ffmpegPath,
      inputs: [{ path: baseVideoPath, index: 0, duration: null, startTime: null, format: null, streamLoop: 0, extraArgs: [] }],
      filterComplex: null,
      outputs: [{
        path: outputPath, map: [], videoCodec: 'copy', audioCodec: 'copy',
        videoBitrate: null, audioBitrate: null, crf: null, preset: null, tune: null,
        pixelFormat: null, fps: null, resolution: null, format: null,
        movFlags: '+faststart', metadata: {}, overwrite: true, extraArgs: [],
      }],
      globalArgs: ['-hide_banner'],
      timeoutMs: 60000,
    };
    await executeFFmpeg(commandConfig, ctx);
    return outputPath;
  }

  const graph = new FilterGraph();
  const inputs: CommandConfig['inputs'] = [
    {
      path: baseVideoPath,
      index: 0,
      duration: null,
      startTime: null,
      format: null,
      streamLoop: 0,
      extraArgs: [],
    },
  ];

  let currentVideoLabel = graph.input('v', 0);

  for (let i = 0; i < animations.length; i++) {
    const anim = animations[i];
    
    // Add animation asset as input
    inputs.push({
      path: anim.assetPath,
      index: i + 1,
      duration: null,
      startTime: null,
      format: null,
      streamLoop: 0,
      extraArgs: [],
    });

    const overlayRawLabel = graph.input('v', i + 1);
    let processedOverlay = overlayRawLabel;

    // Scale overlay if explicit dimensions are provided in timing
    if (anim.timing.width !== null && anim.timing.height !== null) {
      const id = `s${i}`;
      graph.scale(overlayRawLabel, { width: anim.timing.width, height: anim.timing.height }, id);
      processedOverlay = `[${id}]`;
    }

    const outId = i === animations.length - 1 ? 'vout' : `t${i}`;
    
    // Build overlay string with opacity and timing
    const pos = ANCHOR_POSITIONS[anim.timing.position];
    const xStr = anim.timing.x !== null ? String(anim.timing.x) : pos.x;
    const yStr = anim.timing.y !== null ? String(anim.timing.y) : pos.y;
    const alphaStr = anim.timing.opacity < 1.0 ? `:alpha=${anim.timing.opacity}` : '';
    const endTime = anim.timing.startTime + anim.timing.duration;
    
    const filterStr = `overlay=${xStr}:${yStr}:enable='between(t,${anim.timing.startTime},${endTime})':format=auto${alphaStr}`;

    graph.addFilter(
      [currentVideoLabel, processedOverlay],
      filterStr,
      [`[${outId}]`]
    );

    currentVideoLabel = `[${outId}]`;
  }

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs,
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
    timeoutMs: 120000 + (animations.length * 30000),
  };

  ctx.log('info', `Applying ${animations.length} animations to ${baseVideoPath}`, 'overlays');
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}