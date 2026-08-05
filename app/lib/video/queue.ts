import type {
  JobState,
  JobPriority,
  VideoJob,
  QueueStats,
  QueueConfig,
  WorkerId,
  FFmpegProgress,
} from './types';
import { DEFAULT_QUEUE_CONFIG, PRIORITY_WEIGHTS, DEFAULT_LOGGER_CONFIG } from './constants';
import { isTerminalState, isActiveState } from './validator';
import { toWorkerId } from './utils';
import { createWorkerInfo, assignJob, goOnline, isOffline, getAvailableWorkers, completeJob } from './worker';
import { processJob } from './processor';
import { jobStore, workerStore } from './state';
import { Logger } from './logger';

/**
 * Options for computing queue statistics.
 */
export interface CalculateQueueStatsOptions {
  readonly jobs: ReadonlyArray<VideoJob>;
  readonly now?: Date;
}

/**
 * Result of queue configuration validation.
 */
export interface QueueConfigValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
}

/**
 * Creates an empty QueueStats object with all values zeroed.
 * Useful as an initial state before any jobs are enqueued.
 *
 * @returns A QueueStats object representing an empty queue.
 */
export function createEmptyQueueStats(): QueueStats {
  return {
    total: 0,
    byState: {},
    byPriority: {},
    averageWaitTime: 0,
    averageProcessingTime: 0,
  };
}

/**
 * Computes comprehensive queue statistics from an array of jobs.
 *
 * Calculates:
 * - Total job count
 * - Job counts grouped by state
 * - Job counts grouped by priority
 * - Average wait time for queued/pending jobs (milliseconds since creation)
 * - Average processing time for completed jobs (milliseconds from start to completion)
 *
 * @param options - The calculation options including the jobs array and optional reference time.
 * @returns A complete QueueStats object.
 *
 * @example
 * ```typescript
 * const stats = calculateQueueStats({
 *   jobs: allJobs,
 *   now: new Date(),
 * });
 * console.log(`Average wait: ${stats.averageWaitTime}ms`);
 * ```
 */
export function calculateQueueStats(options: Readonly<CalculateQueueStatsOptions>): QueueStats {
  const { jobs, now = new Date() } = options;

  if (jobs.length === 0) {
    return createEmptyQueueStats();
  }

  const byState: Partial<Record<JobState, number>> = {};
  const byPriority: Partial<Record<JobPriority, number>> = {};

  let totalWaitTime = 0;
  let waitTimeCount = 0;
  let totalProcessingTime = 0;
  let processingTimeCount = 0;

  for (const job of jobs) {
    byState[job.state] = (byState[job.state] ?? 0) + 1;
    byPriority[job.priority] = (byPriority[job.priority] ?? 0) + 1;

    if (job.state === 'queued' || job.state === 'pending') {
      const waitTime = now.getTime() - job.createdAt.getTime();
      totalWaitTime += waitTime;
      waitTimeCount++;
    }

    if (job.state === 'completed' && job.startedAt && job.completedAt) {
      const processingTime = job.completedAt.getTime() - job.startedAt.getTime();
      totalProcessingTime += processingTime;
      processingTimeCount++;
    }
  }

  return {
    total: jobs.length,
    byState,
    byPriority,
    averageWaitTime: waitTimeCount > 0 ? totalWaitTime / waitTimeCount : 0,
    averageProcessingTime: processingTimeCount > 0 ? totalProcessingTime / processingTimeCount : 0,
  };
}

/**
 * Determines whether the queue has reached its maximum capacity.
 *
 * A maxSize of 0 indicates unlimited capacity (never full).
 *
 * @param currentSize - The current number of jobs in the queue.
 * @param config - The queue configuration containing maxSize.
 * @returns True if the queue is at or over capacity.
 */
export function isQueueFull(
  currentSize: number,
  config: Readonly<QueueConfig>
): boolean {
  return config.maxSize > 0 && currentSize >= config.maxSize;
}

/**
 * Computes the numeric priority weight for a given JobPriority.
 *
 * Uses PRIORITY_WEIGHTS from constants for consistent weight mapping
 * across the application.
 *
 * @param priority - The job priority level.
 * @returns The numeric weight for queue sorting.
 */
export function getPriorityWeight(priority: JobPriority): number {
  return PRIORITY_WEIGHTS[priority];
}

/**
 * Compares two jobs by priority for sorting purposes.
 *
 * Primary sort: Higher priority weight first (descending).
 * Tie-breaker: Earlier creation time first (ascending).
 *
 * Designed for use with Array.sort().
 *
 * @param a - First job.
 * @param b - Second job.
 * @returns Negative if a should come first, positive if b should come first, 0 if equal.
 */
export function compareJobPriority(
  a: Readonly<VideoJob>,
  b: Readonly<VideoJob>
): number {
  const weightA = getPriorityWeight(a.priority);
  const weightB = getPriorityWeight(b.priority);

  if (weightA !== weightB) {
    return weightB - weightA;
  }

  return a.createdAt.getTime() - b.createdAt.getTime();
}

/**
 * Sorts an array of jobs by priority (highest first) with creation time as tie-breaker.
 * Returns a new array; does not mutate the input.
 *
 * @param jobs - The jobs to sort.
 * @returns A new array sorted by priority.
 */
export function sortByPriority(
  jobs: ReadonlyArray<VideoJob>
): ReadonlyArray<VideoJob> {
  return [...jobs].sort(compareJobPriority);
}

/**
 * Filters jobs to only those in active states (processing or retrying).
 *
 * @param jobs - The jobs to filter.
 * @returns Jobs currently being processed.
 */
export function getActiveJobs(
  jobs: ReadonlyArray<VideoJob>
): ReadonlyArray<VideoJob> {
  return jobs.filter((job): job is VideoJob => isActiveState(job.state));
}

/**
 * Filters jobs to only those in terminal states (completed, failed, cancelled, timeout).
 *
 * @param jobs - The jobs to filter.
 * @returns Jobs that have reached a final state.
 */
export function getTerminalJobs(
  jobs: ReadonlyArray<VideoJob>
): ReadonlyArray<VideoJob> {
  return jobs.filter((job): job is VideoJob => isTerminalState(job.state));
}

/**
 * Filters jobs to only those waiting to be processed (queued or pending).
 *
 * @param jobs - The jobs to filter.
 * @returns Jobs waiting for processing.
 */
export function getWaitingJobs(
  jobs: ReadonlyArray<VideoJob>
): ReadonlyArray<VideoJob> {
  return jobs.filter(
    (job): job is VideoJob => job.state === 'queued' || job.state === 'pending'
  );
}

/**
 * Counts the number of jobs currently in active states.
 *
 * @param jobs - The jobs to count.
 * @returns The number of active jobs.
 */
export function countActiveJobs(
  jobs: ReadonlyArray<VideoJob>
): number {
  return getActiveJobs(jobs).length;
}

/**
 * Determines whether the queue can accept more jobs for processing.
 *
 * A queue can process more jobs when both:
 * - The number of active jobs is less than the configured concurrency limit
 * - The queue is not at maximum capacity
 *
 * @param jobs - All jobs in the queue.
 * @param config - The queue configuration.
 * @returns True if the queue can process additional jobs.
 */
export function canProcessMore(
  jobs: ReadonlyArray<VideoJob>,
  config: Readonly<QueueConfig>
): boolean {
  if (isQueueFull(jobs.length, config)) {
    return false;
  }

  const activeCount = countActiveJobs(jobs);
  return activeCount < config.concurrency;
}

/**
 * Returns the number of additional jobs that can be processed concurrently.
 *
 * Returns 0 if the queue is at maximum capacity regardless of
 * available concurrency slots.
 *
 * @param jobs - All jobs in the queue.
 * @param config - The queue configuration.
 * @returns The number of available processing slots (minimum 0).
 */
export function getAvailableSlots(
  jobs: ReadonlyArray<VideoJob>,
  config: Readonly<QueueConfig>
): number {
  if (isQueueFull(jobs.length, config)) {
    return 0;
  }

  const activeCount = countActiveJobs(jobs);
  const available = config.concurrency - activeCount;
  return Math.max(0, available);
}

/**
 * Merges a partial QueueConfig with the default configuration.
 * Provided values override defaults; missing values fall back to defaults.
 *
 * @param partial - A partial configuration with values to override.
 * @returns A complete QueueConfig object.
 *
 * @example
 * ```typescript
 * const config = mergeQueueConfig({ concurrency: 4 });
 * // config.concurrency = 4, all other fields from defaults
 * ```
 */
export function mergeQueueConfig(
  partial: Partial<Readonly<QueueConfig>>
): QueueConfig {
  return {
    concurrency: partial.concurrency ?? DEFAULT_QUEUE_CONFIG.concurrency,
    defaultPriority: partial.defaultPriority ?? DEFAULT_QUEUE_CONFIG.defaultPriority,
    defaultTimeout: partial.defaultTimeout ?? DEFAULT_QUEUE_CONFIG.defaultTimeout,
    retry: partial.retry ?? DEFAULT_QUEUE_CONFIG.retry,
    persistenceEnabled: partial.persistenceEnabled ?? DEFAULT_QUEUE_CONFIG.persistenceEnabled,
    maxSize: partial.maxSize ?? DEFAULT_QUEUE_CONFIG.maxSize,
  };
}

/**
 * Validates a QueueConfig object for correctness.
 *
 * Validation rules:
 * - `concurrency` must be a positive integer
 * - `defaultTimeout` must be a positive number
 * - `maxSize` must be zero (unlimited) or a positive integer
 * - `defaultPriority` must be defined
 * - `retry` configuration must be present
 *
 * @param config - The configuration to validate.
 * @returns A validation result indicating validity and listing any errors.
 */
export function validateQueueConfig(
  config: Readonly<QueueConfig>
): QueueConfigValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(config.concurrency) || config.concurrency < 1) {
    errors.push('concurrency must be a positive integer');
  }

  if (typeof config.defaultTimeout !== 'number' || config.defaultTimeout <= 0) {
    errors.push('defaultTimeout must be a positive number');
  }

  if (!Number.isInteger(config.maxSize) || config.maxSize < 0) {
    errors.push('maxSize must be zero (unlimited) or a positive integer');
  }

  if (config.defaultPriority === undefined || config.defaultPriority === null) {
    errors.push('defaultPriority is required');
  }

  if (!config.retry) {
    errors.push('retry configuration is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Selects the next job(s) to process from the queue.
 *
 * Selection criteria:
 * 1. Job must be in 'queued' or 'pending' state
 * 2. Jobs are sorted by priority (highest first), with creation time as tie-breaker
 * 3. Returns at most `limit` jobs
 *
 * Does not mutate the input array.
 *
 * @param jobs - All jobs in the queue.
 * @param limit - Maximum number of jobs to select. Clamped to non-negative.
 * @returns The selected jobs in priority order, ready for processing.
 *
 * @example
 * ```typescript
 * const slots = getAvailableSlots(allJobs, queueConfig);
 * const nextJobs = selectNextJobs(allJobs, slots);
 * for (const job of nextJobs) {
 *   await processJob(job);
 * }
 * ```
 */
export function selectNextJobs(
  jobs: ReadonlyArray<VideoJob>,
  limit: number
): ReadonlyArray<VideoJob> {
  const waiting = getWaitingJobs(jobs);
  const sorted = sortByPriority(waiting);
  return sorted.slice(0, Math.max(0, limit));
}

const SHARED_DEFAULT_WORKER_ID: WorkerId = toWorkerId('worker-default-001');
const SHARED_QUEUE_LOGGER: Logger = new Logger({
  ...DEFAULT_LOGGER_CONFIG,
  context: { module: 'video-queue' },
});

export async function processQueue(
  queueConfig: QueueConfig = DEFAULT_QUEUE_CONFIG
): Promise<void> {
  const allJobs = Array.from(jobStore.values());
  const allWorkers = Array.from(workerStore.values());

  const defaultWorker = workerStore.get(SHARED_DEFAULT_WORKER_ID);
  if (!defaultWorker) {
    const createdWorker = createWorkerInfo({ id: SHARED_DEFAULT_WORKER_ID });
    const onlineWorker = goOnline(createdWorker);
    workerStore.set(SHARED_DEFAULT_WORKER_ID, onlineWorker);
    allWorkers.push(onlineWorker);
  } else if (isOffline(defaultWorker)) {
    const onlineWorker = goOnline(defaultWorker);
    workerStore.set(SHARED_DEFAULT_WORKER_ID, onlineWorker);
    allWorkers.push(onlineWorker);
  }

  if (!canProcessMore(allJobs, queueConfig)) {
    SHARED_QUEUE_LOGGER.debug('Queue cannot process more jobs. Concurrency limit or max size reached.');
    return;
  }

  const availableWorkers = getAvailableWorkers(allWorkers);
  if (availableWorkers.length === 0) {
    SHARED_QUEUE_LOGGER.debug('No workers available to process jobs.');
    return;
  }

  const slots = availableWorkers.length;
  const nextJobs = selectNextJobs(allJobs, slots);

  for (let i = 0; i < nextJobs.length; i++) {
    const job = nextJobs[i];
    const worker = availableWorkers[i];

    const updatedJob: VideoJob = {
      ...job,
      state: 'processing',
      startedAt: new Date(),
    };
    jobStore.set(job.id, updatedJob);

    const busyWorker = assignJob(worker, job.id);
    workerStore.set(worker.id, busyWorker);

    SHARED_QUEUE_LOGGER.info('Job assigned to worker', {
      jobId: job.id,
      workerId: worker.id,
    });

    (async () => {
      const result = await processJob(job, (progress: FFmpegProgress) => {
        const currentJob = jobStore.get(job.id);
        if (currentJob) {
          const withProgress: VideoJob = {
            ...currentJob,
            progress,
          };
          jobStore.set(job.id, withProgress);
        }
      });

      const finalJob = jobStore.get(job.id);
      if (!finalJob) return;

      const completedAt = new Date();
      let finalState: VideoJob;
      if (result.success && result.result) {
        finalState = {
          ...finalJob,
          state: 'completed',
          result: result.result,
          completedAt,
        };
        SHARED_QUEUE_LOGGER.info('Job completed successfully', {
          jobId: finalJob.id,
          result: result.result,
        });
      } else if (result.error) {
        finalState = {
          ...finalJob,
          state: 'failed',
          error: result.error,
          completedAt,
        };
        SHARED_QUEUE_LOGGER.error('Job failed', {
          jobId: finalJob.id,
          error: result.error,
        });
      } else {
        finalState = {
          ...finalJob,
          state: 'failed',
          completedAt,
        };
        SHARED_QUEUE_LOGGER.warn('Job completed with no result and no error', {
          jobId: finalJob.id,
        });
      }

      const currentWorker = workerStore.get(worker.id);
      if (currentWorker) {
        const idleWorker = completeJob(
          currentWorker,
          finalState.state === 'completed' ? 'completed' : 'failed'
        );
        workerStore.set(worker.id, idleWorker);
      }

      jobStore.set(job.id, finalState);
      await processQueue(queueConfig);
    })();
  }
}