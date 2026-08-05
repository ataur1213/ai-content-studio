import type {
  JobState,
  TerminalJobState,
  ActiveJobState,
  VideoJob,
  JobPriority,
  FFmpegOperation,
  JobError,
  FFmpegProgress,
} from './types';

import {
  TERMINAL_STATES,
  ACTIVE_STATES,
  VALID_PRIORITIES,
  VALID_OPERATIONS,
} from './types';

/**
 * Type guard that narrows a JobState to TerminalJobState.
 * Terminal states represent final job states that require no further action.
 */
export function isTerminalState(state: JobState): state is TerminalJobState {
  return (TERMINAL_STATES as ReadonlySet<JobState>).has(state);
}

/**
 * Type guard that narrows a JobState to ActiveJobState.
 * Active states represent jobs currently being processed.
 */
export function isActiveState(state: JobState): state is ActiveJobState {
  return (ACTIVE_STATES as ReadonlySet<JobState>).has(state);
}

/**
 * Type guard that validates whether an unknown value conforms to the VideoJob interface.
 * Performs structural validation of required fields and cross-references
 * valid enum values for priority and operation fields.
 */
export function isVideoJob(value: unknown): value is VideoJob {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.state === 'string' &&
    typeof obj.priority === 'string' &&
    VALID_PRIORITIES.has(obj.priority as JobPriority) &&
    typeof obj.operation === 'string' &&
    VALID_OPERATIONS.has(obj.operation as FFmpegOperation) &&
    Array.isArray(obj.inputs) &&
    typeof obj.output === 'object' &&
    obj.output !== null &&
    obj.createdAt instanceof Date
  );
}

/**
 * Type guard that validates whether an unknown value conforms to the JobError interface.
 * Validates the presence and types of required error fields.
 */
export function isJobError(value: unknown): value is JobError {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.code === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.category === 'string' &&
    typeof obj.severity === 'string' &&
    obj.timestamp instanceof Date
  );
}

/**
 * Type guard that validates whether an unknown value conforms to the FFmpegProgress interface.
 * Uses a permissive check—validates that at least one known progress field is present.
 * All fields in FFmpegProgress are optional, so presence of any field indicates intent.
 */
export function isFFmpegProgress(value: unknown): value is FFmpegProgress {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.frame !== undefined ||
    obj.timeInSeconds !== undefined ||
    obj.bitrate !== undefined ||
    obj.speed !== undefined ||
    obj.percentage !== undefined
  );
}