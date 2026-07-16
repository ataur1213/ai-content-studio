// =============================================================================
// AI Video Generator — FFmpeg Engine Constants
// =============================================================================
// All static values used across the engine. Zero imports from local modules
// to keep the dependency graph flat at this layer.
// =============================================================================

import type {
  Resolution,
  VideoCodec,
  AudioCodec,
  VideoFormat,
  AudioFormat,
  ImageFormat,
  SubtitleFormat,
  AspectRatio,
  HardwareAccelType,
  LogLevel,
  RenderStatus,
  TransitionType,
  KenBurnsDirection,
  AnchorPosition,
  AnimationType,
  SubtitleStyle,
  VideoMetadata,
  RenderConfig,
  StudioConfig,
} from './types';

// =============================================================================
// Resolution Presets
// =============================================================================

/** Pre-defined resolution lookup keyed by common names. */
export const RESOLUTION_PRESETS: Readonly<Record<string, Resolution>> = {
  '4k':     { width: 3840, height: 2160 },
  '2k':     { width: 2560, height: 1440 },
  '1080p':  { width: 1920, height: 1080 },
  '720p':   { width: 1280, height: 720  },
  '480p':   { width: 854,  height: 480  },
  '360p':   { width: 640,  height: 360  },
  /** Vertical 1080 — TikTok / Reels / Shorts. */
  '1080x1920': { width: 1080, height: 1920 },
  /** Horizontal 1080 — YouTube standard. */
  '1920x1080': { width: 1920, height: 1080 },
  /** Square — Instagram posts. */
  '1080x1080': { width: 1080, height: 1080 },
  /** Wide cinematic. */
  '2560x1080': { width: 2560, height: 1080 },
};

/** Aspect ratio numeric values keyed by label. */
export const ASPECT_RATIOS: Readonly<Record<AspectRatio, number>> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1':  1,
  '4:3':  4 / 3,
  '21:9': 21 / 9,
};

// =============================================================================
// Codec Defaults
// =============================================================================

/** Map of VideoCodec to its default pixel format. */
export const CODEC_PIXEL_FORMATS: Readonly<Record<VideoCodec, string>> = {
  'libx264':     'yuv420p',
  'libx265':     'yuv420p',
  'libvpx-vp9':  'yuv420p',
  'libaom-av1':  'yuv420p',
  'gif':         'pal8',
  'copy':        '',
};

/** Default CRF values per codec (null means bitrate-only). */
export const DEFAULT_CRF: Readonly<Record<VideoCodec, number | null>> = {
  'libx264':     23,
  'libx265':     28,
  'libvpx-vp9':  31,
  'libaom-av1':  33,
  'gif':         null,
  'copy':        null,
};

/** Default x264/x265 encoding preset (speed vs compression). */
export const DEFAULT_PRESET = 'medium';

/** Default x264/x265 tune. */
export const DEFAULT_TUNE = '';

/** Valid x264 presets from slowest (best compression) to fastest. */
export const X264_PRESETS: ReadonlyArray<string> = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
  'placebo',
];

/** Valid x264 tune options. */
export const X264_TUNES: ReadonlyArray<string> = [
  'film',
  'animation',
  'grain',
  'stillimage',
  'fastdecode',
  'zerolatency',
  'psnr',
  'ssim',
];

// =============================================================================
// Bitrate Defaults (fallbacks when CRF is not used)
// =============================================================================

/** Default video bitrate per resolution tier. */
export const DEFAULT_VIDEO_BITRATES: Readonly<Record<string, string>> = {
  '4k':     '20M',
  '2k':     '12M',
  '1080p':  '8M',
  '720p':   '5M',
  '480p':   '2.5M',
  '360p':   '1M',
  '1080x1920': '8M',
  '1920x1080': '8M',
  '1080x1080': '6M',
  '2560x1080': '12M',
};

/** Default audio bitrate. */
export const DEFAULT_AUDIO_BITRATE = '128k';

/** Default audio sample rate. */
export const DEFAULT_SAMPLE_RATE = 44100;

/** Default audio channel count. */
export const DEFAULT_AUDIO_CHANNELS = 2;

// =============================================================================
// Format Mappings
// =============================================================================

/** Map of VideoFormat to its FFmpeg format name. */
export const VIDEO_FORMAT_MAP: Readonly<Record<VideoFormat, string>> = {
  'mp4':  'mp4',
  'webm': 'webm',
  'mkv':  'matroska',
  'avi':  'avi',
  'mov':  'mov',
  'gif':  'gif',
};

/** Map of AudioFormat to its FFmpeg format name. */
export const AUDIO_FORMAT_MAP: Readonly<Record<AudioFormat, string>> = {
  'mp3':  'mp3',
  'aac':  'adts',
  'wav':  'wav',
  'ogg':  'ogg',
  'flac': 'flac',
};

/** Map of ImageFormat to FFmpeg encoder name. */
export const IMAGE_ENCODER_MAP: Readonly<Record<ImageFormat, string>> = {
  'png':  'png',
  'jpg':  'mjpeg',
  'jpeg': 'mjpeg',
  'webp': 'libwebp',
};

/** Map of SubtitleFormat to file extension. */
export const SUBTITLE_EXTENSIONS: Readonly<Record<SubtitleFormat, string>> = {
  'srt': '.srt',
  'ass': '.ass',
  'vtt': '.vtt',
};

/** MOV container flags for fast-start (web streaming). */
export const MOV_FASTSTART_FLAGS = '+faststart';

// =============================================================================
// Default Subtitle Style
// =============================================================================

/** Factory-safe default subtitle style. */
export const DEFAULT_SUBTITLE_STYLE: Readonly<SubtitleStyle> = {
  fontName: 'Arial',
  fontSize: 24,
  primaryColor: '&H00FFFFFF',
  outlineColor: '&H00000000',
  outlineWidth: 2,
  shadow: 1,
  alignment: 2,
  marginV: 30,
  marginL: 10,
  marginR: 10,
  bold: false,
  italic: false,
  position: 'bottom',
};

// =============================================================================
// Default Video Metadata (SEO)
// =============================================================================

/** Empty metadata template. */
export const EMPTY_METADATA: Readonly<VideoMetadata> = {
  title: '',
  artist: '',
  album: '',
  genre: '',
  year: 0,
  comment: '',
  description: '',
  synopsis: '',
  show: '',
  episodeId: '',
  network: '',
  composer: '',
  performer: '',
  copyright: '',
  encoder: 'AI Video Generator',
  keywords: [],
  custom: {},
};

/** Metadata field → FFmpeg metadata key mapping. */
export const METADATA_KEY_MAP: Readonly<Record<string, string>> = {
  title:     'title',
  artist:    'artist',
  album:     'album',
  genre:     'genre',
  year:      'date',
  comment:   'comment',
  description: 'description',
  synopsis:  'synopsis',
  show:      'show',
  episodeId: 'episode_id',
  network:   'network',
  composer:  'composer',
  performer: 'performer',
  copyright: 'copyright',
  encoder:   'encoder',
};

// =============================================================================
// Default Render Config
// =============================================================================

/** Sensible defaults for a render job. */
export const DEFAULT_RENDER_CONFIG: Readonly<RenderConfig> = {
  outputPath: '',
  format: 'mp4',
  resolution: RESOLUTION_PRESETS['1920x1080'],
  fps: 30,
  videoCodec: 'libx264',
  audioCodec: 'aac',
  videoBitrate: null,
  audioBitrate: DEFAULT_AUDIO_BITRATE,
  crf: 23,
  preset: DEFAULT_PRESET,
  tune: DEFAULT_TUNE,
  pixelFormat: 'yuv420p',
  hardwareAccel: 'none',
  twoPass: false,
  metadata: {},
  overwrite: true,
  startTime: null,
  duration: null,
};

// =============================================================================
// Default Studio Config
// =============================================================================

/** Factory defaults for the top-level engine configuration. */
export const DEFAULT_STUDIO_CONFIG: Readonly<StudioConfig> = {
  ffmpegPath: 'ffmpeg',
  ffprobePath: 'ffprobe',
  tempDir: './temp',
  logLevel: 'info',
  logCallback: undefined,
  maxConcurrentRenders: 1,
  hardwareAccel: 'none',
  defaultResolution: RESOLUTION_PRESETS['1920x1080'],
  defaultFps: 30,
  defaultVideoCodec: 'libx264',
  defaultAudioCodec: 'aac',
  defaultFormat: 'mp4',
  retryAttempts: 3,
  retryDelayMs: 1000,
  cleanupOnSuccess: true,
  cleanupOnFailure: false,
};

// =============================================================================
// Anchor Position Mappings
// =============================================================================

/** Map of AnchorPosition to FFmpeg overlay coordinate expressions. */
export const ANCHOR_POSITIONS: Readonly<Record<AnchorPosition, { x: string; y: string }>> = {
  topLeft:     { x: '0',          y: '0'          },
  topCenter:   { x: '(W-w)/2',    y: '0'          },
  topRight:    { x: 'W-w',        y: '0'          },
  centerLeft:  { x: '0',          y: '(H-h)/2'    },
  center:      { x: '(W-w)/2',    y: '(H-h)/2'    },
  centerRight: { x: 'W-w',        y: '(H-h)/2'    },
  bottomLeft:  { x: '0',          y: 'H-h'        },
  bottomCenter:{ x: '(W-w)/2',    y: 'H-h'        },
  bottomRight: { x: 'W-w',        y: 'H-h'        },
};

// =============================================================================
// Ken Burns Direction Mappings
// =============================================================================

/** Zoom and pan expressions for each Ken Burns direction. */
export const KEN_BURNS_EXPRESSIONS: Readonly<Record<KenBurnsDirection, (w: number, h: number, totalFrames: number, zoom: number) => string>> = {
  zoomIn:     (w, h, tf, z) =>
    `zoompan=z='min(${z}+in*${(z - 1) / Math.max(1, tf - 1)},${z})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${tf}:s=${w}x${h}:fps=30`,
  zoomOut:    (w, h, tf, z) =>
    `zoompan=z='if(eq(on,1),${z},max(${z}-in*${(z - 1) / Math.max(1, tf - 1)},1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${tf}:s=${w}x${h}:fps=30`,
  panLeft:    (w, h, tf, z) =>
    `zoompan=z='${z}':x='iw-(iw/zoom)-(in/${Math.max(1, tf - 1)}*(iw-iw/zoom))':y='ih/2-(ih/zoom/2)':d=${tf}:s=${w}x${h}:fps=30`,
  panRight:   (w, h, tf, z) =>
    `zoompan=z='${z}':x='in/${Math.max(1, tf - 1)}*(iw-iw/zoom)':y='ih/2-(ih/zoom/2)':d=${tf}:s=${w}x${h}:fps=30`,
  panUp:      (w, h, tf, z) =>
    `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih-(ih/zoom)-(in/${Math.max(1, tf - 1)}*(ih-ih/zoom))':d=${tf}:s=${w}x${h}:fps=30`,
  panDown:    (w, h, tf, z) =>
    `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='in/${Math.max(1, tf - 1)}*(ih-ih/zoom)':d=${tf}:s=${w}x${h}:fps=30`,
  diagonalTL: (w, h, tf, z) =>
    `zoompan=z='min(${z}+in*${(z - 1) / Math.max(1, tf - 1)},${z})':x='iw-(iw/zoom)-(in/${Math.max(1, tf - 1)}*(iw-iw/zoom))':y='ih-(ih/zoom)-(in/${Math.max(1, tf - 1)}*(ih-ih/zoom))':d=${tf}:s=${w}x${h}:fps=30`,
  diagonalTR: (w, h, tf, z) =>
    `zoompan=z='min(${z}+in*${(z - 1) / Math.max(1, tf - 1)},${z})':x='in/${Math.max(1, tf - 1)}*(iw-iw/zoom)':y='ih-(ih/zoom)-(in/${Math.max(1, tf - 1)}*(ih-ih/zoom))':d=${tf}:s=${w}x${h}:fps=30`,
  diagonalBL: (w, h, tf, z) =>
    `zoompan=z='min(${z}+in*${(z - 1) / Math.max(1, tf - 1)},${z})':x='iw-(iw/zoom)-(in/${Math.max(1, tf - 1)}*(iw-iw/zoom))':y='in/${Math.max(1, tf - 1)}*(ih-ih/zoom)':d=${tf}:s=${w}x${h}:fps=30`,
  diagonalBR: (w, h, tf, z) =>
    `zoompan=z='min(${z}+in*${(z - 1) / Math.max(1, tf - 1)},${z})':x='in/${Math.max(1, tf - 1)}*(iw-iw/zoom)':y='in/${Math.max(1, tf - 1)}*(ih-ih/zoom)':d=${tf}:s=${w}x${h}:fps=30`,
};

/** Default zoom factor for Ken Burns. */
export const DEFAULT_KEN_BURNS_ZOOM = 1.3;

// =============================================================================
// Animation Defaults
// =============================================================================

/** Default duration for a single animation cycle (seconds). */
export const ANIMATION_DEFAULT_DURATION = 1.5;

/** Default scale multiplier for animation overlays. */
export const ANIMATION_DEFAULT_SCALE = 1.0;

/** Default opacity for overlays. */
export const OVERLAY_DEFAULT_OPACITY = 1.0;

/** Map of AnimationType to default asset filename (expected in assets folder). */
export const ANIMATION_ASSET_NAMES: Readonly<Record<AnimationType, string>> = {
  'like':      'like.png',
  'subscribe': 'subscribe.png',
  'follow':    'follow.png',
  'bell':      'bell.png',
  'comment':   'comment.png',
  'share':     'share.png',
};

// =============================================================================
// Transition Defaults
// =============================================================================

/** Default transition duration (seconds). */
export const DEFAULT_TRANSITION_DURATION = 0.5;

/** All valid xfade transition type names for validation. */
export const VALID_TRANSITION_TYPES: ReadonlyArray<TransitionType> = [
  'fade',
  'fadeblack',
  'fadewhite',
  'dissolve',
  'slideleft',
  'slideright',
  'slideup',
  'slidedown',
  'circleopen',
  'circleclose',
  'pixelize',
  'wipleft',
  'wipright',
  'wipdown',
  'wipup',
  'none',
];

// =============================================================================
// Thumbnail Defaults
// =============================================================================

/** Default thumbnail output format. */
export const DEFAULT_THUMBNAIL_FORMAT: ImageFormat = 'jpg';

/** Default thumbnail quality (1-31 for JPEG, lower = better). */
export const DEFAULT_THUMBNAIL_QUALITY = 2;

/** Default thumbnail dimensions. */
export const DEFAULT_THUMBNAIL_WIDTH = 320;
export const DEFAULT_THUMBNAIL_HEIGHT = 180;

/** Default filename pattern for generated thumbnails. {index} and {timestamp} are replaced. */
export const DEFAULT_THUMBNAIL_PATTERN = 'thumbnail_{index}_{timestamp}.jpg';

// =============================================================================
// Intro / Outro Defaults
// =============================================================================

/** Default intro/outro duration (seconds). */
export const DEFAULT_INTRO_DURATION = 3;
export const DEFAULT_OUTRO_DURATION = 3;

/** Default background color for generated intro/outro cards. */
export const DEFAULT_CARD_BG_COLOR = '0x000000';

/** Default text color for generated intro/outro cards. */
export const DEFAULT_CARD_TEXT_COLOR = 'white';

/** Default font size for card text. */
export const DEFAULT_CARD_FONT_SIZE = 52;

// =============================================================================
// FFmpeg Execution Constants
// =============================================================================

/** Maximum FFmpeg stderr buffer size in bytes before truncation. */
export const MAX_STDERR_BUFFER = 10 * 1024 * 1024; // 10 MB

/** Default command timeout in milliseconds (30 minutes). */
export const DEFAULT_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;

/** Frame rate regex pattern for parsing FFmpeg progress. */
export const PROGRESS_REGEX: RegExp = /frame=(\s*\d+)\s+fps=(\s*[\d.]+)\s+q=(\s*[\d.-]+)\s+(?:size|Lsize)=\s*(\d+\w+)\s+time=(\S+)\s+bitrate=(\s*[\d.]+\w\/s)\s+speed=(\S+)/;

/** Duration regex pattern for parsing ffprobe output. */
export const DURATION_REGEX: RegExp = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2,3})/;

/** Stream info regex patterns for ffprobe. */
export const VIDEO_STREAM_REGEX: RegExp = /Stream\s+#(\d+):\d+.*Video:\s*(\w+),\s*(\w+),\s*(\d+)x(\d+)/;
export const AUDIO_STREAM_REGEX: RegExp = /Stream\s+#(\d+):\d+.*Audio:\s*(\w+),\s*(\d+)\s*Hz,\s*(\w+),\s*(\w+)/;
export const FPS_REGEX: RegExp = /\s+(\d+(?:\.\d+)?)\s*fps/;
export const BITRATE_REGEX: RegExp = /bitrate:\s*(\d+)\s*kb\/s/;

// =============================================================================
// File System Constants
// =============================================================================

/** Prefix for all temporary files created by this engine. */
export const TEMP_FILE_PREFIX = 'aivs_';

/** File extension for temporary video clips. */
export const TEMP_VIDEO_EXT = '.mp4';

/** File extension for temporary audio files. */
export const TEMP_AUDIO_EXT = '.aac';

/** File extension for temporary image files. */
export const TEMP_IMAGE_EXT = '.png';

/** File extension for temporary subtitle files. */
export const TEMP_SUBTITLE_EXT = '.ass';

/** File extension for two-pass log files. */
export const TWO_PASS_LOG_EXT = '.log';

// =============================================================================
// Validation Constants
// =============================================================================

/** Minimum valid video resolution. */
export const MIN_RESOLUTION_WIDTH = 16;
export const MIN_RESOLUTION_HEIGHT = 16;

/** Maximum valid video resolution (8K). */
export const MAX_RESOLUTION_WIDTH = 7680;
export const MAX_RESOLUTION_HEIGHT = 4320;

/** Minimum valid FPS. */
export const MIN_FPS = 1;

/** Maximum valid FPS. */
export const MAX_FPS = 240;

/** Minimum valid CRF value. */
export const MIN_CRF = 0;

/** Maximum valid CRF value. */
export const MAX_CRF = 51;

/** Maximum file size for thumbnails (50 MB source limit). */
export const MAX_THUMBNAIL_SOURCE_SIZE = 50 * 1024 * 1024;

/** Maximum number of clips in a single compose operation. */
export const MAX_COMPOSE_CLIPS = 500;

/** Maximum number of overlay animations in a single compose. */
export const MAX_OVERLAYS = 50;

/** Maximum number of subtitle entries. */
export const MAX_SUBTITLE_ENTRIES = 10000;

/** Maximum number of audio tracks in a mix. */
export const MAX_AUDIO_TRACKS = 32;

// =============================================================================
// Log Level Priority (higher number = more severe)
// =============================================================================

/** Numeric priority for log level filtering. */
export const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  'debug': 0,
  'info':  1,
  'warn':  2,
  'error': 3,
  'silent': 99,
};

// =============================================================================
// Render Status Constants
// =============================================================================

/** Terminal statuses that indicate a render job is no longer active. */
export const TERMINAL_RENDER_STATUSES: ReadonlyArray<RenderStatus> = [
  'completed',
  'failed',
  'cancelled',
];

/** Active statuses that indicate a render job is in progress. */
export const ACTIVE_RENDER_STATUSES: ReadonlyArray<RenderStatus> = [
  'queued',
  'preparing',
  'rendering',
  'processing',
];