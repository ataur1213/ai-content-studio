// =============================================================================
// AI Video Generator — FFmpeg Engine SEO / Metadata Injection
// =============================================================================

import type {
  FFmpegContext,
  VideoMetadata,
  CommandConfig,
} from './types';
import {
  METADATA_KEY_MAP,
} from './constants';
import {
  ensureDir,
} from './utils';
import {
  executeFFmpeg,
} from './command';

// =============================================================================
// Metadata Injection
// =============================================================================

/**
 * Inject SEO metadata into a video file without re-encoding.
 * Uses stream copy (-c copy) making this operation complete in under a second.
 * Maps internal VideoMetadata fields to standard FFmpeg metadata keys.
 */
export async function setVideoMetadata(
  inputPath: string,
  metadata: VideoMetadata,
  outputPath: string,
  ctx: FFmpegContext,
): Promise<string> {
  ensureDir(outputPath);

  const ffMetadata: Record<string, string> = {};

  // Map standard fields to FFmpeg keys
  const entries = Object.entries(metadata) as [keyof VideoMetadata, unknown][];
  
  for (const [key, value] of entries) {
    // Handle keywords array separately (often mapped to 'comment' or 'purl' for platforms)
    if (key === 'keywords') {
      const kwArray = value as string[];
      if (kwArray.length > 0) {
        ffMetadata['comment'] = kwArray.join(', ');
      }
      continue;
    }

    // Merge custom key-value pairs directly
    if (key === 'custom') {
      const customObj = value as Record<string, string>;
      Object.assign(ffMetadata, customObj);
      continue;
    }

    // Skip empty/zero values
    if (value === null || value === undefined || value === '' || value === 0) {
      continue;
    }

    // Map to FFmpeg specific key
    const ffKey = METADATA_KEY_MAP[key];
    if (ffKey) {
      ffMetadata[ffKey] = String(value);
    }
  }

  const commandConfig: CommandConfig = {
    binary: ctx.ffmpegPath,
    inputs: [
      {
        path: inputPath,
        index: 0,
        duration: null,
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
        map: ['0'], // Keep all streams (video, audio, subtitles)
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
        movFlags: '+faststart', // Re-mux fast start for web playback
        metadata: ffMetadata,
        overwrite: true,
        extraArgs: [],
      },
    ],
    globalArgs: ['-hide_banner'],
    timeoutMs: 30000, // Metadata injection is very fast
  };

  const metaCount = Object.keys(ffMetadata).length;
  ctx.log('info', `Injecting ${metaCount} metadata fields into ${outputPath}`, 'seo');
  
  await executeFFmpeg(commandConfig, ctx);
  
  return outputPath;
}