"use client";

// =============================================================================
// Video Studio UI — Video Progress Component
// =============================================================================

import { useVideoPolling } from "../hooks/useVideoPolling";
import { formatPercentage, formatJobStatus } from "../utils/formatter";
import type { VideoJob } from "@/app/lib/video/types";

interface VideoProgressProps {
  job: VideoJob | null;
}

export function VideoProgress({ job: initialJob }: VideoProgressProps) {
  const { job, isPolling, error } = useVideoPolling();
  const currentJob = job || initialJob;

  if (!currentJob) {
    return null;
  }

  const progress = currentJob.progress?.percentage || 0;
  const status = currentJob.state;

  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "failed":
      case "timeout":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-blue-500";
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {formatJobStatus(status)}
          </h3>
          {isPolling && (
            <p className="text-sm text-gray-500">Refreshing status...</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
            {formatPercentage(progress)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Processing Step */}
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-sm text-gray-700">
          {status === "queued" && "Waiting in queue..."}
          {status === "pending" && "Initializing processing..."}
          {status === "processing" && "Processing video..."}
          {status === "retrying" && "Retrying..."}
          {status === "completed" && "Video ready!"}
          {status === "failed" && "Processing failed."}
          {status === "cancelled" && "Processing cancelled."}
          {status === "timeout" && "Processing timed out."}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
