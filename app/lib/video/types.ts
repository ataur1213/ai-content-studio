// =============================================================================
// Video Job System — Core Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Job Lifecycle
// -----------------------------------------------------------------------------

/**
 * Complete set of states a video job can transition through.
 *
 * Transitions:
 *   queued    → pending   → processing → completed
 *                      ↘            → failed     → retrying → processing
 *                                        → timeout
 *   queued    → cancelled
 *   pending   → cancelled
 *   retrying  → cancelled
 */
export type JobState =
  | 'queued'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying'
  | 'timeout';

export type ActiveJobState = 'processing' | 'retrying';

export type TerminalJobState = 'completed' | 'failed' | 'cancelled' | 'timeout';

export const TERMINAL_STATES: ReadonlySet<TerminalJobState> = new Set<TerminalJobState>([
  'completed',
  'failed',
  'cancelled',
  'timeout',
]);

export const ACTIVE_STATES: ReadonlySet<ActiveJobState> = new Set<ActiveJobState>([
  'processing',
  'retrying',
]);

// -----------------------------------------------------------------------------
// Priority
// -----------------------------------------------------------------------------

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export const VALID_PRIORITIES: ReadonlySet<JobPriority> = new Set<JobPriority>([
  'low',
  'normal',
  'high',
  'critical',
]);

// -----------------------------------------------------------------------------
// Branded Identifiers
// -----------------------------------------------------------------------------

export type JobId = string & { readonly __brand: 'JobId' };
export type WorkerId = string & { readonly __brand: 'WorkerId' };

// -----------------------------------------------------------------------------
// Video Input
// -----------------------------------------------------------------------------

export type InputSource = 'file' | 'url' | 'buffer' | 'stream';

export interface StreamIndexSelection {
  readonly video?: number;
  readonly audio?: number;
  readonly subtitle?: number;
}

export interface VideoInput {
  readonly id: string;
  readonly source: InputSource;
  readonly path: string;
  readonly startTime?: number;
  readonly duration?: number;
  readonly streamIndex?: StreamIndexSelection;
}

// -----------------------------------------------------------------------------
// Video Output
// -----------------------------------------------------------------------------

export type VideoCodec = 'h264' | 'h265' | 'vp8' | 'vp9' | 'av1' | 'copy';
export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'flac' | 'copy' | 'none';
export type ContainerFormat =
  | 'mp4'
  | 'webm'
  | 'mkv'
  | 'mov'
  | 'avi'
  | 'gif'
  | 'mp3'
  | 'wav';

export type ResolutionPreset =
  | '4k'
  | '1080p'
  | '720p'
  | '480p'
  | '360p'
  | 'custom';

export interface Resolution {
  readonly preset: ResolutionPreset;
  readonly width?: number;
  readonly height?: number;
}

export interface VideoOutput {
  readonly path: string;
  readonly format: ContainerFormat;
  readonly videoCodec: VideoCodec;
  readonly audioCodec: AudioCodec;
  readonly videoBitrate?: number;
  readonly audioBitrate?: number;
  readonly frameRate?: number;
  readonly resolution?: Resolution;
  readonly extraFlags?: ReadonlyArray<string>;
  readonly overwrite?: boolean;
}

// -----------------------------------------------------------------------------
// FFmpeg Operations
// -----------------------------------------------------------------------------

export type FFmpegOperation =
  | 'concat'
  | 'trim'
  | 'resize'
  | 'transcode'
  | 'extract-audio'
  | 'detect-scenes'
  | 'detect-silence'
  | 'add-watermark'
  | 'add-subtitles'
  | 'merge-audio'
  | 'thumbnail'
  | 'custom';

export const VALID_OPERATIONS: ReadonlySet<FFmpegOperation> = new Set<FFmpegOperation>([
  'concat',
  'trim',
  'resize',
  'transcode',
  'extract-audio',
  'detect-scenes',
  'detect-silence',
  'add-watermark',
  'add-subtitles',
  'merge-audio',
  'thumbnail',
  'custom',
]);

export interface FFmpegProgress {
  readonly frame?: number;
  readonly timeInSeconds?: number;
  readonly bitrate?: number;
  readonly speed?: number;
  readonly percentage?: number;
}

// -----------------------------------------------------------------------------
// Core Job Entity
// -----------------------------------------------------------------------------

export interface VideoJob {
  readonly id: JobId;
  readonly name: string;
  state: JobState;
  readonly priority: JobPriority;
  readonly operation: FFmpegOperation;
  readonly inputs: ReadonlyArray<VideoInput>;
  readonly output: VideoOutput;
  readonly createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: FFmpegProgress;
  retryCount: number;
  readonly maxRetries: number;
  readonly timeout: number;
  readonly metadata?: Record<string, unknown>;
  error?: JobError;
  result?: JobResult;
}

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory =
  | 'validation'
  | 'input'
  | 'processing'
  | 'output'
  | 'system'
  | 'timeout'
  | 'unknown';

export interface JobError {
  readonly code: string;
  readonly message: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly originalError?: Error;
  readonly timestamp: Date;
  readonly stack?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

// -----------------------------------------------------------------------------
// Result Types
// -----------------------------------------------------------------------------

export interface JobResult {
  readonly outputPaths: ReadonlyArray<string>;
  readonly outputSizes?: ReadonlyArray<number>;
  readonly processingDuration: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly thumbnails?: ReadonlyArray<string>;
}

// -----------------------------------------------------------------------------
// Retry Configuration
// -----------------------------------------------------------------------------

export type RetryStrategy = 'fixed' | 'exponential' | 'linear';

export interface RetryConfig {
  readonly maxRetries: number;
  readonly strategy: RetryStrategy;
  readonly baseDelay: number;
  readonly maxDelay: number;
  readonly jitterFactor: number;
  readonly nonRetriableCategories: ReadonlySet<ErrorCategory>;
}

// -----------------------------------------------------------------------------
// Queue Types
// -----------------------------------------------------------------------------

export interface QueueStats {
  readonly total: number;
  readonly byState: Readonly<Partial<Record<JobState, number>>>;
  readonly byPriority: Readonly<Partial<Record<JobPriority, number>>>;
  readonly averageWaitTime: number;
  readonly averageProcessingTime: number;
}

export interface QueueConfig {
  readonly concurrency: number;
  readonly defaultPriority: JobPriority;
  readonly defaultTimeout: number;
  readonly retry: RetryConfig;
  readonly persistenceEnabled: boolean;
  readonly maxSize: number;
}

// -----------------------------------------------------------------------------
// Worker Types
// -----------------------------------------------------------------------------

export type WorkerStatus = 'idle' | 'busy' | 'draining' | 'offline';

export interface WorkerInfo {
  readonly id: WorkerId;
  readonly status: WorkerStatus;
  readonly currentJobId?: JobId;
  readonly jobsCompleted: number;
  readonly jobsFailed: number;
  readonly startedAt: Date;
  readonly lastHeartbeat: Date;
}

export interface WorkerConfig {
  readonly id: WorkerId;
  readonly concurrency: number;
  readonly heartbeatInterval: number;
  readonly shutdownTimeout: number;
}

// -----------------------------------------------------------------------------
// Validation Types
// -----------------------------------------------------------------------------

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly value?: unknown;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly timestamp: Date;
}

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CreateJobResponse {
  readonly job: VideoJob;
}

export interface JobStatusResponse {
  readonly job: VideoJob;
}

export interface JobListResponse {
  readonly jobs: ReadonlyArray<VideoJob>;
  readonly pagination: Pagination;
  readonly stats: QueueStats;
}

export interface CancelJobResponse {
  readonly job: VideoJob;
  readonly message: string;
}

export interface Pagination {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

// -----------------------------------------------------------------------------
// Event Types
// -----------------------------------------------------------------------------

export type JobEventType =
  | 'job:created'
  | 'job:queued'
  | 'job:started'
  | 'job:progress'
  | 'job:completed'
  | 'job:failed'
  | 'job:cancelled'
  | 'job:retrying'
  | 'job:timeout'
  | 'worker:started'
  | 'worker:stopped'
  | 'worker:heartbeat';

export interface JobEvent<T extends JobEventType = JobEventType> {
  readonly type: T;
  readonly jobId?: JobId;
  readonly timestamp: Date;
  readonly payload: JobEventPayloadMap[T];
}

export interface JobEventPayloadMap {
  'job:created': { readonly job: VideoJob };
  'job:queued': { readonly job: VideoJob };
  'job:started': { readonly job: VideoJob };
  'job:progress': { readonly job: VideoJob; readonly progress: FFmpegProgress };
  'job:completed': { readonly job: VideoJob; readonly result: JobResult };
  'job:failed': { readonly job: VideoJob; readonly error: JobError };
  'job:cancelled': { readonly job: VideoJob };
  'job:retrying': {
    readonly job: VideoJob;
    readonly attempt: number;
    readonly nextRetryAt: Date;
  };
  'job:timeout': { readonly job: VideoJob };
  'worker:started': { readonly workerId: WorkerId };
  'worker:stopped': { readonly workerId: WorkerId };
  'worker:heartbeat': { readonly workerId: WorkerId; readonly worker: WorkerInfo };
}

export type JobEventHandler<T extends JobEventType = JobEventType> = (
  event: JobEvent<T>
) => void | Promise<void>;

// -----------------------------------------------------------------------------
// Logger Types
// -----------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: Date;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly jobId?: JobId;
  readonly workerId?: WorkerId;
  readonly error?: Error;
}

export interface LoggerConfig {
  readonly minLevel: LogLevel;
  readonly includeTimestamp: boolean;
  readonly includeContext: boolean;
}