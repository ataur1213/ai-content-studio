// =============================================================================
// Video Studio UI — Formatting Utilities
// =============================================================================

import type { JobState } from "@/app/lib/video/types";

// -----------------------------------------------------------------------------
// Format File Size
// -----------------------------------------------------------------------------

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// -----------------------------------------------------------------------------
// Format Duration
// -----------------------------------------------------------------------------

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// -----------------------------------------------------------------------------
// Format Percentage
// -----------------------------------------------------------------------------

export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

// -----------------------------------------------------------------------------
// Format Job Status
// -----------------------------------------------------------------------------

const STATUS_LABELS: Record<JobState, string> = {
  queued: "Queued",
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  retrying: "Retrying",
  timeout: "Timed Out",
};

export function formatJobStatus(status: JobState): string {
  return STATUS_LABELS[status] || status;
}

// -----------------------------------------------------------------------------
// Format Timestamp
// -----------------------------------------------------------------------------

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// -----------------------------------------------------------------------------
// Format Upload Progress
// -----------------------------------------------------------------------------

export function formatUploadProgress(
  bytesUploaded: number,
  totalBytes: number
): {
  percentage: number;
  formattedBytesUploaded: string;
  formattedTotalBytes: string;
} {
  const percentage = totalBytes > 0 ? (bytesUploaded / totalBytes) * 100 : 0;
  return {
    percentage,
    formattedBytesUploaded: formatFileSize(bytesUploaded),
    formattedTotalBytes: formatFileSize(totalBytes),
  };
}
