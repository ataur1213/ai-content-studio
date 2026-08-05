// =============================================================================
// Subtitle Types
// =============================================================================

/** A single subtitle cue. */
export interface SubtitleEntry {
  id: string;
  startTime: Timestamp;
  endTime: Timestamp;
  text: string;
}

/** Visual styling for burned-in subtitles. */
export interface SubtitleStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  outlineWidth: number;
  shadow: number;
  alignment: number;
  marginV: number;
  marginL: number;
  marginR: number;
  bold: boolean;
  italic: boolean;
  position: 'top' | 'center' | 'bottom';
}

/** Subtitle burn-in operation. */
export interface SubtitleConfig {
  entries: SubtitleEntry[];
  style: SubtitleStyle;
  format: SubtitleFormat;
  outputPath: FilePath | null;
}

// =============================================================================
// Extended Subtitle Types for Dynamic Processing
// =============================================================================

/**
 * Extended subtitle entry for dynamic processing with word-level timing and grouping.
 * Extends the base SubtitleEntry with additional metadata for advanced subtitle features.
 */
export interface DynamicSubtitleEntry extends SubtitleEntry {
  /** Semantic group identifier for related subtitle segments */
  groupId?: string;
  /** Precise word-level timestamps for fine-grained synchronization */
  wordTimestamps?: WordTimestamp[];
}

/**
 * Individual word timestamp within a subtitle entry.
 * Used for word-level synchronization and highlighting in dynamic subtitle processing.
 */
export interface WordTimestamp {
  /** The word text */
  word: string;
  /** Start time of the word in seconds */
  startTime: Timestamp;
  /** End time of the word in seconds */
  endTime: Timestamp;
}

/**
 * Configuration for popup caption animation effects.
 * Defines how important caption highlights are animated and positioned.
 */
export interface PopupCaptionConfig {
  /** Source subtitle entry being enhanced */
  subtitleEntry: SubtitleEntry;
  /** Animation type for caption entry */
  animationType: 'fadeIn' | 'scaleIn' | 'slideUp' | 'bounce';
  /** Duration of entry animation in seconds */
  animationDuration: number;
  /** Duration caption remains visible after animation in seconds */
  holdDuration: number;
  /** Exit animation type */
  exitAnimation: 'fadeOut' | 'scaleOut' | 'slideDown';
  /** Anchor position for caption placement */
  position: AnchorPosition;
  /** Optional X offset from anchor position */
  offsetX?: number;
  /** Optional Y offset from anchor position */
  offsetY?: number;
  /** Optional maximum width for popup caption */
  maxWidth?: number;
  /** Optional background color for popup caption */
  backgroundColor?: string;
  /** Optional border radius for rounded corners */
  borderRadius?: number;
}

/**
 * Configuration for animated emoji overlays synchronized with subtitles.
 * Enables dynamic emoji presentation during key moments in video content.
 */
export interface EmojiAnimationConfig {
  /** Path to the emoji asset file */
  emojiPath: FilePath;
  /** Source subtitle entry for synchronization */
  subtitleEntry: SubtitleEntry;
  /** Type of emoji animation to apply */
  animationType: 'float' | 'bounce' | 'pulse' | 'spin';
  /** Duration of a single animation cycle in seconds */
  animationDuration: number;
  /** Number of times to repeat the animation */
  loopCount: number;
  /** Delay between animation loops in seconds */
  loopDelay: number;
  /** Scale factor for emoji size */
  scale: number;
  /** Opacity level (0.0 to 1.0) */
  opacity: number;
  /** Z-index for layer ordering */
  zIndex: number;
}

/**
 * Configuration for dynamic subtitle processing with word grouping and synchronization.
 * Handles advanced subtitle features like semantic grouping and real-time word timing.
 */
export interface DynamicSubtitlesConfig {
  /** Base subtitle entry for processing */
  subtitleEntry: SubtitleEntry;
  /** Whether to enable word-level synchronization */
  wordSyncEnabled: boolean;
  /** Strategy for grouping related subtitle segments */
  groupingStrategy: 'none' | 'semantic' | 'duration' | 'importance';
  /** Minimum duration for individual words (seconds) */
  minWordDuration: number;
  /** Maximum duration for individual words (seconds) */
  maxWordDuration: number;
  /** Minimum duration required for a subtitle group (seconds) */
  minGroupDuration: number;
  /** Maximum duration allowed for a subtitle group (seconds) */
  maxGroupDuration: number;
  /** Sensitivity factor for group detection (0.0 to 1.0) */
  groupSensitivity: number;
}

/**
 * Container type for unified subtitle overlay pipeline entries.
 * Combines multiple subtitle enhancement types into a single processing unit.
 */
export interface SubtitleOverlayEntry {
  /** Unique identifier for the overlay entry */
  id: string;
  /** Source subtitle entry being processed */
  subtitleEntry: SubtitleEntry;
  /** Optional popup caption configuration */
  popupConfig?: PopupCaptionConfig;
  /** Optional emoji animation configuration */
  emojiConfig?: EmojiAnimationConfig;
  /** Optional dynamic subtitle processing configuration */
  dynamicConfig?: DynamicSubtitlesConfig;
}

/**
 * Complete configuration for subtitle processing pipeline.
 * Manages multiple overlay entries with unified validation and processing.
 */
export interface SubtitlePipelineConfig {
  /** Array of subtitle overlay entries to process */
  entries: SubtitleOverlayEntry[];
  /** Output path for processed subtitles */
  outputPath: FilePath;
  /** Base video input path */
  baseInput: FilePath;
  /** Styling configuration for subtitle appearance */
  style: SubtitleStyle;
  /** Output format for subtitle files */
  format: SubtitleFormat;
  /** Optional path to custom font file */
  fontPath?: FilePath;
  /** Maximum number of overlays to process */
  maxOverlays: number;
}

// =============================================================================
// Subtitle Pipeline Entry Types
// =============================================================================

/**
 * Entry point for subtitle pipeline processing.
 * Represents a unified processing unit combining multiple subtitle enhancement types.
 */
export interface SubtitlePipelineEntry extends SubtitleOverlayEntry {
  /** Unique identifier for the pipeline entry */
  id: string;
  /** Base subtitle entry for synchronization */
  subtitleEntry: SubtitleEntry;
  /** Optional popup caption enhancement configuration */
  popupConfig?: PopupCaptionConfig;
  /** Optional emoji animation enhancement configuration */
  emojiConfig?: EmojiAnimationConfig;
  /** Optional dynamic subtitle processing configuration */
  dynamicConfig?: DynamicSubtitlesConfig;
}

// =============================================================================
// Existing Foundation Types (Referenced by new types)
// =============================================================================

/** Type alias for timestamp values in seconds */
export type Timestamp = number;

export interface TimeRange {
  start: Timestamp;
  end: Timestamp;
}

/** Type alias for file system paths */
export type FilePath = string;

/** Anchor position types for overlay placement */
export type AnchorPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

export type WatermarkPosition = AnchorPosition;

export interface TextWatermarkConfig {
  type: 'text';
  text: string;
  position: WatermarkPosition;
  x: number | null;
  y: number | null;
  fontSize: number;
  fontColor: string;
  fontFamily: string;
  opacity: number;
  shadowColor: string;
  shadowX: number;
  shadowY: number;
  outlineColor: string;
  outlineWidth: number;
  bold: boolean;
  italic: boolean;
}

export interface ImageWatermarkConfig {
  type: 'image';
  imagePath: FilePath;
  position: WatermarkPosition;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  opacity: number;
}

export type WatermarkConfig =
  | {
      type: 'text';
      text: string;
      position: WatermarkPosition;
      x: number | null;
      y: number | null;
      fontSize: number;
      fontColor: string;
      fontFamily: string;
      opacity: number;
      shadowColor: string;
      shadowX: number;
      shadowY: number;
      outlineColor: string;
      outlineWidth: number;
      bold: boolean;
      italic: boolean;
    }
  | {
      type: 'image';
      imagePath: FilePath;
      position: WatermarkPosition;
      x: number | null;
      y: number | null;
      width: number | null;
      height: number | null;
      opacity: number;
    };

export interface WatermarkOperation {
  baseInput: FilePath;
  outputPath: FilePath;
  watermark: WatermarkConfig;
  resolution: Resolution;
}

/** Subtitle format types supported by the pipeline */
export type SubtitleFormat = 'srt' | 'ass' | 'vtt';

/** Video format types */
export type VideoFormat = 'mp4' | 'webm' | 'mkv' | 'mov' | 'avi' | 'gif';

/** Audio format types */
export type AudioFormat = 'mp3' | 'aac' | 'wav' | 'ogg' | 'flac';

export type ImageFormat = 'png' | 'jpg' | 'jpeg' | 'webp';

export interface ThumbnailConfig {
  inputPath: FilePath;
  outputDir: FilePath;
  timestamps: number[];
  count: number | null;
  width: number;
  height: number;
  format: ImageFormat;
  quality: number;
  filenamePattern: string;
}

export interface ThumbnailResult {
  path: FilePath;
  timestamp: number;
  width: number;
  height: number;
  size: number;
}

/** Container format types */
export type ContainerFormat =
  | 'mp4'
  | 'webm'
  | 'mkv'
  | 'mov'
  | 'avi'
  | 'gif'
  | 'mp3'
  | 'wav';

/** Resolution preset options */
export type ResolutionPreset =
  | '4k'
  | '1080p'
  | '720p'
  | '480p'
  | '360p'
  | 'custom';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

export type Resolution = { width: number; height: number };

export type FilterEntry = {
  inputs: string[];
  filter: string;
  outputs: string[];
};

export interface CropRect {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface SmartCrop916Config {
  input: Resolution;
  output: Resolution;
  focusX?: number;
  focusY?: number;
}

export interface AutoReframe916Config {
  input: Resolution;
  output: Resolution;
  focusX?: number;
  focusY?: number;
}

export interface SmartCrop916Result {
  crop: CropRect;
  output: Resolution;
  filter: string;
}

export type DynamicZoomMode = 'in' | 'out' | 'in-out' | 'out-in';

export interface DynamicZoomConfig {
  baseResolution: Resolution;
  durationSec: number;
  zoomAmount: number;
  mode: DynamicZoomMode;
  focusX?: number;
  focusY?: number;
}

export interface DynamicZoomResult {
  filter: string;
  baseResolution: Resolution;
}

/** Video codec types */
export type VideoCodec =
  | 'libx264'
  | 'libx265'
  | 'libvpx-vp9'
  | 'libaom-av1'
  | 'gif'
  | 'copy';

/** Audio codec types */
export type AudioCodec =
  | 'aac'
  | 'mp3'
  | 'libmp3lame'
  | 'opus'
  | 'libopus'
  | 'flac'
  | 'copy'
  | 'none';

export interface RenderConfig {
  inputPath?: FilePath;
  outputPath: FilePath;
  format: VideoFormat;
  resolution: Resolution;
  fps: number;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  videoBitrate: string | number | null;
  audioBitrate: string | number | null;
  crf: number | null;
  preset: string | null;
  tune: string | null;
  pixelFormat: string | null;
  hardwareAccel: HardwareAccel;
  overwrite: boolean;
  startTime: Timestamp | null;
  duration: number | null;
  twoPass: boolean;
  metadata: Record<string, string>;
}

export interface RenderError {
  code: string;
  message: string;
  stderr: string;
  exitCode: number | null;
  command: string[];
  timestamp: number;
}

export type FFmpegError = RenderError;

export interface RenderResult {
  success: boolean;
  outputPath: FilePath;
  duration: number;
  fileSize: number;
  resolution: Resolution;
  format: VideoFormat;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  error: RenderError | null;
  tempFiles: FilePath[];
  renderTimeMs: number;
}

/** Transition animation types */
export type TransitionType =
  | 'fade'
  | 'fadeblack'
  | 'fadewhite'
  | 'dissolve'
  | 'slideleft'
  | 'slideright'
  | 'slideup'
  | 'slidedown'
  | 'circleopen'
  | 'circleclose'
  | 'pixelize'
  | 'wipleft'
  | 'wipright'
  | 'wipdown'
  | 'wipup'
  | 'none';

export interface TransitionConfig {
  inputA: FilePath;
  inputB: FilePath;
  outputPath: FilePath;
  transition: TransitionType;
  duration: number;
  offset?: number | null;
  resolution: Resolution;
  fps: number;
}

/** Timing configuration for overlay elements */
export interface AnimationTiming {
  startTime: Timestamp;
  duration: number;
  position: AnchorPosition;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  opacity: number;
}

/** Social media animation types for overlays */
export type AnimationType = 'like' | 'subscribe' | 'follow' | 'bell' | 'comment' | 'share';

/** Color representation in hex format */
export type ColorHex = string;

/** Media metadata */
export interface VideoMetadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  comment?: string;
  description?: string;
  synopsis?: string;
  show?: string;
  episodeId?: string;
  network?: string;
  composer?: string;
  performer?: string;
  copyright?: string;
  encoder?: string;
  keywords?: string[];
  custom?: Record<string, string>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface FFmpegContext {
  retryAttempts: number;
  retryDelayMs: number;
  ffmpegPath: FilePath;
  ffprobePath: FilePath;
  tempDir: FilePath;
  hardwareAccel: HardwareAccel;
  log: (level: LogLevel, message: string, scope?: string, data?: unknown) => void;
}

export type FfmpegContext = FFmpegContext;

export interface CommandInputConfig {
  path: FilePath;
  index: number;
  duration: number | null;
  startTime: Timestamp | null;
  format: string | null;
  streamLoop: number;
  extraArgs: string[];
}

export interface CommandOutputConfig {
  path: FilePath;
  map: string[];
  videoCodec: VideoCodec | null;
  audioCodec: AudioCodec | null;
  videoBitrate: string | number | null;
  audioBitrate: string | number | null;
  crf: number | null;
  preset: string | null;
  tune: string | null;
  pixelFormat: string | null;
  fps: number | null;
  resolution: Resolution | null;
  format: string | null;
  movFlags: string | null;
  metadata: Record<string, string>;
  overwrite: boolean;
  extraArgs: string[];
}

export interface CommandConfig {
  binary: FilePath;
  inputs: CommandInputConfig[];
  filterComplex: string | null;
  outputs: CommandOutputConfig[];
  globalArgs: string[];
  timeoutMs: number;
}

export interface AudioTrack {
  id: string;
  path: FilePath;
  startTime: Timestamp;
  duration: number | null;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
  muted: boolean;
}

export interface AudioMixConfig {
  tracks: AudioTrack[];
  outputPath: FilePath;
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  bitrate: string;
  duration: number | null;
}

export interface OverlayConfig {
  baseInput: FilePath;
  overlayPath: FilePath;
  outputPath: FilePath;
  timing: AnimationTiming;
}

export interface AnimationConfig {
  assetPath: FilePath;
  type: AnimationType;
  timing: AnimationTiming;
  scale: number;
}

export interface RenderProgress {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSizeKb: number;
  timemark: string;
  percentage: number;
  speed: number;
  status: RenderStatus;
  estimatedTimeRemainingMs: number | null;
}

export type RenderProgressCallback = (progress: RenderProgress) => void;

// =============================================================================
// Hardware Acceleration & Status Types
// =============================================================================

export type HardwareAccel =
  | 'none'
  | 'cuda'
  | 'qsv'
  | 'dxva2'
  | 'd3d11va'
  | 'vaapi'
  | 'vdpau';

export type RenderStatus =
  | 'idle'
  | 'queued'
  | 'preparing'
  | 'rendering'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Ken Burns pan/zoom directions. */
export type KenBurnsDirection =
  | 'zoomIn'
  | 'zoomOut'
  | 'panLeft'
  | 'panRight'
  | 'panUp'
  | 'panDown'
  | 'diagonalTL'
  | 'diagonalTR'
  | 'diagonalBL'
  | 'diagonalBR';

// =============================================================================
// Logging Types
// =============================================================================

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: number;
  data?: unknown;
}

export type LogFunction = (
  level: LogLevel,
  message: string,
  context?: string,
  data?: unknown,
) => void;

export type LogCallback = (entry: LogEntry) => void;

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// =============================================================================
// Studio Configuration
// =============================================================================

export interface StudioConfig {
  ffmpegPath?: FilePath;
  ffprobePath?: FilePath;
  tempDir?: FilePath;
  logLevel?: LogLevel;
  logCallback?: LogCallback;
  maxConcurrentRenders?: number;
  hardwareAccel?: HardwareAccel;
  defaultResolution?: Resolution;
  defaultFps?: number;
  defaultVideoCodec?: VideoCodec;
  defaultAudioCodec?: AudioCodec;
  defaultFormat?: VideoFormat;
  retryAttempts?: number;
  retryDelayMs?: number;
  cleanupOnSuccess?: boolean;
  cleanupOnFailure?: boolean;
}

// =============================================================================
// Media Probing Types
// =============================================================================

export interface VideoStreamInfo {
  index: number;
  codec: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  pixelFormat: string;
  aspectRatio: string;
  rotation: number;
  duration: number;
  profile: string;
  level: number;
  colorSpace: string;
  hasBFrames: boolean;
}

export interface AudioStreamInfo {
  index: number;
  codec: string;
  sampleRate: number;
  channels: number;
  channelLayout: string;
  bitrate: number;
  duration: number;
  bitsPerSample: number;
}

export interface MediaInfo {
  path: FilePath;
  filename: string;
  extension: string;
  fileSize: number;
  duration: number;
  bitrate: number;
  format: string;
  videoStream: VideoStreamInfo | null;
  audioStream: AudioStreamInfo | null;
  createdAt: number;
}

// =============================================================================
// Image / Video Generation Configs
// =============================================================================

export interface ImageToVideoConfig {
  imagePath: FilePath;
  outputPath: FilePath;
  duration: number;
  fps: number;
  resolution: Resolution;
  pixelFormat: string;
  loop?: number;
}

export interface KenBurnsConfig {
  imagePath: FilePath;
  outputPath: FilePath;
  duration: number;
  fps: number;
  resolution: Resolution;
  direction: KenBurnsDirection;
  zoomFactor: number;
  easing?: string;
}

export interface SlideshowConfig {
  images: FilePath[];
  outputPath: FilePath;
  durationPerImage: number;
  fps: number;
  resolution: Resolution;
  transition: TransitionType;
  transitionDuration: number;
  pixelFormat: string;
}

// =============================================================================
// Audio Configs
// =============================================================================

export interface BackgroundMusicConfig {
  musicPath: FilePath;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  trimStart: number;
  trimEnd: number;
  loop: boolean;
}

export interface VoiceConfig {
  voicePath: FilePath;
  startTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

// =============================================================================
// Intro / Outro Configs
// =============================================================================

export interface IntroConfig {
  enabled: boolean;
  duration: number;
  resolution: Resolution;
  fps: number;
  sourcePath?: FilePath | null;
  outputPath?: FilePath | null;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  backgroundImagePath?: FilePath;
  text?: string;
  subtext?: string;
  fontPath?: FilePath;
}

export interface OutroConfig {
  enabled: boolean;
  duration: number;
  resolution: Resolution;
  fps: number;
  sourcePath?: FilePath | null;
  outputPath?: FilePath | null;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  backgroundImagePath?: FilePath;
  text?: string;
  subtext?: string;
  fontPath?: FilePath;
}

// =============================================================================
// Timeline & Compose Configs
// =============================================================================

export interface VideoFilter {
  type: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface ClipTransition {
  type: TransitionType;
  duration: number;
}

export interface TimelineClip {
  id: string;
  mediaPath: FilePath;
  type: 'video' | 'image' | 'audio';
  startTime: number;
  duration: number;
  volume: number;
  speed: number;
  transition?: ClipTransition | null;
  filters: VideoFilter[];
}

export interface ComposeConfig {
  clips: TimelineClip[];
  outputPath: FilePath;
  format: VideoFormat;
  resolution: Resolution;
  fps: number;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  crf: number | null;
  preset: string;
  defaultTransition: TransitionType;
  transitionDuration: number;
  subtitles?: SubtitleConfig;
  watermark?: WatermarkConfig | null;
  overlays: AnimationConfig[];
  voiceTrack?: VoiceConfig | null;
  backgroundMusic: BackgroundMusicConfig | null;
  intro: IntroConfig;
  outro: OutroConfig;
  metadata?: VideoMetadata;
  onProgress?: RenderProgressCallback;
}

export interface ComposeResult {
  success: boolean;
  outputPath: FilePath;
  duration: number;
  fileSize: number;
  error: RenderError | null;
  tempFiles: FilePath[];
  composeTimeMs: number;
}
