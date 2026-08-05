
"use client";

// =============================================================================
// Video Studio UI — Video Job Card Component
// =============================================================================

import { useCallback } from "react";
import type { JobCardProps } from "../types";
import { formatJobStatus, formatPercentage, formatTimestamp, formatDuration } from "../utils/formatter";
import { downloadVideoJobOutput } from "../utils/download";
import { cancelJob, retryJob } from "../services/api";
import type { JobState, JobPriority } from "@/app/lib/video/types";

export function VideoJobCard({ job }: JobCardProps) {
  const handleDownload = useCallback(() => {
    downloadVideoJobOutput(job);
  }, [job]);

  const handleCancel = useCallback(async () => {
    await cancelJob(job.id as string);
  }, [job.id]);

  const handleRetry = useCallback(async () => {
    await retryJob(job.id as string);
  }, [job.id]);

  const getStatusColor = (status: JobState) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
      case "timeout":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      case "processing":
      case "retrying":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  const getPriorityColor = (priority: JobPriority) => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "normal":
        return "bg-blue-100 text-blue-800";
      case "low":
        return "bg-gray-100 text-gray-800";
    }
  };

  const isTerminal = ["completed", "failed", "cancelled", "timeout"].includes(job.state);
  const canCancel = ["queued", "pending", "processing", "retrying"].includes(job.state);
  const canRetry = ["failed", "timeout"].includes(job.state);
  const canDownload = job.state === "completed" && job.result?.outputPaths;

  const progress = job.progress?.percentage || 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{job.name}</h3>
          <p className="text-sm text-gray-500">Job ID: {job.id}</p>
        </div>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
            {job.priority}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.state)}`}>
            {formatJobStatus(job.state)}
          </span>
        </div>
      </div>

      {/* Progress */}
      {!isTerminal && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
            <span>Progress</span>
            <span>{formatPercentage(progress)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Details */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
          <p className="text-sm text-gray-900">{formatTimestamp(job.createdAt)}</p>
        </div>
        {job.completedAt && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p>
            <p className="text-sm text-gray-900">{formatTimestamp(job.completedAt)}</p>
          </div>
        )}
        {(() => {
          const duration = job.result?.metadata?.duration;
          const durationNum = typeof duration === "number" ? duration : 0;
          if (durationNum > 0) {
            return (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Duration</p>
                <p className="text-sm text-gray-900">{formatDuration(durationNum)}</p>
              </div>
            );
          }
          return null;
        })()}
        {(() => {
          const width = job.result?.metadata?.width;
          const height = job.result?.metadata?.height;
          const widthNum = typeof width === "number" ? width : undefined;
          const heightNum = typeof height === "number" ? height : undefined;
          if (widthNum && heightNum) {
            return (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Resolution</p>
                <p className="text-sm text-gray-900">{widthNum} × {heightNum}</p>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Thumbnail */}
      {job.result?.thumbnails && job.result.thumbnails.length > 0 && (
        <div className="mt-4">
          <img
            src={job.result.thumbnails[0]}
            alt="Video thumbnail"
            className="w-full h-32 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <button
          className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Open Details
        </button>
        {canDownload && (
          <button
            onClick={handleDownload}
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Download
          </button>
        )}
        {canCancel && (
          <button
            onClick={handleCancel}
            className="flex-1 bg-red-100 text-red-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
          >
            Cancel
          </button>
        )}
        {canRetry && (
          <button
            onClick={handleRetry}
            className="flex-1 bg-orange-100 text-orange-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
