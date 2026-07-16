// =============================================================================
// AI Video Generator — FFmpeg Engine High-Level Composer
// =============================================================================

import type {
  FFmpegContext,
  ComposeConfig,
  ComposeResult,
  RenderConfig,
  VideoMetadata,
  TimelineClip,
} from './types';
import {
  DEFAULT_AUDIO_BITRATE,
} from './constants';
import {
  removeFilesAsync,
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
} from './audio';
import {
  render,
} from './render';
import {
  setVideoMetadata,
} from './seo';

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
        const hasKenBurns = clip.filters.some(f => f.type === 'kenburns');
        if (hasKenBurns) {
          const outPath = tempVideoPath(ctx.tempDir);
          await kenBurnsEffect({
            imagePath: clip.mediaPath,
            outputPath: outPath,
            duration: clip.duration,
            fps: config.fps,
            resolution: config.resolution,
            direction: 'zoomIn',
            zoomFactor: 1.2,
            easing: 'easeInOut',
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
    if (config.defaultTransition !== 'none' && processedClips.length > 1) {
      ctx.log('info', 'Applying transitions between clips', 'compose');
      let mergedPath = processedClips[0];
      
      for (let i = 1; i < processedClips.length; i++) {
        const outPath = tempVideoPath(ctx.tempDir);
        await applyTransition({
          inputA: mergedPath,
          inputB: processedClips[i],
          outputPath: outPath,
          transition: config.defaultTransition,
          duration: config.transitionDuration,
          offset: null,
          resolution: config.resolution,
          fps: config.fps,
        }, ctx);
        
        // Cleanup intermediate files (except the very first original clip)
        if (mergedPath !== processedClips[0]) {
          tempFiles.push(mergedPath);
        }
        mergedPath = outPath;
      }
      currentPath = mergedPath;
    } else {
      if (processedClips.length > 1) {
        const outPath = tempVideoPath(ctx.tempDir);
        await concatClips(processedClips, outPath, ctx);
        currentPath = outPath;
      } else {
        currentPath = processedClips[0];
      }
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
      
      await mergeVoiceWithMusic(
        currentPath,
        config.voiceTrack || {
          voicePath: '',
          startTime: 0,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0,
        },
        config.backgroundMusic,
        nextPath,
        ctx,
      );
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

    return {
      success: true,
      outputPath: config.outputPath,
      duration: 0, // Could probe, but unnecessary overhead here
      fileSize: 0,
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