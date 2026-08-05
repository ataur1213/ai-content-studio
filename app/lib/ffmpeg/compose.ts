// =============================================================================
// AI Video Generator — FFmpeg Engine High-Level Composer
// =============================================================================

import type {
  FFmpegContext,
  ComposeConfig,
  ComposeResult,
  RenderConfig,
  TimelineClip,
  VideoFilter,
  ClipTransition,
  TransitionType,
  KenBurnsDirection,
} from './types';
import {
  DEFAULT_AUDIO_BITRATE,
} from './constants';
import {
  removeFilesAsync,
  fileSize,
} from './utils';
import {
  tempVideoPath,
} from './paths';
import {
  assertValid,
  validateComposeConfig,
} from './validate';
import {
  imageToVideo,
  kenBurnsEffect,
} from './images';
import {
  applyTransition,
  concatClips,
} from './transitions';
import {
  burnSubtitles,
} from './subtitles';
import {
  addWatermark,
} from './watermark';
import {
  addAnimations,
} from './overlays';
import {
  createIntro,
} from './intro';
import {
  createOutro,
} from './outro';
import {
  mergeVoiceWithMusic,
  addBackgroundMusic,
} from './audio';
import {
  render,
} from './render';
import {
  setVideoMetadata,
} from './seo';
import {
  probeDuration,
} from './probe';

// =============================================================================
// Integration Helpers — Bridge ComposeConfig types to engine modules
// =============================================================================

const VALID_KEN_BURNS_DIRECTIONS: ReadonlySet<KenBurnsDirection> = new Set<KenBurnsDirection>([
  'zoomIn', 'zoomOut', 'panLeft', 'panRight', 'panUp', 'panDown',
  'diagonalTL', 'diagonalTR', 'diagonalBL', 'diagonalBR',
]);

const VALID_TRANSITION_TYPES: ReadonlySet<TransitionType> = new Set<TransitionType>([
  'fade', 'fadeblack', 'fadewhite', 'dissolve',
  'slideleft', 'slideright', 'slideup', 'slidedown',
  'circleopen', 'circleclose', 'pixelize',
  'wipleft', 'wipright', 'wipdown', 'wipup',
  'none',
]);

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && isFinite(value);
}

function findEnabledKenBurnsFilter(clip: TimelineClip): VideoFilter | null {
  const filter = clip.filters.find((f) => f.type === 'kenburns' && f.enabled);
  return filter ?? null;
}

function mapKenBurnsDirection(raw: unknown): KenBurnsDirection {
  if (isString(raw) && VALID_KEN_BURNS_DIRECTIONS.has(raw as KenBurnsDirection)) {
    return raw as KenBurnsDirection;
  }
  return 'zoomIn';
}

interface KenBurnsParams {
  direction: KenBurnsDirection;
  zoomFactor: number;
  easing: string;
}

function extractKenBurnsParams(filter: VideoFilter | null): KenBurnsParams {
  if (!filter) {
    return { direction: 'zoomIn', zoomFactor: 1.2, easing: 'easeInOut' };
  }
  const p = filter.params;
  return {
    direction: mapKenBurnsDirection(p.direction),
    zoomFactor: isNumber(p.zoomFactor) && p.zoomFactor > 1 ? p.zoomFactor : 1.2,
    easing: isString(p.easing) && p.easing.length > 0 ? p.easing : 'easeInOut',
  };
}

function mapTransitionType(raw: unknown): TransitionType {
  if (isString(raw) && VALID_TRANSITION_TYPES.has(raw as TransitionType)) {
    return raw as TransitionType;
  }
  return 'none';
}

function resolveTransition(
  clipTransition: ClipTransition | null,
  defaultType: TransitionType,
  defaultDuration: number,
): { type: TransitionType; duration: number } {
  if (!clipTransition) {
    return { type: defaultType, duration: defaultDuration };
  }
  return {
    type: mapTransitionType(clipTransition.type),
    duration: isNumber(clipTransition.duration) && clipTransition.duration > 0 ? clipTransition.duration : defaultDuration,
  };
}

// =============================================================================
// Main Compose Entry Point
// =============================================================================

/**
 * Orchestrate all sub-modules to create a final, composed video.
 * Uses a sequential pipeline with intermediate temp files for maximum stability.
 */
export async function composeVideo(
  config: ComposeConfig,
  ctx: FFmpegContext,
): Promise<ComposeResult> {
  const startTimeMs = Date.now();
  assertValid(config, validateComposeConfig, 'composeVideo');

  const tempFiles: string[] = [];
  let currentPath = '';

  try {
    ctx.log('info', `Starting composition with ${config.clips.length} clips`, 'compose');

    // ------------------------------------------------------------------
    // 1. Process raw clips (Images -> Video with Ken Burns if needed)
    // ------------------------------------------------------------------
    const processedClips: string[] = [];
    for (const clip of config.clips) {
      if (clip.type === 'image') {
        const kbFilter = findEnabledKenBurnsFilter(clip);
        if (kbFilter) {
          const kbParams = extractKenBurnsParams(kbFilter);
          const outPath = tempVideoPath(ctx.tempDir);
          await kenBurnsEffect({
            imagePath: clip.mediaPath,
            outputPath: outPath,
            duration: clip.duration,
            fps: config.fps,
            resolution: config.resolution,
            direction: kbParams.direction,
            zoomFactor: kbParams.zoomFactor,
            easing: kbParams.easing,
          }, ctx);
          processedClips.push(outPath);
        } else {
          const outPath = tempVideoPath(ctx.tempDir);
          await imageToVideo({
            imagePath: clip.mediaPath,
            outputPath: outPath,
            duration: clip.duration,
            fps: config.fps,
            resolution: config.resolution,
            pixelFormat: 'yuv420p',
            loop: 1,
          }, ctx);
          processedClips.push(outPath);
        }
      } else {
        processedClips.push(clip.mediaPath); // Videos are used as-is initially
      }
    }

    // ------------------------------------------------------------------
    // 2. Concatenate clips with or without transitions
    // ------------------------------------------------------------------
    if (processedClips.length > 1) {
      ctx.log('info', 'Merging clips together', 'compose');
      let mergedPath = processedClips[0];
      
      for (let i = 1; i < processedClips.length; i++) {
        const clipTransition = resolveTransition(
          config.clips[i]?.transition ?? null,
          config.defaultTransition,
          config.transitionDuration,
        );
        const outPath = tempVideoPath(ctx.tempDir);
        if (clipTransition.type === 'none') {
          await concatClips([mergedPath, processedClips[i]], outPath, ctx);
        } else {
          ctx.log('info', `Applying ${clipTransition.type} transition before clip ${i + 1}`, 'compose');
          await applyTransition({
            inputA: mergedPath,
            inputB: processedClips[i],
            outputPath: outPath,
            transition: clipTransition.type,
            duration: clipTransition.duration,
            offset: null,
            resolution: config.resolution,
            fps: config.fps,
          }, ctx);
        }
        
        // Cleanup intermediate files (except the very first original clip)
        if (mergedPath !== processedClips[0]) {
          tempFiles.push(mergedPath);
        }
        mergedPath = outPath;
      }
      currentPath = mergedPath;
    } else {
      currentPath = processedClips[0];
    }

    // ------------------------------------------------------------------
    // 3. Burn Subtitles
    // ------------------------------------------------------------------
    if (config.subtitles && config.subtitles.entries.length > 0) {
      ctx.log('info', 'Burning subtitles', 'compose');
      const nextPath = tempVideoPath(ctx.tempDir);
      await burnSubtitles(currentPath, config.subtitles, nextPath, ctx);
      tempFiles.push(currentPath);
      currentPath = nextPath;
    }

    // ------------------------------------------------------------------
    // 4. Add Watermark
    // ------------------------------------------------------------------
    if (config.watermark) {
      ctx.log('info', 'Adding watermark', 'compose');
      const nextPath = tempVideoPath(ctx.tempDir);
      await addWatermark({
        baseInput: currentPath,
        outputPath: nextPath,
        watermark: config.watermark,
        resolution: config.resolution,
      }, ctx);
      tempFiles.push(currentPath);
      currentPath = nextPath;
    }

    // ------------------------------------------------------------------
    // 5. Add Animations (Like, Subscribe, Follow)
    // ------------------------------------------------------------------
    if (config.overlays.length > 0) {
      ctx.log('info', `Adding ${config.overlays.length} animations`, 'compose');
      const nextPath = tempVideoPath(ctx.tempDir);
      await addAnimations(currentPath, config.overlays, nextPath, ctx);
      tempFiles.push(currentPath);
      currentPath = nextPath;
    }

    // ------------------------------------------------------------------
    // 6. Concatenate Intro + Main Video + Outro
    // ------------------------------------------------------------------
    const concatParts: string[] = [];

    if (config.intro.enabled) {
      ctx.log('info', 'Creating intro', 'compose');
      const introPath = await createIntro(config.intro, ctx);
      concatParts.push(introPath);
      tempFiles.push(introPath); // Always clean up generated intros
    }

    concatParts.push(currentPath); // Main video

    if (config.outro.enabled) {
      ctx.log('info', 'Creating outro', 'compose');
      const outroPath = await createOutro(config.outro, ctx);
      concatParts.push(outroPath);
      tempFiles.push(outroPath); // Always clean up generated outros
    }

    if (concatParts.length > 1) {
      ctx.log('info', 'Concatenating intro, main video, and outro', 'compose');
      const nextPath = tempVideoPath(ctx.tempDir);
      await concatClips(concatParts, nextPath, ctx);
      tempFiles.push(currentPath);
      currentPath = nextPath;
    }

    // ------------------------------------------------------------------
    // 7. Audio Processing (Voice + Background Music)
    // ------------------------------------------------------------------
    if (config.voiceTrack || config.backgroundMusic) {
      ctx.log('info', 'Mixing audio (voice & music)', 'compose');
      const nextPath = tempVideoPath(ctx.tempDir);

      if (config.voiceTrack) {
        await mergeVoiceWithMusic(
          currentPath,
          config.voiceTrack,
          config.backgroundMusic,
          nextPath,
          ctx,
        );
      } else {
        await addBackgroundMusic(
          currentPath,
          config.backgroundMusic as NonNullable<typeof config.backgroundMusic>,
          nextPath,
          ctx,
        );
      }
      tempFiles.push(currentPath);
      currentPath = nextPath;
    }

    // ------------------------------------------------------------------
    // 8. Final High-Quality Render
    // ------------------------------------------------------------------
    ctx.log('info', 'Running final encode', 'compose');
    const renderConfig: RenderConfig = {
      outputPath: config.outputPath,
      format: config.format,
      resolution: config.resolution,
      fps: config.fps,
      videoCodec: config.videoCodec,
      audioCodec: config.audioCodec,
      crf: config.crf,
      preset: config.preset,
      tune: '',
      pixelFormat: 'yuv420p',
      hardwareAccel: 'none',
      twoPass: false,
      metadata: {},
      overwrite: true,
      startTime: null,
      duration: null,
      videoBitrate: null,
      audioBitrate: DEFAULT_AUDIO_BITRATE,
    };

    await render(currentPath, renderConfig, ctx, config.onProgress || undefined);
    tempFiles.push(currentPath); // Add final raw file to cleanup

    // ------------------------------------------------------------------
    // 9. SEO Metadata Injection
    // ------------------------------------------------------------------
    if (config.metadata) {
      ctx.log('info', 'Injecting SEO metadata', 'compose');
      await setVideoMetadata(config.outputPath, config.metadata, config.outputPath, ctx);
    }

    // ------------------------------------------------------------------
    // 10. Return Result
    // ------------------------------------------------------------------
    ctx.log('info', 'Composition completed successfully', 'compose');

    let finalDuration = 0;
    try {
      finalDuration = await probeDuration(config.outputPath, ctx);
    } catch {
      // Probe failure does not invalidate the successful compose result
    }

    return {
      success: true,
      outputPath: config.outputPath,
      duration: finalDuration,
      fileSize: fileSize(config.outputPath),
      error: null,
      tempFiles,
      composeTimeMs: Date.now() - startTimeMs,
    };

  } catch (err) {
    ctx.log('error', `Composition failed: ${err instanceof Error ? err.message : String(err)}`, 'compose');
    return {
      success: false,
      outputPath: config.outputPath,
      duration: 0,
      fileSize: 0,
      error: {
        code: 'COMPOSE_FAILED',
        message: err instanceof Error ? err.message : String(err),
        stderr: err instanceof Error ? (err.stack || '') : '',
        exitCode: null,
        command: [],
        timestamp: Date.now(),
      },
      tempFiles,
      composeTimeMs: Date.now() - startTimeMs,
    };
  } finally {
    // Always attempt to clean up temp files
    if (tempFiles.length > 0) {
      ctx.log('debug', `Cleaning up ${tempFiles.length} temp files`, 'compose');
      await removeFilesAsync(tempFiles).catch(() => {
        // Intentionally swallow cleanup errors
      });
    }
  }
}