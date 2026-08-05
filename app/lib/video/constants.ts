import type {
  JobPriority,
  ErrorCategory,
  LogLevel,
  RetryConfig,
  QueueConfig,
  WorkerConfig,
  LoggerConfig,
} from './types';

/**
 * Numeric weights assigned to each job priority level.
 * Used by the queue for priority-based job ordering.
 * Higher values indicate higher priority.
 */
export const PRIORITY_WEIGHTS: Readonly<Record<JobPriority, number>> = {
  low: 1,
  normal: 5,
  high: 10,
  critical: 20,
} as const;

/**
 * Error categories that should never trigger an automatic retry.
 * Validation errors, for example, will never succeed on retry
 * since the input data remains unchanged.
 */
export const NON_RETRIABLE_CATEGORIES: ReadonlySet<ErrorCategory> = new Set<ErrorCategory>([
  'validation',
]);

/**
 * Numeric values assigned to each log level for severity comparison.
 * Higher values indicate more severe log entries.
 * Used to filter log messages based on minimum severity threshold.
 */
export const LOG_LEVEL_VALUES: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
} as const;

/**
 * Default retry configuration.
 * Uses exponential backoff with 10% jitter to prevent thundering herd.
 * Retries up to 3 times with delays ranging from 1s to 30s.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  strategy: 'exponential',
  baseDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.1,
  nonRetriableCategories: NON_RETRIABLE_CATEGORIES,
};

/**
 * Default queue configuration.
 * Processes up to 2 jobs concurrently with a 5-minute timeout per job.
 * Persistence is enabled by default for job recovery across restarts.
 * maxSize of 0 indicates unlimited queue capacity.
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  concurrency: 2,
  defaultPriority: 'normal',
  defaultTimeout: 300000,
  retry: DEFAULT_RETRY_CONFIG,
  persistenceEnabled: true,
  maxSize: 0,
};

/**
 * Default worker configuration.
 * Omits the `id` field since WorkerId is a branded type that must
 * be explicitly provided at worker creation time.
 * Processes one job at a time with 30-second heartbeat intervals
 * and a 30-second grace period for graceful shutdown.
 */
export const DEFAULT_WORKER_CONFIG: Omit<WorkerConfig, 'id'> = {
  concurrency: 1,
  heartbeatInterval: 30000,
  shutdownTimeout: 30000,
};

/**
 * Default logger configuration.
 * Logs at info level and above, with timestamps and context included.
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  minLevel: 'info',
  includeTimestamp: true,
  includeContext: true,
};