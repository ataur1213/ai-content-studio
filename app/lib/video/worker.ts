import type {
  WorkerStatus,
  WorkerInfo,
  WorkerConfig,
  WorkerId,
  JobId,
} from './types';
import { DEFAULT_WORKER_CONFIG } from './constants';

/**
 * Result of worker configuration validation.
 */
export interface WorkerConfigValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<string>;
}

/**
 * Options for creating a WorkerInfo instance.
 * Only `id` is required; all other fields have sensible defaults.
 */
export interface CreateWorkerInfoOptions {
  readonly id: WorkerId;
  readonly status?: WorkerStatus;
  readonly currentJobId?: JobId;
  readonly jobsCompleted?: number;
  readonly jobsFailed?: number;
  readonly startedAt?: Date;
  readonly lastHeartbeat?: Date;
}

/**
 * Options for immutably updating a WorkerInfo instance.
 * All fields are optional; only provided fields will be updated.
 */
export interface UpdateWorkerInfoOptions {
  readonly status?: WorkerStatus;
  readonly currentJobId?: JobId | null;
  readonly jobsCompleted?: number;
  readonly jobsFailed?: number;
  readonly lastHeartbeat?: Date;
}

/**
 * Creates a WorkerInfo instance with sensible defaults.
 *
 * Defaults:
 * - **status**: 'offline'
 * - **jobsCompleted**: 0
 * - **jobsFailed**: 0
 * - **startedAt**: `new Date()`
 * - **lastHeartbeat**: `new Date()`
 *
 * @param options - The worker creation options. `id` is required.
 * @returns A fully-formed WorkerInfo instance.
 *
 * @example
 * ```typescript
 * const worker = createWorkerInfo({ id: toWorkerId('worker-001') });
 * // worker.status === 'offline', worker.jobsCompleted === 0
 * ```
 */
export function createWorkerInfo(options: Readonly<CreateWorkerInfoOptions>): WorkerInfo {
  const now = new Date();
  return {
    id: options.id,
    status: options.status ?? 'offline',
    currentJobId: options.currentJobId,
    jobsCompleted: options.jobsCompleted ?? 0,
    jobsFailed: options.jobsFailed ?? 0,
    startedAt: options.startedAt ?? now,
    lastHeartbeat: options.lastHeartbeat ?? now,
  };
}

/**
 * Creates an immutable updated copy of a WorkerInfo instance.
 *
 * Supports explicit clearing of optional fields by passing `null`:
 * ```typescript
 * updateWorkerInfo(worker, { currentJobId: null }); // clears the current job
 * ```
 *
 * @param worker - The existing WorkerInfo to update.
 * @param updates - The fields to update. Omitted fields retain their current values.
 * @returns A new WorkerInfo instance with the applied updates.
 */
export function updateWorkerInfo(
  worker: Readonly<WorkerInfo>,
  updates: Readonly<UpdateWorkerInfoOptions>
): WorkerInfo {
  return {
    id: worker.id,
    status: updates.status ?? worker.status,
    currentJobId: updates.currentJobId === null
      ? undefined
      : (updates.currentJobId ?? worker.currentJobId),
    jobsCompleted: updates.jobsCompleted ?? worker.jobsCompleted,
    jobsFailed: updates.jobsFailed ?? worker.jobsFailed,
    startedAt: worker.startedAt,
    lastHeartbeat: updates.lastHeartbeat ?? worker.lastHeartbeat,
  };
}

/**
 * Transitions a worker to 'busy' status with an assigned job.
 *
 * @param worker - The current WorkerInfo.
 * @param jobId - The ID of the job being assigned.
 * @returns A new WorkerInfo with status 'busy' and currentJobId set.
 *
 * @example
 * ```typescript
 * const busyWorker = assignJob(worker, jobId);
 * // busyWorker.status === 'busy'
 * // busyWorker.currentJobId === jobId
 * ```
 */
export function assignJob(
  worker: Readonly<WorkerInfo>,
  jobId: JobId
): WorkerInfo {
  return updateWorkerInfo(worker, {
    status: 'busy',
    currentJobId: jobId,
  });
}

/**
 * Transitions a worker to 'idle' status and clears the current job assignment.
 * Optionally increments the completed or failed job counters.
 *
 * @param worker - The current WorkerInfo.
 * @param outcome - Whether the job completed successfully or failed.
 * @returns A new WorkerInfo with status 'idle', no current job, and updated counters.
 *
 * @example
 * ```typescript
 * const idleWorker = completeJob(worker, 'completed');
 * // idleWorker.status === 'idle'
 * // idleWorker.currentJobId === undefined
 * // idleWorker.jobsCompleted === worker.jobsCompleted + 1
 * ```
 */
export function completeJob(
  worker: Readonly<WorkerInfo>,
  outcome: 'completed' | 'failed'
): WorkerInfo {
  return updateWorkerInfo(worker, {
    status: 'idle',
    currentJobId: null,
    jobsCompleted: outcome === 'completed'
      ? worker.jobsCompleted + 1
      : worker.jobsCompleted,
    jobsFailed: outcome === 'failed'
      ? worker.jobsFailed + 1
      : worker.jobsFailed,
  });
}

/**
 * Transitions a worker to 'draining' status.
 *
 * A draining worker will complete its current job but will not
 * accept new job assignments. This is the recommended state
 * before graceful shutdown.
 *
 * @param worker - The current WorkerInfo.
 * @returns A new WorkerInfo with status 'draining'.
 */
export function startDraining(worker: Readonly<WorkerInfo>): WorkerInfo {
  return updateWorkerInfo(worker, { status: 'draining' });
}

/**
 * Transitions a worker to 'offline' status and clears any current job.
 *
 * This represents a hard stop—the worker is no longer available
 * and any assigned job is considered abandoned.
 *
 * @param worker - The current WorkerInfo.
 * @returns A new WorkerInfo with status 'offline' and no current job.
 */
export function goOffline(worker: Readonly<WorkerInfo>): WorkerInfo {
  return updateWorkerInfo(worker, {
    status: 'offline',
    currentJobId: null,
  });
}

/**
 * Transitions a worker to 'online' status (idle and ready for work).
 *
 * Typically called after initialization or after returning from offline state.
 *
 * @param worker - The current WorkerInfo.
 * @returns A new WorkerInfo with status 'idle' and an updated heartbeat.
 */
export function goOnline(worker: Readonly<WorkerInfo>): WorkerInfo {
  return updateWorkerInfo(worker, {
    status: 'idle',
    lastHeartbeat: new Date(),
  });
}

/**
 * Updates the lastHeartbeat timestamp to the current time.
 *
 * @param worker - The current WorkerInfo.
 * @returns A new WorkerInfo with an updated heartbeat.
 */
export function updateHeartbeat(worker: Readonly<WorkerInfo>): WorkerInfo {
  return updateWorkerInfo(worker, {
    lastHeartbeat: new Date(),
  });
}

// -----------------------------------------------------------------------------
// Status Checks
// -----------------------------------------------------------------------------

/**
 * Checks if a worker is currently idle and available for job assignment.
 *
 * @param worker - The worker to check.
 * @returns True if the worker status is 'idle'.
 */
export function isIdle(worker: Readonly<WorkerInfo>): boolean {
  return worker.status === 'idle';
}

/**
 * Checks if a worker is currently processing a job.
 *
 * @param worker - The worker to check.
 * @returns True if the worker status is 'busy'.
 */
export function isBusy(worker: Readonly<WorkerInfo>): boolean {
  return worker.status === 'busy';
}

/**
 * Checks if a worker is in draining state.
 *
 * A draining worker will finish its current job but won't accept new ones.
 *
 * @param worker - The worker to check.
 * @returns True if the worker status is 'draining'.
 */
export function isDraining(worker: Readonly<WorkerInfo>): boolean {
  return worker.status === 'draining';
}

/**
 * Checks if a worker is offline.
 *
 * @param worker - The worker to check.
 * @returns True if the worker status is 'offline'.
 */
export function isOffline(worker: Readonly<WorkerInfo>): boolean {
  return worker.status === 'offline';
}

/**
 * Checks if a worker can accept a new job assignment.
 *
 * A worker can accept jobs when it is idle and not draining or offline.
 *
 * @param worker - The worker to check.
 * @returns True if the worker is available for job assignment.
 */
export function isAvailable(worker: Readonly<WorkerInfo>): boolean {
  return worker.status === 'idle';
}

/**
 * Checks if a worker has an active job assignment.
 *
 * @param worker - The worker to check.
 * @returns True if currentJobId is defined.
 */
export function hasActiveJob(worker: Readonly<WorkerInfo>): boolean {
  return worker.currentJobId !== undefined;
}

// -----------------------------------------------------------------------------
// Heartbeat & Health
// -----------------------------------------------------------------------------

/**
 * Checks if a worker's heartbeat is stale based on a timeout threshold.
 *
 * A worker with no heartbeat or a heartbeat older than the threshold
 * is considered potentially dead or unresponsive.
 *
 * @param worker - The worker to check.
 * @param heartbeatTimeoutMs - Maximum allowable age of the last heartbeat in milliseconds.
 * @param now - Reference time for the check. Defaults to current time.
 * @returns True if the heartbeat is stale or missing.
 *
 * @example
 * ```typescript
 * const stale = isHeartbeatStale(worker, 60000);
 * // Returns true if the worker hasn't sent a heartbeat in over 60 seconds
 * ```
 */
export function isHeartbeatStale(
  worker: Readonly<WorkerInfo>,
  heartbeatTimeoutMs: number,
  now: Date = new Date()
): boolean {
  if (!worker.lastHeartbeat) {
    return true;
  }

  const elapsed = now.getTime() - worker.lastHeartbeat.getTime();
  return elapsed > heartbeatTimeoutMs;
}

/**
 * Calculates the elapsed time since the worker's last heartbeat.
 *
 * @param worker - The worker to measure.
 * @param now - Reference time for the calculation. Defaults to current time.
 * @returns Elapsed time in milliseconds. Returns Infinity if no heartbeat exists.
 */
export function timeSinceHeartbeat(
  worker: Readonly<WorkerInfo>,
  now: Date = new Date()
): number {
  if (!worker.lastHeartbeat) {
    return Infinity;
  }

  return now.getTime() - worker.lastHeartbeat.getTime();
}

/**
 * Calculates how long the worker has been running since it started.
 *
 * @param worker - The worker to measure.
 * @param now - Reference time for the calculation. Defaults to current time.
 * @returns Uptime in milliseconds.
 */
export function getWorkerUptime(
  worker: Readonly<WorkerInfo>,
  now: Date = new Date()
): number {
  return now.getTime() - worker.startedAt.getTime();
}

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------

/**
 * Calculates the total number of jobs processed by a worker.
 *
 * @param worker - The worker to measure.
 * @returns Sum of completed and failed jobs.
 */
export function getTotalJobsProcessed(worker: Readonly<WorkerInfo>): number {
  return worker.jobsCompleted + worker.jobsFailed;
}

/**
 * Calculates the worker's success rate as a value between 0 and 1.
 *
 * Returns 0 if the worker has processed no jobs (avoids division by zero).
 *
 * @param worker - The worker to measure.
 * @returns Success rate from 0 (all failed) to 1 (all succeeded).
 *
 * @example
 * ```typescript
 * const rate = getSuccessRate(worker);
 * console.log(`Success rate: ${(rate * 100).toFixed(1)}%`);
 * ```
 */
export function getSuccessRate(worker: Readonly<WorkerInfo>): number {
  const total = getTotalJobsProcessed(worker);
  if (total === 0) {
    return 0;
  }
  return worker.jobsCompleted / total;
}

/**
 * Calculates the worker's failure rate as a value between 0 and 1.
 *
 * Returns 0 if the worker has processed no jobs (avoids division by zero).
 *
 * @param worker - The worker to measure.
 * @returns Failure rate from 0 (none failed) to 1 (all failed).
 */
export function getFailureRate(worker: Readonly<WorkerInfo>): number {
  const total = getTotalJobsProcessed(worker);
  if (total === 0) {
    return 0;
  }
  return worker.jobsFailed / total;
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Merges a partial WorkerConfig (without id) with the default configuration.
 * The `id` field is intentionally excluded from defaults since it is
 * a branded type that must be explicitly provided.
 *
 * @param partial - A partial configuration with values to override.
 * @returns A complete Omit<WorkerConfig, 'id'> object.
 *
 * @example
 * ```typescript
 * const config = mergeWorkerConfig({ concurrency: 2 });
 * // To create a full config, add the id:
 * const fullConfig: WorkerConfig = { ...config, id: toWorkerId('w-1') };
 * ```
 */
export function mergeWorkerConfig(
  partial: Partial<Readonly<Omit<WorkerConfig, 'id'>>>
): Omit<WorkerConfig, 'id'> {
  return {
    concurrency: partial.concurrency ?? DEFAULT_WORKER_CONFIG.concurrency,
    heartbeatInterval: partial.heartbeatInterval ?? DEFAULT_WORKER_CONFIG.heartbeatInterval,
    shutdownTimeout: partial.shutdownTimeout ?? DEFAULT_WORKER_CONFIG.shutdownTimeout,
  };
}

/**
 * Validates a WorkerConfig object for correctness.
 *
 * Validation rules:
 * - `id` must be a non-empty string
 * - `concurrency` must be a positive integer
 * - `heartbeatInterval` must be a positive number
 * - `shutdownTimeout` must be a positive number
 *
 * @param config - The configuration to validate.
 * @returns A validation result indicating validity and listing any errors.
 */
export function validateWorkerConfig(
  config: Readonly<WorkerConfig>
): WorkerConfigValidationResult {
  const errors: string[] = [];

  if (typeof config.id !== 'string' || config.id.length === 0) {
    errors.push('id must be a non-empty string');
  }

  if (!Number.isInteger(config.concurrency) || config.concurrency < 1) {
    errors.push('concurrency must be a positive integer');
  }

  if (typeof config.heartbeatInterval !== 'number' || config.heartbeatInterval <= 0) {
    errors.push('heartbeatInterval must be a positive number');
  }

  if (typeof config.shutdownTimeout !== 'number' || config.shutdownTimeout <= 0) {
    errors.push('shutdownTimeout must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// -----------------------------------------------------------------------------
// Collection Operations
// -----------------------------------------------------------------------------

/**
 * Filters an array of workers to only those available for job assignment.
 *
 * @param workers - The workers to filter.
 * @returns Workers with status 'idle'.
 */
export function getAvailableWorkers(
  workers: ReadonlyArray<WorkerInfo>
): ReadonlyArray<WorkerInfo> {
  return workers.filter(isAvailable);
}

/**
 * Counts the number of workers available for job assignment.
 *
 * @param workers - The workers to count.
 * @returns The number of idle workers.
 */
export function countAvailableWorkers(
  workers: ReadonlyArray<WorkerInfo>
): number {
  return getAvailableWorkers(workers).length;
}

/**
 * Counts the number of workers currently processing jobs.
 *
 * @param workers - The workers to count.
 * @returns The number of busy workers.
 */
export function countBusyWorkers(
  workers: ReadonlyArray<WorkerInfo>
): number {
  return workers.filter(isBusy).length;
}

/**
 * Finds a worker by its ID.
 *
 * @param workers - The workers to search.
 * @param id - The worker ID to find.
 * @returns The matching worker, or undefined if not found.
 */
export function findWorkerById(
  workers: ReadonlyArray<WorkerInfo>,
  id: WorkerId
): WorkerInfo | undefined {
  return workers.find((w) => w.id === id);
}

/**
 * Finds the worker that is currently processing a specific job.
 *
 * @param workers - The workers to search.
 * @param jobId - The job ID to look for.
 * @returns The worker processing the job, or undefined if no worker has this job.
 */
export function findWorkerByJobId(
  workers: ReadonlyArray<WorkerInfo>,
  jobId: JobId
): WorkerInfo | undefined {
  return workers.find((w) => w.currentJobId === jobId);
}

/**
 * Filters workers with stale heartbeats.
 *
 * @param workers - The workers to check.
 * @param heartbeatTimeoutMs - Maximum allowable heartbeat age in milliseconds.
 * @param now - Reference time. Defaults to current time.
 * @returns Workers whose heartbeat has exceeded the timeout.
 */
export function getStaleWorkers(
  workers: ReadonlyArray<WorkerInfo>,
  heartbeatTimeoutMs: number,
  now: Date = new Date()
): ReadonlyArray<WorkerInfo> {
  return workers.filter((w) => isHeartbeatStale(w, heartbeatTimeoutMs, now));
}

/**
 * Aggregates statistics across all workers.
 *
 * @param workers - The workers to aggregate.
 * @returns An object with total counts and aggregate rates.
 */
export function getWorkerPoolStats(workers: ReadonlyArray<WorkerInfo>): WorkerPoolStats {
  let totalCompleted = 0;
  let totalFailed = 0;
  let idleCount = 0;
  let busyCount = 0;
  let drainingCount = 0;
  let offlineCount = 0;

  for (const worker of workers) {
    totalCompleted += worker.jobsCompleted;
    totalFailed += worker.jobsFailed;

    switch (worker.status) {
      case 'idle':
        idleCount++;
        break;
      case 'busy':
        busyCount++;
        break;
      case 'draining':
        drainingCount++;
        break;
      case 'offline':
        offlineCount++;
        break;
    }
  }

  const totalProcessed = totalCompleted + totalFailed;
  const successRate = totalProcessed > 0 ? totalCompleted / totalProcessed : 0;

  return {
    totalWorkers: workers.length,
    byStatus: {
      idle: idleCount,
      busy: busyCount,
      draining: drainingCount,
      offline: offlineCount,
    },
    totalJobsCompleted: totalCompleted,
    totalJobsFailed: totalFailed,
    totalJobsProcessed: totalProcessed,
    successRate,
  };
}

/**
 * Aggregated statistics for a pool of workers.
 */
export interface WorkerPoolStats {
  readonly totalWorkers: number;
  readonly byStatus: Readonly<Record<WorkerStatus, number>>;
  readonly totalJobsCompleted: number;
  readonly totalJobsFailed: number;
  readonly totalJobsProcessed: number;
  readonly successRate: number;
}