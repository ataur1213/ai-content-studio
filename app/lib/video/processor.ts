// =============================================================================
// Video Job Processor — Executes Jobs using FFmpeg Studio
// =============================================================================

import type {
  VideoJob,
  FFmpegOperation,
  FFmpegProgress,
  JobResult,
  JobError,
  VideoOutput,
} from './types';
import type {
  SceneDetectionConfig,
  SilenceDetectionConfig,
} from '../ffmpeg/analyze';
import type {
  RenderConfig,
  VideoCodec as EngineVideoCodec,
  AudioCodec as EngineAudioCodec,
  VideoFormat as EngineVideoFormat,
  AudioFormat as EngineAudioFormat,
  ImageFormat as EngineImageFormat,
  ThumbnailConfig,
  WatermarkOperation,
  SubtitleConfig,
  AudioMixConfig,
  WatermarkConfig,
  RenderProgressCallback as EngineRenderProgressCallback,
} from '../ffmpeg/types';
import { VideoService, VideoServiceError } from '../video-service';
import {
  RESOLUTION_PRESETS,
  DEFAULT_RENDER_CONFIG,
} from '../ffmpeg/constants';
import { createJobError } from './errors';

// Initialize Video Service (singleton)
let videoService: VideoService | null = null;

async function getVideoService(): Promise<VideoService> {
  if (!videoService) {
    videoService = new VideoService();
    await videoService.initialize();
  }
  return videoService;
}

// Progress callback type
type ProgressCallback = (progress: FFmpegProgress) => void;

// Type guards for metadata values
function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return isArray(value) && value.every(isNumber);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isResolutionLike(value: unknown): value is { width: number; height: number } {
  if (!isObject(value)) return false;
  return isNumber(value.width) && isNumber(value.height);
}

function getNumberMetadata(metadata: VideoJob['metadata'], key: string): number | undefined {
  if (!metadata) return undefined;
  const value = metadata[key];
  return isNumber(value) ? value : undefined;
}

// =============================================================================
// Codec / Format Mapping Helpers
// =============================================================================

const ENGINE_VIDEO_FORMATS: ReadonlySet<EngineVideoFormat> = new Set<EngineVideoFormat>([
  'mp4', 'webm', 'mkv', 'avi', 'mov', 'gif',
]);

const ENGINE_AUDIO_FORMATS: ReadonlySet<EngineAudioFormat> = new Set<EngineAudioFormat>([
  'mp3', 'aac', 'wav', 'ogg', 'flac',
]);

const ENGINE_IMAGE_FORMATS: ReadonlySet<EngineImageFormat> = new Set<EngineImageFormat>([
  'png', 'jpg', 'jpeg', 'webp',
]);

const ENGINE_VIDEO_CODECS: ReadonlySet<EngineVideoCodec> = new Set<EngineVideoCodec>([
  'libx264',
  'libx265',
  'libvpx-vp9',
  'libaom-av1',
  'copy',
]);

const ENGINE_AUDIO_CODECS: ReadonlySet<EngineAudioCodec> = new Set<EngineAudioCodec>([
  'aac',
  'libmp3lame',
  'libopus',
  'copy',
]);

function mapVideoCodec(codec: VideoOutput['videoCodec']): EngineVideoCodec {
  switch (codec) {
    case 'h264': return 'libx264';
    case 'h265': return 'libx265';
    case 'vp8':
    case 'vp9': return 'libvpx-vp9';
    case 'av1': return 'libaom-av1';
    case 'copy': return 'copy';
    default: return 'libx264';
  }
}

function mapAudioCodec(codec: VideoOutput['audioCodec']): EngineAudioCodec {
  switch (codec) {
    case 'aac': return 'aac';
    case 'mp3': return 'libmp3lame';
    case 'opus': return 'libopus';
    case 'flac':
    case 'none':
    case 'copy': return 'copy';
    default: return 'aac';
  }
}

function mapVideoFormat(format: VideoOutput['format']): EngineVideoFormat {
  if (isString(format) && ENGINE_VIDEO_FORMATS.has(format as EngineVideoFormat)) {
    return format as EngineVideoFormat;
  }
  return DEFAULT_RENDER_CONFIG.format;
}

function mapAudioFormat(format: VideoOutput['format']): EngineAudioFormat {
  if (isString(format) && ENGINE_AUDIO_FORMATS.has(format as EngineAudioFormat)) {
    return format as EngineAudioFormat;
  }
  return 'mp3';
}

function resolveResolution(output: VideoOutput): NonNullable<RenderConfig['resolution']> {
  let resolution = DEFAULT_RENDER_CONFIG.resolution;
  if (output.resolution) {
    const preset = output.resolution.preset;
    if (preset !== 'custom' && preset in RESOLUTION_PRESETS) {
      resolution = RESOLUTION_PRESETS[preset as keyof typeof RESOLUTION_PRESETS];
    } else if (output.resolution.width && output.resolution.height) {
      resolution = { width: output.resolution.width, height: output.resolution.height };
    }
  }
  return resolution;
}

function getCustomRenderConfigOverrides(
  metadata: VideoJob['metadata'],
): Partial<RenderConfig> | null {
  const raw = metadata?.renderConfig;
  if (!isObject(raw)) return null;

  const overrides: Partial<RenderConfig> = {};

  if (isString(raw.format) && ENGINE_VIDEO_FORMATS.has(raw.format as EngineVideoFormat)) {
    overrides.format = raw.format as EngineVideoFormat;
  }

  if (isResolutionLike(raw.resolution)) {
    overrides.resolution = { width: raw.resolution.width, height: raw.resolution.height };
  }

  if (isNumber(raw.fps)) {
    overrides.fps = raw.fps;
  }

  if (isString(raw.videoCodec) && ENGINE_VIDEO_CODECS.has(raw.videoCodec as EngineVideoCodec)) {
    overrides.videoCodec = raw.videoCodec as EngineVideoCodec;
  }

  if (isString(raw.audioCodec) && ENGINE_AUDIO_CODECS.has(raw.audioCodec as EngineAudioCodec)) {
    overrides.audioCodec = raw.audioCodec as EngineAudioCodec;
  }

  if (raw.videoBitrate === null || isNumber(raw.videoBitrate) || isString(raw.videoBitrate)) {
    overrides.videoBitrate = raw.videoBitrate;
  }

  if (raw.audioBitrate === null || isNumber(raw.audioBitrate) || isString(raw.audioBitrate)) {
    overrides.audioBitrate = raw.audioBitrate;
  }

  if (isNumber(raw.crf)) {
    overrides.crf = raw.crf;
  }

  if (isString(raw.preset)) {
    overrides.preset = raw.preset;
  }

  if (isString(raw.tune)) {
    overrides.tune = raw.tune;
  }

  if (isString(raw.pixelFormat)) {
    overrides.pixelFormat = raw.pixelFormat;
  }

  if (typeof raw.overwrite === 'boolean') {
    overrides.overwrite = raw.overwrite;
  }

  if (raw.startTime === null || isNumber(raw.startTime)) {
    overrides.startTime = raw.startTime;
  }

  if (raw.duration === null || isNumber(raw.duration)) {
    overrides.duration = raw.duration;
  }

  if (typeof raw.twoPass === 'boolean') {
    overrides.twoPass = raw.twoPass;
  }

  if (isObject(raw.metadata)) {
    const meta: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.metadata)) {
      if (typeof v === 'string') {
        meta[k] = v;
      }
    }
    overrides.metadata = meta;
  }

  return overrides;
}

function mapThumbnailFormat(raw: unknown): EngineImageFormat {
  if (isString(raw) && ENGINE_IMAGE_FORMATS.has(raw as EngineImageFormat)) {
    return raw as EngineImageFormat;
  }
  return 'jpg';
}

function getWatermarkFromMetadata(metadata: VideoJob['metadata']): WatermarkConfig | null {
  if (!metadata) return null;
  const raw = metadata.watermark;
  if (!isObject(raw)) return null;
  // Narrow discriminated union by 'type' field
  if (raw.type === 'text') {
    return {
      type: 'text',
      text: isString(raw.text) ? raw.text : '',
      position: isString(raw.position) ? raw.position as WatermarkConfig['position'] : 'bottomRight',
      x: isNumber(raw.x) ? raw.x : null,
      y: isNumber(raw.y) ? raw.y : null,
      fontSize: isNumber(raw.fontSize) ? raw.fontSize : 24,
      fontColor: isString(raw.fontColor) ? raw.fontColor : '#FFFFFF',
      fontFamily: isString(raw.fontFamily) ? raw.fontFamily : 'Arial',
      opacity: isNumber(raw.opacity) ? raw.opacity : 1,
      shadowColor: isString(raw.shadowColor) ? raw.shadowColor : '#000000',
      shadowX: isNumber(raw.shadowX) ? raw.shadowX : 2,
      shadowY: isNumber(raw.shadowY) ? raw.shadowY : 2,
      outlineColor: isString(raw.outlineColor) ? raw.outlineColor : '#000000',
      outlineWidth: isNumber(raw.outlineWidth) ? raw.outlineWidth : 0,
      bold: typeof raw.bold === 'boolean' ? raw.bold : false,
      italic: typeof raw.italic === 'boolean' ? raw.italic : false,
    };
  }
  if (raw.type === 'image') {
    return {
      type: 'image',
      imagePath: isString(raw.imagePath) ? raw.imagePath : '',
      position: isString(raw.position) ? raw.position as WatermarkConfig['position'] : 'bottomRight',
      x: isNumber(raw.x) ? raw.x : null,
      y: isNumber(raw.y) ? raw.y : null,
      width: isNumber(raw.width) ? raw.width : null,
      height: isNumber(raw.height) ? raw.height : null,
      opacity: isNumber(raw.opacity) ? raw.opacity : 1,
    };
  }
  return null;
}

function getSubtitlesFromMetadata(metadata: VideoJob['metadata']): SubtitleConfig | null {
  if (!metadata) return null;
  const raw = metadata.subtitles;
  if (!isObject(raw)) return null;

  const allowedSubtitleFormats: ReadonlySet<SubtitleConfig['format']> = new Set(['srt', 'ass', 'vtt']);
  const format: SubtitleConfig['format'] =
    isString(raw.format) && allowedSubtitleFormats.has(raw.format as SubtitleConfig['format'])
      ? (raw.format as SubtitleConfig['format'])
      : 'srt';

  const entriesRaw = raw.entries;
  const entries: SubtitleConfig['entries'] = isArray(entriesRaw)
    ? entriesRaw.filter(isObject).map((e) => ({
        id: isString(e.id) ? e.id : String(Math.random()),
        startTime: isNumber(e.startTime) ? e.startTime : 0,
        endTime: isNumber(e.endTime) ? e.endTime : 0,
        text: isString(e.text) ? e.text : '',
      }))
    : [];

  const rawStyle = raw.style;
  const styleObj = isObject(rawStyle) ? rawStyle : {};
  const style: SubtitleConfig['style'] = {
    fontName: isString(styleObj.fontName) ? styleObj.fontName : 'Arial',
    fontSize: isNumber(styleObj.fontSize) ? styleObj.fontSize : 24,
    primaryColor: isString(styleObj.primaryColor) ? styleObj.primaryColor : '#FFFFFF',
    outlineColor: isString(styleObj.outlineColor) ? styleObj.outlineColor : '#000000',
    outlineWidth: isNumber(styleObj.outlineWidth) ? styleObj.outlineWidth : 2,
    shadow: isNumber(styleObj.shadow) ? styleObj.shadow : 0,
    alignment: isNumber(styleObj.alignment) ? styleObj.alignment : 2,
    marginV: isNumber(styleObj.marginV) ? styleObj.marginV : 10,
    marginL: isNumber(styleObj.marginL) ? styleObj.marginL : 10,
    marginR: isNumber(styleObj.marginR) ? styleObj.marginR : 10,
    bold: typeof styleObj.bold === 'boolean' ? styleObj.bold : false,
    italic: typeof styleObj.italic === 'boolean' ? styleObj.italic : false,
    position:
      isString(styleObj.position) && (styleObj.position === 'top' || styleObj.position === 'center' || styleObj.position === 'bottom')
        ? styleObj.position
        : 'bottom',
  };

  return {
    entries,
    style,
    format,
    outputPath: isString(raw.outputPath) ? raw.outputPath : null,
  };
}

// =============================================================================
// Map FFmpegOperation to actual FFmpeg Studio calls (including analysis)
// =============================================================================
async function executeOperation(
  job: VideoJob,
  onProgress?: ProgressCallback
): Promise<JobResult> {
  const service = await getVideoService();
  const startTime = Date.now();

  const operation: FFmpegOperation = job.operation;
  const inputs = job.inputs;
  const output = job.output;
  const metadata = job.metadata;

  const renderProgressCallback: EngineRenderProgressCallback = (progress) => {
    onProgress?.({
      frame: progress.frames,
      timeInSeconds: progress.percentage === null ? undefined : (progress.percentage / 100) * 60,
      bitrate: progress.currentKbps ?? undefined,
      speed: progress.speed ?? undefined,
      percentage: progress.percentage ?? undefined,
    });
  };

  switch (operation) {
    case 'transcode': {
      const inputPath = inputs[0]?.path;
      if (!inputPath) {
        throw new Error(`No input provided for ${operation}`);
      }

      const renderResult = await service.renderVideo(inputPath, {
        ...DEFAULT_RENDER_CONFIG,
        outputPath: output.path,
        format: mapVideoFormat(output.format),
        resolution: resolveResolution(output),
        fps: output.frameRate || 30,
        videoCodec: mapVideoCodec(output.videoCodec),
        audioCodec: mapAudioCodec(output.audioCodec),
        crf: 23,
        overwrite: output.overwrite ?? true,
        startTime: inputs[0]?.startTime ?? null,
        duration: inputs[0]?.duration ?? null,
      }, renderProgressCallback);

      if (!renderResult.success || renderResult.error) {
        throw new Error(renderResult.error?.message || `${operation} failed`);
      }

      return {
        outputPaths: [renderResult.outputPath],
        outputSizes: [renderResult.fileSize],
        processingDuration: renderResult.renderTimeMs,
        metadata: {
          duration: renderResult.duration,
          resolution: renderResult.resolution ?? undefined,
        },
      };
    }

    case 'resize': {
      const inputPath = inputs[0]?.path;
      if (!inputPath) {
        throw new Error(`No input provided for ${operation}`);
      }

      const renderResult = await service.renderVideo(inputPath, {
        ...DEFAULT_RENDER_CONFIG,
        outputPath: output.path,
        format: mapVideoFormat(output.format),
        resolution: resolveResolution(output),
        fps: output.frameRate || 30,
        videoCodec: mapVideoCodec(output.videoCodec),
        audioCodec: mapAudioCodec(output.audioCodec),
        crf: 23,
        overwrite: output.overwrite ?? true,
      }, renderProgressCallback);

      if (!renderResult.success || renderResult.error) {
        throw new Error(renderResult.error?.message || `${operation} failed`);
      }

      return {
        outputPaths: [renderResult.outputPath],
        outputSizes: [renderResult.fileSize],
        processingDuration: renderResult.renderTimeMs,
        metadata: {
          duration: renderResult.duration,
          resolution: renderResult.resolution ?? undefined,
        },
      };
    }

    case 'trim': {
      const inputPath = inputs[0]?.path;
      if (!inputPath) {
        throw new Error(`No input provided for ${operation}`);
      }

      const renderResult = await service.renderVideo(inputPath, {
        ...DEFAULT_RENDER_CONFIG,
        outputPath: output.path,
        format: mapVideoFormat(output.format),
        resolution: resolveResolution(output),
        fps: output.frameRate || 30,
        videoCodec: mapVideoCodec(output.videoCodec),
        audioCodec: mapAudioCodec(output.audioCodec),
        crf: 23,
        overwrite: output.overwrite ?? true,
        startTime: inputs[0]?.startTime ?? null,
        duration: inputs[0]?.duration ?? null,
      }, renderProgressCallback);

      if (!renderResult.success || renderResult.error) {
        throw new Error(renderResult.error?.message || `${operation} failed`);
      }

      return {
        outputPaths: [renderResult.outputPath],
        outputSizes: [renderResult.fileSize],
        processingDuration: renderResult.renderTimeMs,
        metadata: {
          duration: renderResult.duration,
          resolution: renderResult.resolution ?? undefined,
        },
      };
    }

    case 'extract-audio': {
      const inputPath = inputs[0]?.path;
      if (!inputPath) {
        throw new Error('No input provided for extract-audio');
      }

      const renderResult = await service.renderVideo(inputPath, {
        ...DEFAULT_RENDER_CONFIG,
        outputPath: output.path,
        format: mapVideoFormat(output.format),
        videoCodec: 'copy',
        audioCodec: mapAudioCodec(output.audioCodec),
        overwrite: output.overwrite ?? true,
      }, renderProgressCallback);

      if (!renderResult.success || renderResult.error) {
        throw new Error(renderResult.error?.message || 'Extract audio failed');
      }

      return {
        outputPaths: [renderResult.outputPath],
        outputSizes: [renderResult.fileSize],
        processingDuration: renderResult.renderTimeMs,
        metadata: {
          duration: renderResult.duration,
        },
      };
    }

    case 'detect-scenes': {
      const inputPath = inputs[0]?.path;
      if (!inputPath) {
        throw new Error('No input provided for detect-scenes');
      }

      onProgress?.({ percentage: 0 });

      const threshold =
        getNumberMetadata(metadata, 'threshold') ??
        getNumberMetadata(metadata, 'sceneThreshold');
      const minSceneDurationSec =
        getNumberMetadata(metadata, 'minSceneDurationSec') ??
        getNumberMetadata(metadata, 'minSceneDuration');

      const sceneConfig: SceneDetectionConfig = {
        inputPath,
        threshold,
        minSceneDurationSec,
        timeoutMs: job.timeout * 1000,
      };

      const result = await service.detectScenes(sceneConfig);

      onProgress?.({ percentage: 100 });

      return {
        outputPaths: [],
        processingDuration: Date.now() - startTime,
        metadata: {
          scenes: result,
        },
      };
    }

    case 'detect-silence': {
      const inputPath = inputs[0]?.path;
      if (!inputPath) {
        throw new Error('No input provided for detect-silence');
      }

      onProgress?.({ percentage: 0 });

      const noiseDb =
        getNumberMetadata(metadata, 'noiseDb') ??
        getNumberMetadata(metadata, 'silenceNoiseDb');
      const minSilenceDurationSec =
        getNumberMetadata(metadata, 'minSilenceDurationSec') ??
        getNumberMetadata(metadata, 'minSilenceDuration');

      const silenceConfig: SilenceDetectionConfig = {
        inputPath,
        noiseDb,
        minSilenceDurationSec,
        timeoutMs: job.timeout * 1000,
      };

      const result = await service.detectSilence(silenceConfig);

      onProgress?.({ percentage: 100 });

      return {
        outputPaths: [],
        processingDuration: Date.now() - startTime,
        metadata: {
          silence: result,
        },
      };
    }

    case 'concat': {
      const inputPaths = inputs.map(input => input.path).filter(Boolean) as string[];
      if (inputPaths.length < 2) {
        throw new Error('At least two inputs are required for concat');
      }

      const outputPath = await service.concatClips(inputPaths, output.path);

      return {
        outputPaths: [outputPath],
        processingDuration: Date.now() - startTime,
      };
    }

    case 'thumbnail': {
      const inputPath = inputs[0]?.path;
      if (!inputPath) {
        throw new Error('No input provided for thumbnail');
      }

      const thumbnailConfig: ThumbnailConfig = {
        inputPath,
        outputDir: output.path,
        timestamps: isNumberArray(metadata?.timestamps) ? metadata.timestamps : [1],
        count: isNumber(metadata?.count) ? metadata.count : null,
        width: isNumber(metadata?.width) ? metadata.width : 640,
        height: isNumber(metadata?.height) ? metadata.height : 360,
        format: mapThumbnailFormat(metadata?.format),
        quality: isNumber(metadata?.quality) ? metadata.quality : 85,
        filenamePattern: isString(metadata?.filenamePattern) ? metadata.filenamePattern : 'thumbnail_%t',
      };

      const thumbnailResults = await service.generateThumbnails(thumbnailConfig);

      return {
        outputPaths: thumbnailResults.map(t => t.path),
        outputSizes: thumbnailResults.map(t => t.size),
        processingDuration: Date.now() - startTime,
        metadata: {
          thumbnails: thumbnailResults,
        },
        thumbnails: thumbnailResults.map(t => t.path),
      };
    }

    case 'add-watermark': {
      const baseInputPath = inputs[0]?.path;
      if (!baseInputPath) {
        throw new Error('No base input provided for add-watermark');
      }

      const watermarkConfig = getWatermarkFromMetadata(metadata);
      if (!watermarkConfig) {
        throw new Error('Watermark configuration is required');
      }

      const watermarkOperation: WatermarkOperation = {
        baseInput: baseInputPath,
        outputPath: output.path,
        watermark: watermarkConfig,
        resolution: resolveResolution(output),
      };

      const outputPath = await service.addWatermark(watermarkOperation);

      return {
        outputPaths: [outputPath],
        processingDuration: Date.now() - startTime,
      };
    }

    case 'add-subtitles': {
      const baseInputPath = inputs[0]?.path;
      if (!baseInputPath) {
        throw new Error('No base input provided for add-subtitles');
      }

      const subtitleConfig = getSubtitlesFromMetadata(metadata);
      if (!subtitleConfig) {
        throw new Error('Subtitle configuration is required');
      }

      const outputPath = await service.burnSubtitles(
        baseInputPath,
        subtitleConfig,
        output.path,
      );

      return {
        outputPaths: [outputPath],
        processingDuration: Date.now() - startTime,
      };
    }

    case 'merge-audio': {
      const audioTracksRaw = metadata?.audioTracks;
      const sampleRateRaw = metadata?.sampleRate;
      const channelsRaw = metadata?.channels;
      const bitrateRaw = metadata?.bitrate;
      const durationRaw = metadata?.duration;

      if (!isArray(audioTracksRaw) || audioTracksRaw.length === 0) {
        throw new Error('Audio tracks are required for merge-audio');
      }

      const tracks: AudioMixConfig['tracks'] = audioTracksRaw
        .filter(isObject)
        .map((t) => ({
          id: isString(t.id) ? t.id : String(Math.random()),
          path: isString(t.path) ? t.path : '',
          startTime: isNumber(t.startTime) ? t.startTime : 0,
          duration: isNumber(t.duration) ? t.duration : null,
          volume: isNumber(t.volume) ? t.volume : 1,
          fadeIn: isNumber(t.fadeIn) ? t.fadeIn : 0,
          fadeOut: isNumber(t.fadeOut) ? t.fadeOut : 0,
          loop: typeof t.loop === 'boolean' ? t.loop : false,
          muted: typeof t.muted === 'boolean' ? t.muted : false,
        }));

      const mixConfig: AudioMixConfig = {
        tracks,
        outputPath: output.path,
        format: mapAudioFormat(output.format),
        sampleRate: isNumber(sampleRateRaw) ? sampleRateRaw : 44100,
        channels: isNumber(channelsRaw) ? channelsRaw : 2,
        bitrate: isString(bitrateRaw) ? bitrateRaw : '192k',
        duration: isNumber(durationRaw) ? durationRaw : null,
      };

      const outputPath = await service.mixAudioTracks(mixConfig);

      return {
        outputPaths: [outputPath],
        processingDuration: Date.now() - startTime,
      };
    }

    case 'custom': {
      const inputPath = inputs[0]?.path;
      if (!inputPath) {
        throw new Error('No input provided for custom');
      }

      const overrides = getCustomRenderConfigOverrides(metadata);
      if (!overrides) {
        throw new Error('metadata.renderConfig is required for custom');
      }

      const renderResult = await service.renderVideo(
        inputPath,
        {
          ...DEFAULT_RENDER_CONFIG,
          ...overrides,
          outputPath: output.path,
          overwrite: overrides.overwrite ?? (output.overwrite ?? true),
        },
        renderProgressCallback,
      );

      if (!renderResult.success || renderResult.error) {
        throw new Error(renderResult.error?.message || 'Custom render failed');
      }

      return {
        outputPaths: [renderResult.outputPath],
        outputSizes: [renderResult.fileSize],
        processingDuration: renderResult.renderTimeMs,
        metadata: {
          duration: renderResult.duration,
          resolution: renderResult.resolution ?? undefined,
        },
      };
    }

    default:
      throw new Error(`Operation ${operation} not implemented yet`);
  }
}

// =============================================================================
// Process a single video job
// =============================================================================
export async function processJob(
  job: VideoJob,
  onProgress?: ProgressCallback
): Promise<{
  success: boolean;
  result?: JobResult;
  error?: JobError;
}> {
  try {
    const result = await executeOperation(job, onProgress);
    return {
      success: true,
      result,
    };
  } catch (err) {
    const isPlainObj = typeof err === 'object' && err !== null && !(err instanceof Error);
    const extractedMessage: string =
      err instanceof Error ? err.message :
      isPlainObj && typeof (err as { message?: unknown }).message === 'string' ? (err as { message: string }).message :
      String(err);

    const extractedStack: string | undefined =
      err instanceof Error ? err.stack :
      isPlainObj && typeof (err as { stack?: unknown }).stack === 'string' ? (err as { stack: string }).stack :
      undefined;

    const extractedCause: unknown =
      err instanceof Error ? (err as { cause?: unknown }).cause ?? err :
      err;

    const preservedError: Error =
      err instanceof Error ? err :
      Object.assign(new Error(extractedMessage), { stack: extractedStack, cause: extractedCause });

    const category =
      err instanceof VideoServiceError ? 'system' :
      preservedError.name === 'VideoServiceError' ? 'system' :
      'processing';
    const error = createJobError({
      code: 'PROCESSING_ERROR',
      message: extractedMessage,
      category,
      severity: 'high',
      originalError: preservedError,
    });
    return {
      success: false,
      error,
    };
  }
}

export { getVideoService };
