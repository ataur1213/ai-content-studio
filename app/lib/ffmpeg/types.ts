// =============================================================================
// AI Video Generator — FFmpeg Engine Type System
// =============================================================================
// Central type definitions for the entire lib/ffmpeg module.
// No runtime values here — only types, interfaces, and literal unions.
// =============================================================================

// =============================================================================
// Primitive Aliases
// =============================================================================

/** Absolute or relative file system path. */
export type FilePath = string;

/** Time value in seconds (float). */
export type Timestamp = number;

/** Generic async function that can be retried. */
export type AsyncFn<T> = () => Promise<T>;

// =============================================================================
// Literal Union Types
// =============================================================================

/** Supported video codecs for encoding. */
export type VideoCodec =
  | 'libx264'
  | 'libx265'
  | 'libvpx-vp9'
  | 'libaom-av1'
  | 'gif'
  | 'copy';

/** Supported audio codecs for encoding. */
export type AudioCodec =
  | 'aac'
  | 'libmp3lame'
  | 'libopus'
  | 'pcm_s16le'
  | 'copy';

/** Container formats for video output. */
export type VideoFormat = 'mp4' | 'webm' | 'mkv' | 'avi' | 'mov' | 'gif';

/** Container formats for audio output. */
export type AudioFormat = 'mp3' | 'aac' | 'wav' | 'ogg' | 'flac';

/** Image file formats. */
export type ImageFormat = 'png' | 'jpg' | 'jpeg' | 'webp';

/** Subtitle file formats. */
export type SubtitleFormat = 'srt' | 'ass' | 'vtt';

/** FFmpeg xfade transition types. */
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

/** Ken Burns effect directions. */
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

/** Video aspect ratios. */
export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9';

/** Watermark / overlay anchor positions. */
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

/** Social animation types for overlays. */
export type AnimationType = 'like' | 'subscribe' | 'follow' | 'bell' | 'comment' | 'share';

/** Hardware acceleration backends. */
export type HardwareAccelType =
  | 'none'
  | 'cuda'
  | 'qsv'
  | 'dxva2'
  | 'd3d11va'
  | 'vaapi'
  | 'vdpau';

/** Log verbosity levels. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** Lifecycle states of a render job. */
export type RenderStatus =
  | 'idle'
  | 'queued'
  | 'preparing'
  | 'rendering'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// =============================================================================
// Core Media Types
// =============================================================================

/** Parsed video stream metadata from ffprobe. */
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

/** Parsed audio stream metadata from ffprobe. */
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

/** Complete media file metadata. */
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
// Error Types
// =============================================================================

/** Structured error from FFmpeg operations. */
export interface FFmpegError {
  code: string;
  message: string;
  stderr: string;
  exitCode: number | null;
  command: string[];
  timestamp: number;
}

// =============================================================================
// Logging Types
// =============================================================================

/** Single log entry emitted by the engine. */
export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: number;
  data?: unknown;
}

/** Function signature for log sinks. */
export type LogFunction = (level: LogLevel, message: string, context?: string, data?: unknown) => void;

/** Callback for external log consumption. */
export type LogCallback = (entry: LogEntry) => void;

// =============================================================================
// Validation Types
// =============================================================================

/** Single validation error detail. */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/** Aggregated validation result. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// =============================================================================
// Time Types
// =============================================================================

/** Closed time interval in seconds. */
export interface TimeRange {
  start: Timestamp;
  end: Timestamp;
}

// =============================================================================
// Configuration Types
// =============================================================================

/** Top-level engine configuration. */
export interface StudioConfig {
  ffmpegPath: FilePath;
  ffprobePath: FilePath;
  tempDir: FilePath;
  logLevel: LogLevel;
  logCallback?: LogCallback;
  maxConcurrentRenders: number;
  hardwareAccel: HardwareAccelType;
  defaultResolution: Resolution;
  defaultFps: number;
  defaultVideoCodec: VideoCodec;
  defaultAudioCodec: AudioCodec;
  defaultFormat: VideoFormat;
  retryAttempts: number;
  retryDelayMs: number;
  cleanupOnSuccess: boolean;
  cleanupOnFailure: boolean;
}

/** Width × height pair. */
export interface Resolution {
  width: number;
  height: number;
}

/** Full render job configuration. */
export interface RenderConfig {
  outputPath: FilePath;
  format: VideoFormat;
  resolution: Resolution;
  fps: number;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  videoBitrate: string | null;
  audioBitrate: string | null;
  crf: number | null;
  preset: string;
  tune: string;
  pixelFormat: string;
  hardwareAccel: HardwareAccelType;
  twoPass: boolean;
  metadata: Record<string, string>;
  overwrite: boolean;
  startTime: Timestamp | null;
  duration: Timestamp | null;
}

// =============================================================================
// Timeline & Clip Types
// =============================================================================

/** Single video/audio/image filter to apply. */
export interface VideoFilter {
  type: string;
  params: Record<string, string | number | boolean>;
  enabled: boolean;
}

/** Transition applied between two clips. */
export interface ClipTransition {
  type: TransitionType;
  duration: number;
}

/** A single media clip on the timeline. */
export interface TimelineClip {
  id: string;
  mediaPath: FilePath;
  type: 'video' | 'image' | 'audio';
  startTime: Timestamp;
  duration: Timestamp;
  trimStart: Timestamp;
  trimEnd: Timestamp;
  volume: number;
  speed: number;
  filters: VideoFilter[];
  transition: ClipTransition | null;
  layer: number;
  locked: boolean;
  label: string;
}

// =============================================================================
// Filter Chain Types
// =============================================================================

/** Internal representation of one filter operation in a complex filter graph. */
export interface FilterEntry {
  inputs: string[];
  filter: string;
  outputs: string[];
}

// =============================================================================
// Command Builder Types
// =============================================================================

/** Configuration for a single FFmpeg input. */
export interface InputConfig {
  path: FilePath;
  index: number;
  duration: Timestamp | null;
  startTime: Timestamp | null;
  format: string | null;
  streamLoop: number;
  extraArgs: string[];
}

/** Configuration for a single FFmpeg output. */
export interface OutputConfig {
  path: FilePath;
  map: string[];
  videoCodec: VideoCodec | null;
  audioCodec: AudioCodec | null;
  videoBitrate: string | null;
  audioBitrate: string | null;
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

/** Assembled command ready for execution. */
export interface CommandConfig {
  binary: FilePath;
  inputs: InputConfig[];
  filterComplex: string | null;
  outputs: OutputConfig[];
  globalArgs: string[];
  timeoutMs: number | null;
}

// =============================================================================
// Image Operation Types
// =============================================================================

/** Convert a still image to a video clip. */
export interface ImageToVideoConfig {
  imagePath: FilePath;
  outputPath: FilePath;
  duration: number;
  fps: number;
  resolution: Resolution;
  pixelFormat: string;
  loop: number;
}

/** Ken Burns (pan + zoom) effect on a still image. */
export interface KenBurnsConfig {
  imagePath: FilePath;
  outputPath: FilePath;
  duration: number;
  fps: number;
  resolution: Resolution;
  direction: KenBurnsDirection;
  zoomFactor: number;
  easing: string;
}

/** Multi-image slideshow with optional transitions. */
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
// Audio Operation Types
// =============================================================================

/** A single audio track in a mix. */
export interface AudioTrack {
  id: string;
  path: FilePath;
  startTime: Timestamp;
  duration: Timestamp | null;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
  muted: boolean;
}

/** Mix multiple audio tracks into one. */
export interface AudioMixConfig {
  tracks: AudioTrack[];
  outputPath: FilePath;
  format: AudioFormat;
  sampleRate: number;
  channels: number;
  bitrate: string;
  duration: number | null;
}

/** Background music configuration. */
export interface BackgroundMusicConfig {
  musicPath: FilePath;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
  trimStart: Timestamp;
  trimEnd: Timestamp;
}

/** AI voice-over track configuration. */
export interface VoiceConfig {
  voicePath: FilePath;
  startTime: Timestamp;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

// =============================================================================
// Transition Types
// =============================================================================

/** Configuration for concatenating two video segments with a transition. */
export interface TransitionConfig {
  inputA: FilePath;
  inputB: FilePath;
  outputPath: FilePath;
  transition: TransitionType;
  duration: number;
  offset: Timestamp | null;
  resolution: Resolution;
  fps: number;
}

// =============================================================================
// Overlay Types
// =============================================================================

/** Timing and placement for an overlay animation. */
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

/** A social-animation overlay (like, subscribe, follow, etc.). */
export interface AnimationConfig {
  type: AnimationType;
  assetPath: FilePath;
  timing: AnimationTiming;
  scale: number;
  repeat: boolean;
  repeatInterval: number;
}

/** General image/video overlay on top of a base video. */
export interface OverlayConfig {
  overlayPath: FilePath;
  outputPath: FilePath;
  baseInput: FilePath;
  timing: AnimationTiming;
  overlayInputIndex: number;
}

// =============================================================================
// Watermark Types
// =============================================================================

/** Text-based watermark. */
export interface TextWatermarkConfig {
  type: 'text';
  text: string;
  position: AnchorPosition;
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

/** Image-based watermark. */
export interface ImageWatermarkConfig {
  type: 'image';
  imagePath: FilePath;
  position: AnchorPosition;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  opacity: number;
}

/** Discriminated union for watermark configurations. */
export type WatermarkConfig = TextWatermarkConfig | ImageWatermarkConfig;

/** Full watermark operation input. */
export interface WatermarkOperation {
  baseInput: FilePath;
  outputPath: FilePath;
  watermark: WatermarkConfig;
  resolution: Resolution;
}

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
// Intro / Outro Types
// =============================================================================

/** Intro clip configuration. */
export interface IntroConfig {
  enabled: boolean;
  sourcePath: FilePath | null;
  text: string | null;
  subtext: string | null;
  backgroundColor: string;
  textColor: string;
  fontPath: FilePath | null;
  fontSize: number;
  duration: number;
  resolution: Resolution;
  fps: number;
  backgroundImagePath: FilePath | null;
  outputPath: FilePath | null;
}

/** Outro clip configuration. */
export interface OutroConfig {
  enabled: boolean;
  sourcePath: FilePath | null;
  text: string | null;
  subtext: string | null;
  backgroundColor: string;
  textColor: string;
  fontPath: FilePath | null;
  fontSize: number;
  duration: number;
  resolution: Resolution;
  fps: number;
  backgroundImagePath: FilePath | null;
  outputPath: FilePath | null;
}

// =============================================================================
// Thumbnail Types
// =============================================================================

/** Thumbnail generation request. */
export interface ThumbnailConfig {
  inputPath: FilePath;
  outputDir: FilePath;
  timestamps: Timestamp[];
  count: number | null;
  width: number;
  height: number;
  format: ImageFormat;
  quality: number;
  filenamePattern: string;
}

/** A single generated thumbnail. */
export interface ThumbnailResult {
  path: FilePath;
  timestamp: Timestamp;
  width: number;
  height: number;
  size: number;
}

// =============================================================================
// SEO / Metadata Types
// =============================================================================

/** Video metadata for SEO and platform optimization. */
export interface VideoMetadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number;
  comment: string;
  description: string;
  synopsis: string;
  show: string;
  episodeId: string;
  network: string;
  composer: string;
  performer: string;
  copyright: string;
  encoder: string;
  keywords: string[];
  custom: Record<string, string>;
}

// =============================================================================
// Progress Types
// =============================================================================

/** Real-time progress data parsed from FFmpeg stderr. */
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

/** Callback invoked during rendering with progress updates. */
export type RenderProgressCallback = (progress: RenderProgress) => void;

// =============================================================================
// Render Result Types
// =============================================================================

/** Outcome of a render operation. */
export interface RenderResult {
  success: boolean;
  outputPath: FilePath;
  duration: number;
  fileSize: number;
  resolution: Resolution;
  format: VideoFormat;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  error: FFmpegError | null;
  tempFiles: FilePath[];
  renderTimeMs: number;
}

// =============================================================================
// Compose Types
// =============================================================================

/** High-level video composition request. */
export interface ComposeConfig {
  clips: TimelineClip[];
  outputPath: FilePath;
  resolution: Resolution;
  fps: number;
  format: VideoFormat;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  crf: number | null;
  preset: string;
  backgroundMusic: BackgroundMusicConfig | null;
  voiceTrack: VoiceConfig | null;
  subtitles: SubtitleConfig | null;
  watermark: WatermarkConfig | null;
  overlays: AnimationConfig[];
  intro: IntroConfig;
  outro: OutroConfig;
  defaultTransition: TransitionType;
  transitionDuration: number;
  metadata: VideoMetadata | null;
  onProgress: RenderProgressCallback | null;
}

/** Outcome of a compose operation. */
export interface ComposeResult {
  success: boolean;
  outputPath: FilePath;
  duration: number;
  fileSize: number;
  error: FFmpegError | null;
  tempFiles: FilePath[];
  composeTimeMs: number;
}

// =============================================================================
// FFmpeg Context — shared by all manager modules
// =============================================================================

/** Injected context that every internal module receives. */
export interface FFmpegContext {
  ffmpegPath: FilePath;
  ffprobePath: FilePath;
  tempDir: FilePath;
  log: LogFunction;
  hardwareAccel: HardwareAccelType;
  retryAttempts: number;
  retryDelayMs: number;
}