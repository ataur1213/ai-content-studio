// =============================================================================
// AI Video Generator — FFmpeg Engine Validation
// =============================================================================
// Strict validation for all configuration objects before they reach FFmpeg.
// Fails fast with detailed error arrays to prevent cryptic FFmpeg crashes.
// Depends on types.ts, constants.ts, utils.ts (Layer 0-2).
// =============================================================================

import type {
  Resolution,
  VideoCodec,
  AudioCodec,
  VideoFormat,
  AudioFormat,
  ImageFormat,
  SubtitleFormat,
  TransitionType,
  KenBurnsDirection,
  AnchorPosition,
  AnimationType,
  WatermarkConfig,
  TextWatermarkConfig,
  ImageWatermarkConfig,
  VideoMetadata,
  ValidationError,
  ValidationResult,
  RenderConfig,
  StudioConfig,
  SubtitleConfig,
  TimelineClip,
  ComposeConfig,
  ImageToVideoConfig,
  KenBurnsConfig,
  SlideshowConfig,
  AudioMixConfig,
  AudioTrack,
  BackgroundMusicConfig,
  VoiceConfig,
  TransitionConfig,
  ThumbnailConfig,
  OverlayConfig,
  AnimationConfig,
  WatermarkOperation,
  IntroConfig,
  OutroConfig,
} from './types';
import {
  MIN_RESOLUTION_WIDTH,
  MIN_RESOLUTION_HEIGHT,
  MAX_RESOLUTION_WIDTH,
  MAX_RESOLUTION_HEIGHT,
  MIN_FPS,
  MAX_FPS,
  MIN_CRF,
  MAX_CRF,
  MAX_THUMBNAIL_SOURCE_SIZE,
  MAX_COMPOSE_CLIPS,
  MAX_OVERLAYS,
  MAX_SUBTITLE_ENTRIES,
  MAX_AUDIO_TRACKS,
  VALID_TRANSITION_TYPES,
  DEFAULT_RENDER_CONFIG,
  DEFAULT_STUDIO_CONFIG,
  VIDEO_FORMAT_MAP,
  AUDIO_FORMAT_MAP,
  CODEC_PIXEL_FORMATS,
} from './constants';
import {
  fileExists,
  getFileExtension,
  isPlainObject,
  finiteOr,
} from './utils';

// =============================================================================
// Validation Result Helpers
// =============================================================================

/** Create a single validation error. */
export function createError(
  field: string,
  message: string,
  value?: unknown,
): ValidationError {
  return { field, message, value };
}

/** Create a successful validation result. */
export function valid(): ValidationResult {
  return { valid: true, errors: [] };
}

/** Create a failed validation result from one or more errors. */
export function invalid(...errors: ValidationError[]): ValidationResult {
  return { valid: false, errors };
}

/** Merge multiple validation results into one. */
export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap(r => r.errors);
  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Add a conditional error to a results array. */
function pushIf(
  errors: ValidationError[],
  condition: boolean,
  field: string,
  message: string,
  value?: unknown,
): void {
  if (condition) {
    errors.push(createError(field, message, value));
  }
}

// =============================================================================
// Primitive Validators
// =============================================================================

/** Validate a numeric range. */
export function validateRange(
  value: number,
  min: number,
  max: number,
  field: string,
): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isFinite(value), field, `Value must be a finite number`, value);
  pushIf(errors, value < min, field, `Value must be >= ${min}`, value);
  pushIf(errors, value > max, field, `Value must be <= ${max}`, value);
  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate that a string is non-empty. */
export function validateNonEmpty(value: string, field: string): ValidationResult {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return invalid(createError(field, 'Value must be a non-empty string', value));
  }
  return valid();
}

/** Validate that a value is one of a set of allowed values. */
export function validateEnum<T extends string | number>(
  value: T,
  allowed: readonly T[],
  field: string,
): ValidationResult {
  if (!allowed.includes(value)) {
    return invalid(createError(
      field,
      `Value must be one of: ${allowed.join(', ')}`,
      value,
    ));
  }
  return valid();
}

/** Validate that a file exists and has an allowed extension. */
export function validateFileExists(
  filePath: string,
  field: string,
  allowedExtensions?: string[],
): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !filePath || typeof filePath !== 'string', field, 'File path is missing or invalid', filePath);
  
  if (errors.length > 0) return invalid(...errors);

  pushIf(errors, !fileExists(filePath), field, `File does not exist: ${filePath}`, filePath);

  if (allowedExtensions && allowedExtensions.length > 0) {
    const ext = getFileExtension(filePath);
    pushIf(
      errors,
      !allowedExtensions.includes(ext),
      field,
      `File extension must be one of: ${allowedExtensions.join(', ')}`,
      ext,
    );
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

// =============================================================================
// Core Type Validators
// =============================================================================

/** Validate a Resolution object. */
export function validateResolution(res: Resolution, field: string = 'resolution'): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(res), field, 'Resolution must be an object', res);
  if (!isPlainObject(res)) return invalid(...errors);

  pushIf(errors, typeof res.width !== 'number' || !isFinite(res.width), `${field}.width`, 'Width must be a finite number', res.width);
  pushIf(errors, typeof res.height !== 'number' || !isFinite(res.height), `${field}.height`, 'Height must be a finite number', res.height);

  if (typeof res.width === 'number' && isFinite(res.width)) {
    pushIf(errors, res.width < MIN_RESOLUTION_WIDTH, `${field}.width`, `Width must be >= ${MIN_RESOLUTION_WIDTH}`, res.width);
    pushIf(errors, res.width > MAX_RESOLUTION_WIDTH, `${field}.width`, `Width must be <= ${MAX_RESOLUTION_WIDTH}`, res.width);
  }
  if (typeof res.height === 'number' && isFinite(res.height)) {
    pushIf(errors, res.height < MIN_RESOLUTION_HEIGHT, `${field}.height`, `Height must be >= ${MIN_RESOLUTION_HEIGHT}`, res.height);
    pushIf(errors, res.height > MAX_RESOLUTION_HEIGHT, `${field}.height`, `Height must be <= ${MAX_RESOLUTION_HEIGHT}`, res.height);
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate FPS value. */
export function validateFps(fps: number, field: string = 'fps'): ValidationResult {
  return validateRange(fps, MIN_FPS, MAX_FPS, field);
}

/** Validate CRF value. */
export function validateCrf(crf: number, field: string = 'crf'): ValidationResult {
  return validateRange(crf, MIN_CRF, MAX_CRF, field);
}

/** Validate a video codec string. */
export function validateVideoCodec(codec: VideoCodec, field: string = 'videoCodec'): ValidationResult {
  return validateEnum(codec, Object.keys(CODEC_PIXEL_FORMATS) as VideoCodec[], field);
}

/** Validate an audio codec string. */
export function validateAudioCodec(codec: AudioCodec, field: string = 'audioCodec'): ValidationResult {
  return validateEnum(codec, ['aac', 'libmp3lame', 'libopus', 'pcm_s16le', 'copy'] as AudioCodec[], field);
}

/** Validate a video format string. */
export function validateVideoFormat(format: VideoFormat, field: string = 'format'): ValidationResult {
  return validateEnum(format, Object.keys(VIDEO_FORMAT_MAP) as VideoFormat[], field);
}

/** Validate an audio format string. */
export function validateAudioFormat(format: AudioFormat, field: string = 'format'): ValidationResult {
  return validateEnum(format, Object.keys(AUDIO_FORMAT_MAP) as AudioFormat[], field);
}

// =============================================================================
// Config Object Validators
// =============================================================================

/** Validate the top-level StudioConfig. */
export function validateStudioConfig(config: Partial<StudioConfig>): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'StudioConfig must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  // ffmpegPath is optional (can fallback to static/system), but if provided must be string
  if (config.ffmpegPath !== undefined) {
    pushIf(errors, typeof config.ffmpegPath !== 'string', 'ffmpegPath', 'Must be a string', config.ffmpegPath);
  }
  if (config.ffprobePath !== undefined) {
    pushIf(errors, typeof config.ffprobePath !== 'string', 'ffprobePath', 'Must be a string', config.ffprobePath);
  }
  if (config.tempDir !== undefined) {
    pushIf(errors, typeof config.tempDir !== 'string', 'tempDir', 'Must be a string', config.tempDir);
  }
  if (config.logLevel !== undefined) {
    pushIf(errors, !['debug', 'info', 'warn', 'error', 'silent'].includes(config.logLevel), 'logLevel', 'Invalid log level', config.logLevel);
  }
  if (config.maxConcurrentRenders !== undefined) {
    pushIf(errors, !Number.isInteger(config.maxConcurrentRenders) || config.maxConcurrentRenders < 1, 'maxConcurrentRenders', 'Must be an integer >= 1', config.maxConcurrentRenders);
  }
  if (config.hardwareAccel !== undefined) {
    pushIf(errors, !['none', 'cuda', 'qsv', 'dxva2', 'd3d11va', 'vaapi', 'vdpau'].includes(config.hardwareAccel), 'hardwareAccel', 'Invalid hardware acceleration type', config.hardwareAccel);
  }
  if (config.defaultResolution !== undefined) {
    const resResult = validateResolution(config.defaultResolution, 'defaultResolution');
    errors.push(...resResult.errors);
  }
  if (config.defaultFps !== undefined) {
    const fpsResult = validateFps(config.defaultFps, 'defaultFps');
    errors.push(...fpsResult.errors);
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate a full RenderConfig. */
export function validateRenderConfig(config: Partial<RenderConfig>): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'RenderConfig must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  if (config.outputPath !== undefined) {
    const r = validateNonEmpty(config.outputPath, 'outputPath');
    errors.push(...r.errors);
  }
  if (config.format !== undefined) {
    const r = validateVideoFormat(config.format, 'format');
    errors.push(...r.errors);
  }
  if (config.resolution !== undefined) {
    const r = validateResolution(config.resolution, 'resolution');
    errors.push(...r.errors);
  }
  if (config.fps !== undefined) {
    const r = validateFps(config.fps, 'fps');
    errors.push(...r.errors);
  }
  if (config.videoCodec !== undefined) {
    const r = validateVideoCodec(config.videoCodec, 'videoCodec');
    errors.push(...r.errors);
  }
  if (config.audioCodec !== undefined) {
    const r = validateAudioCodec(config.audioCodec, 'audioCodec');
    errors.push(...r.errors);
  }
  if (config.crf !== undefined && config.crf !== null) {
    const r = validateCrf(config.crf, 'crf');
    errors.push(...r.errors);
  }
  if (config.twoPass !== undefined) {
    pushIf(errors, typeof config.twoPass !== 'boolean', 'twoPass', 'Must be a boolean', config.twoPass);
  }
  if (config.metadata !== undefined) {
    pushIf(errors, !isPlainObject(config.metadata), 'metadata', 'Must be a plain object', config.metadata);
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate ImageToVideoConfig. */
export function validateImageToVideoConfig(config: ImageToVideoConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateFileExists(config.imagePath, 'imagePath', ['png', 'jpg', 'jpeg', 'webp']).errors);
  errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  errors.push(...validateRange(config.duration, 0.1, 3600, 'duration').errors);
  errors.push(...validateFps(config.fps, 'fps').errors);
  errors.push(...validateResolution(config.resolution, 'resolution').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate KenBurnsConfig. */
export function validateKenBurnsConfig(config: KenBurnsConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateFileExists(config.imagePath, 'imagePath', ['png', 'jpg', 'jpeg', 'webp']).errors);
  errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  errors.push(...validateRange(config.duration, 0.1, 3600, 'duration').errors);
  errors.push(...validateFps(config.fps, 'fps').errors);
  errors.push(...validateResolution(config.resolution, 'resolution').errors);
  errors.push(...validateEnum(
    config.direction,
    ['zoomIn', 'zoomOut', 'panLeft', 'panRight', 'panUp', 'panDown', 'diagonalTL', 'diagonalTR', 'diagonalBL', 'diagonalBR'] as KenBurnsDirection[],
    'direction',
  ).errors);
  errors.push(...validateRange(config.zoomFactor, 1.0, 5.0, 'zoomFactor').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate SlideshowConfig. */
export function validateSlideshowConfig(config: SlideshowConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  pushIf(errors, !Array.isArray(config.images) || config.images.length === 0, 'images', 'Must be a non-empty array of image paths', config.images);
  if (Array.isArray(config.images)) {
    for (let i = 0; i < config.images.length; i++) {
      errors.push(...validateFileExists(config.images[i], `images[${i}]`, ['png', 'jpg', 'jpeg', 'webp']).errors);
    }
  }
  errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  errors.push(...validateRange(config.durationPerImage, 0.1, 3600, 'durationPerImage').errors);
  errors.push(...validateFps(config.fps, 'fps').errors);
  errors.push(...validateResolution(config.resolution, 'resolution').errors);
  
  if (config.transition !== 'none') {
    errors.push(...validateEnum(config.transition, VALID_TRANSITION_TYPES, 'transition').errors);
  }
  errors.push(...validateRange(config.transitionDuration, 0, config.durationPerImage, 'transitionDuration').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate a single AudioTrack. */
export function validateAudioTrack(track: AudioTrack, field: string = 'track'): ValidationResult {
  const errors: ValidationError[] = [];
  errors.push(...validateFileExists(track.path, `${field}.path`, ['mp3', 'aac', 'wav', 'ogg', 'flac', 'm4a', 'mp4']).errors);
  errors.push(...validateRange(track.volume, 0, 2, `${field}.volume`).errors);
  errors.push(...validateRange(track.fadeIn, 0, 60, `${field}.fadeIn`).errors);
  errors.push(...validateRange(track.fadeOut, 0, 60, `${field}.fadeOut`).errors);
  errors.push(...validateRange(track.startTime, 0, 86400, `${field}.startTime`).errors);
  if (track.duration !== null && track.duration !== undefined) {
    errors.push(...validateRange(track.duration, 0.1, 86400, `${field}.duration`).errors);
  }
  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate AudioMixConfig. */
export function validateAudioMixConfig(config: AudioMixConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  pushIf(errors, !Array.isArray(config.tracks) || config.tracks.length === 0, 'tracks', 'Must be a non-empty array', config.tracks);
  pushIf(errors, config.tracks.length > MAX_AUDIO_TRACKS, 'tracks', `Maximum ${MAX_AUDIO_TRACKS} tracks allowed`, config.tracks.length);
  
  if (Array.isArray(config.tracks)) {
    for (let i = 0; i < config.tracks.length; i++) {
      errors.push(...validateAudioTrack(config.tracks[i], `tracks[${i}]`).errors);
    }
  }

  errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  errors.push(...validateAudioFormat(config.format, 'format').errors);
  errors.push(...validateRange(config.sampleRate, 8000, 192000, 'sampleRate').errors);
  errors.push(...validateRange(config.channels, 1, 8, 'channels').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate BackgroundMusicConfig. */
export function validateBackgroundMusicConfig(config: BackgroundMusicConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateFileExists(config.musicPath, 'musicPath', ['mp3', 'aac', 'wav', 'ogg', 'flac', 'm4a']).errors);
  errors.push(...validateRange(config.volume, 0, 2, 'volume').errors);
  errors.push(...validateRange(config.fadeIn, 0, 60, 'fadeIn').errors);
  errors.push(...validateRange(config.fadeOut, 0, 60, 'fadeOut').errors);
  errors.push(...validateRange(config.trimStart, 0, 86400, 'trimStart').errors);
  errors.push(...validateRange(config.trimEnd, 0, 86400, 'trimEnd').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate VoiceConfig. */
export function validateVoiceConfig(config: VoiceConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateFileExists(config.voicePath, 'voicePath', ['mp3', 'aac', 'wav', 'ogg', 'm4a']).errors);
  errors.push(...validateRange(config.startTime, 0, 86400, 'startTime').errors);
  errors.push(...validateRange(config.volume, 0, 2, 'volume').errors);
  errors.push(...validateRange(config.fadeIn, 0, 60, 'fadeIn').errors);
  errors.push(...validateRange(config.fadeOut, 0, 60, 'fadeOut').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate TransitionConfig. */
export function validateTransitionConfig(config: TransitionConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateFileExists(config.inputA, 'inputA', ['mp4', 'webm', 'mkv', 'mov', 'avi']).errors);
  errors.push(...validateFileExists(config.inputB, 'inputB', ['mp4', 'webm', 'mkv', 'mov', 'avi']).errors);
  errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  
  if (config.transition !== 'none') {
    errors.push(...validateEnum(config.transition, VALID_TRANSITION_TYPES, 'transition').errors);
  }
  errors.push(...validateRange(config.duration, 0, 10, 'duration').errors);
  errors.push(...validateResolution(config.resolution, 'resolution').errors);
  errors.push(...validateFps(config.fps, 'fps').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate OverlayConfig. */
export function validateOverlayConfig(config: OverlayConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateFileExists(config.overlayPath, 'overlayPath', ['png', 'webp', 'gif', 'mp4', 'webm']).errors);
  errors.push(...validateFileExists(config.baseInput, 'baseInput', ['mp4', 'webm', 'mkv', 'mov']).errors);
  errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  errors.push(...validateRange(config.timing.startTime, 0, 86400, 'timing.startTime').errors);
  errors.push(...validateRange(config.timing.duration, 0.1, 3600, 'timing.duration').errors);
  errors.push(...validateRange(config.timing.opacity, 0, 1, 'timing.opacity').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate AnimationConfig. */
export function validateAnimationConfig(config: AnimationConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateEnum(config.type, ['like', 'subscribe', 'follow', 'bell', 'comment', 'share'] as AnimationType[], 'type').errors);
  errors.push(...validateFileExists(config.assetPath, 'assetPath', ['png', 'webp', 'gif']).errors);
  errors.push(...validateRange(config.timing.startTime, 0, 86400, 'timing.startTime').errors);
  errors.push(...validateRange(config.timing.duration, 0.1, 60, 'timing.duration').errors);
  errors.push(...validateRange(config.timing.opacity, 0, 1, 'timing.opacity').errors);
  errors.push(...validateRange(config.scale, 0.1, 10, 'scale').errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate WatermarkConfig (discriminated union). */
export function validateWatermarkConfig(config: WatermarkConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  if (config.type === 'text') {
    const tc = config as TextWatermarkConfig;
    errors.push(...validateNonEmpty(tc.text, 'text').errors);
    errors.push(...validateRange(tc.fontSize, 8, 200, 'fontSize').errors);
    errors.push(...validateRange(tc.opacity, 0, 1, 'opacity').errors);
  } else if (config.type === 'image') {
    const ic = config as ImageWatermarkConfig;
    errors.push(...validateFileExists(ic.imagePath, 'imagePath', ['png', 'webp', 'jpg', 'jpeg']).errors);
    errors.push(...validateRange(ic.opacity, 0, 1, 'opacity').errors);
  } else {
    errors.push(createError('type', 'Watermark type must be "text" or "image"', config.type));
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate WatermarkOperation (full watermark execution config). */
export function validateWatermarkOperation(config: WatermarkOperation): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateFileExists(config.baseInput, 'baseInput').errors);
  errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  errors.push(...validateResolution(config.resolution, 'resolution').errors);
  errors.push(...validateWatermarkConfig(config.watermark).errors);

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate SubtitleConfig. */
export function validateSubtitleConfig(config: SubtitleConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  pushIf(errors, !Array.isArray(config.entries), 'entries', 'Must be an array', config.entries);
  pushIf(errors, config.entries.length > MAX_SUBTITLE_ENTRIES, 'entries', `Maximum ${MAX_SUBTITLE_ENTRIES} entries allowed`, config.entries.length);
  
  if (Array.isArray(config.entries)) {
    for (let i = 0; i < config.entries.length; i++) {
      const entry = config.entries[i];
      pushIf(errors, !isPlainObject(entry), `entries[${i}]`, 'Must be an object', entry);
      if (isPlainObject(entry)) {
        pushIf(errors, typeof entry.text !== 'string' || entry.text.trim().length === 0, `entries[${i}].text`, 'Text must be non-empty', entry.text);
        pushIf(errors, typeof entry.startTime !== 'number' || !isFinite(entry.startTime) || entry.startTime < 0, `entries[${i}].startTime`, 'Must be a finite number >= 0', entry.startTime);
        pushIf(errors, typeof entry.endTime !== 'number' || !isFinite(entry.endTime) || entry.endTime <= 0, `entries[${i}].endTime`, 'Must be a finite number > 0', entry.endTime);
        if (isFinite(entry.startTime) && isFinite(entry.endTime)) {
          pushIf(errors, entry.endTime <= entry.startTime, `entries[${i}]`, 'endTime must be > startTime', { startTime: entry.startTime, endTime: entry.endTime });
        }
      }
    }
  }

  errors.push(...validateEnum(config.format, ['srt', 'ass', 'vtt'] as SubtitleFormat[], 'format').errors);

  if (config.outputPath !== undefined && config.outputPath !== null) {
    errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate ThumbnailConfig. */
export function validateThumbnailConfig(config: ThumbnailConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  errors.push(...validateFileExists(config.inputPath, 'inputPath').errors);
  errors.push(...validateNonEmpty(config.outputDir, 'outputDir').errors);
  
  pushIf(errors, config.width < 16, 'width', 'Width must be >= 16', config.width);
  pushIf(errors, config.height < 16, 'height', 'Height must be >= 16', config.height);
  errors.push(...validateRange(config.quality, 1, 31, 'quality').errors);

  if (config.timestamps !== undefined && config.timestamps !== null) {
    pushIf(errors, !Array.isArray(config.timestamps), 'timestamps', 'Must be an array', config.timestamps);
    if (Array.isArray(config.timestamps)) {
      for (let i = 0; i < config.timestamps.length; i++) {
        pushIf(errors, typeof config.timestamps[i] !== 'number' || !isFinite(config.timestamps[i]) || config.timestamps[i] < 0, `timestamps[${i}]`, 'Must be a finite number >= 0', config.timestamps[i]);
      }
    }
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate IntroConfig. */
export function validateIntroConfig(config: IntroConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  pushIf(errors, typeof config.enabled !== 'boolean', 'enabled', 'Must be a boolean', config.enabled);
  
  if (config.enabled) {
    if (config.sourcePath !== null && config.sourcePath !== undefined) {
      errors.push(...validateFileExists(config.sourcePath, 'sourcePath', ['mp4', 'webm', 'mkv', 'mov']).errors);
    }
    errors.push(...validateRange(config.duration, 0.5, 60, 'duration').errors);
    errors.push(...validateResolution(config.resolution, 'resolution').errors);
    errors.push(...validateFps(config.fps, 'fps').errors);
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate OutroConfig. */
export function validateOutroConfig(config: OutroConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  pushIf(errors, typeof config.enabled !== 'boolean', 'enabled', 'Must be a boolean', config.enabled);
  
  if (config.enabled) {
    if (config.sourcePath !== null && config.sourcePath !== undefined) {
      errors.push(...validateFileExists(config.sourcePath, 'sourcePath', ['mp4', 'webm', 'mkv', 'mov']).errors);
    }
    errors.push(...validateRange(config.duration, 0.5, 60, 'duration').errors);
    errors.push(...validateResolution(config.resolution, 'resolution').errors);
    errors.push(...validateFps(config.fps, 'fps').errors);
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate a single TimelineClip. */
export function validateTimelineClip(clip: TimelineClip, index: number): ValidationResult {
  const field = `clips[${index}]`;
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(clip), field, 'Must be an object', clip);
  if (!isPlainObject(clip)) return invalid(...errors);

  errors.push(...validateNonEmpty(clip.id, `${field}.id`).errors);
  errors.push(...validateFileExists(clip.mediaPath, `${field}.mediaPath`).errors);
  errors.push(...validateEnum(clip.type, ['video', 'image', 'audio'], `${field}.type`).errors);
  errors.push(...validateRange(clip.startTime, 0, 86400, `${field}.startTime`).errors);
  errors.push(...validateRange(clip.duration, 0.01, 86400, `${field}.duration`).errors);
  errors.push(...validateRange(clip.volume, 0, 5, `${field}.volume`).errors);
  errors.push(...validateRange(clip.speed, 0.1, 100, `${field}.speed`).errors);

  if (clip.transition) {
    if (clip.transition.type !== 'none') {
      errors.push(...validateEnum(clip.transition.type, VALID_TRANSITION_TYPES, `${field}.transition.type`).errors);
    }
    errors.push(...validateRange(clip.transition.duration, 0, clip.duration, `${field}.transition.duration`).errors);
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/** Validate the full ComposeConfig (high-level composition request). */
export function validateComposeConfig(config: ComposeConfig): ValidationResult {
  const errors: ValidationError[] = [];
  pushIf(errors, !isPlainObject(config), 'config', 'Must be an object', config);
  if (!isPlainObject(config)) return invalid(...errors);

  // Clips
  pushIf(errors, !Array.isArray(config.clips) || config.clips.length === 0, 'clips', 'Must be a non-empty array', config.clips);
  pushIf(errors, config.clips.length > MAX_COMPOSE_CLIPS, 'clips', `Maximum ${MAX_COMPOSE_CLIPS} clips allowed`, config.clips.length);
  if (Array.isArray(config.clips)) {
    for (let i = 0; i < config.clips.length; i++) {
      errors.push(...validateTimelineClip(config.clips[i], i).errors);
    }
  }

  // Output
  errors.push(...validateNonEmpty(config.outputPath, 'outputPath').errors);
  errors.push(...validateVideoFormat(config.format, 'format').errors);
  errors.push(...validateResolution(config.resolution, 'resolution').errors);
  errors.push(...validateFps(config.fps, 'fps').errors);
  errors.push(...validateVideoCodec(config.videoCodec, 'videoCodec').errors);
  errors.push(...validateAudioCodec(config.audioCodec, 'audioCodec').errors);

  if (config.crf !== undefined && config.crf !== null) {
    errors.push(...validateCrf(config.crf, 'crf').errors);
  }

  // Background music
  if (config.backgroundMusic) {
    errors.push(...validateBackgroundMusicConfig(config.backgroundMusic).errors);
  }

  // Voice track
  if (config.voiceTrack) {
    errors.push(...validateVoiceConfig(config.voiceTrack).errors);
  }

  // Subtitles
  if (config.subtitles) {
    errors.push(...validateSubtitleConfig(config.subtitles).errors);
  }

  // Watermark
  if (config.watermark) {
    errors.push(...validateWatermarkConfig(config.watermark).errors);
  }

  // Overlays
  if (config.overlays && config.overlays.length > 0) {
    pushIf(errors, config.overlays.length > MAX_OVERLAYS, 'overlays', `Maximum ${MAX_OVERLAYS} overlays allowed`, config.overlays.length);
    for (let i = 0; i < Math.min(config.overlays.length, MAX_OVERLAYS); i++) {
      errors.push(...validateAnimationConfig(config.overlays[i]).errors);
    }
  }

  // Intro / Outro
  errors.push(...validateIntroConfig(config.intro).errors);
  errors.push(...validateOutroConfig(config.outro).errors);

  // Metadata
  if (config.metadata) {
    pushIf(errors, !isPlainObject(config.metadata), 'metadata', 'Must be a plain object', config.metadata);
  }

  return errors.length === 0 ? valid() : invalid(...errors);
}

/**
 * Validate a config and throw a descriptive Error if invalid.
 * Convenience function for modules that prefer exceptions over result objects.
 */
export function assertValid<T>(
  config: T,
  validator: (c: T) => ValidationResult,
  context?: string,
): void {
  const result = validator(config);
  if (!result.valid) {
    const messages = result.errors.map(e => `[${e.field}] ${e.message}`).join('; ');
    throw new Error(`Validation failed${context ? ` for ${context}` : ''}: ${messages}`);
  }
}