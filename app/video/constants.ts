export const SUPPORTED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
] as const;

export const SUPPORTED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/x-m4a",
] as const;

export const ACCEPTED_UPLOAD_MIME_TYPES = [
  ...SUPPORTED_VIDEO_MIME_TYPES,
  ...SUPPORTED_AUDIO_MIME_TYPES,
] as const;

export const MAX_UPLOAD_SIZE_MB = 500;
export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

export const MAX_VIDEO_DURATION_SECONDS = 3600;
export const MIN_VIDEO_DURATION_SECONDS = 1;

export const THUMBNAIL_GENERATION_COUNT = 5;
export const THUMBNAIL_WIDTH_PX = 320;
export const THUMBNAIL_FORMAT = "jpg" as const;

export const FFMPEG_PRESETS = {
  ULTRAFAST: "ultrafast",
  FAST: "fast",
  MEDIUM: "medium",
  SLOW: "slow",
  VERYSLOW: "veryslow",
} as const;

export const FFMPEG_DEFAULTS = {
  VIDEO_CODEC: "libx264",
  AUDIO_CODEC: "aac",
  PRESET: FFMPEG_PRESETS.MEDIUM,
  CONSTANT_RATE_FACTOR: 23,
  AUDIO_BITRATE: "128k",
  AUDIO_SAMPLE_RATE: 44100,
  PIXEL_FORMAT: "yuv420p",
  MAX_MUXING_QUEUE_SIZE: 1024,
} as const;

export type VideoProcessingStatus = 
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export const PROCESSING_STATUS_WEIGHTS: Record<VideoProcessingStatus, number> = {
  PENDING: 0,
  QUEUED: 1,
  PROCESSING: 2,
  COMPLETED: 3,
  FAILED: -1,
  CANCELLED: -2,
};

export const OUTPUT_FORMATS = {
  VIDEO: "mp4",
  AUDIO: "mp3",
  THUMBNAIL: THUMBNAIL_FORMAT,
} as const;

export const PROCESSING_POLLING_INTERVAL_MS = 2000;
export const PROCESSING_TIMEOUT_MS = MAX_VIDEO_DURATION_SECONDS * 2000;