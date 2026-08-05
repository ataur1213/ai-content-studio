// =============================================================================
// Video Studio UI — useVideoPolling Hook
// =============================================================================

import { useState, useCallback, useEffect, useRef } from "react";
import type { VideoJob, JobState } from "@/app/lib/video/types";
import { getJob } from "../services/api";
import {
  PROCESSING_POLLING_INTERVAL_MS,
  PROCESSING_TIMEOUT_MS
} from "../constants";

// -----------------------------------------------------------------------------
// Hook Return Type
// -----------------------------------------------------------------------------

export interface UseVideoPollingReturn {
  readonly job: VideoJob | null;
  readonly isPolling: boolean;
  readonly error: string | null;
  readonly startPolling: (jobId: string) => void;
  readonly stopPolling: () => void;
}

// -----------------------------------------------------------------------------
// Terminal States (from backend types, redefined for safety)
// -----------------------------------------------------------------------------

const TERMINAL_JOB_STATES: ReadonlySet<JobState> = new Set<JobState>([
  "completed",
  "failed",
  "cancelled",
  "timeout"
]);

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useVideoPolling(): UseVideoPollingReturn {
  const [job, setJob] = useState<VideoJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPollingRef = useRef<(() => void) | null>(null);

  const fetchJob = useCallback(async (jobId: string): Promise<void> => {
    try {
      const response = await getJob(jobId);
      setJob(response.job);
      setError(null);

      if (TERMINAL_JOB_STATES.has(response.job.state)) {
        stopPollingRef.current?.();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch job status";
      setError(message);
    }
  }, []);

  const stopPolling = useCallback((): void => {
    setIsPolling(false);

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    stopPollingRef.current = stopPolling;
  }, [stopPolling]);

  const startPolling = useCallback((jobId: string): void => {
    setIsPolling(true);
    setError(null);

    fetchJob(jobId);

    pollingIntervalRef.current = setInterval(() => {
      fetchJob(jobId);
    }, PROCESSING_POLLING_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setError("Polling timed out");
    }, PROCESSING_TIMEOUT_MS);
  }, [fetchJob, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    job,
    isPolling,
    error,
    startPolling,
    stopPolling,
  };
}
