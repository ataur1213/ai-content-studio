
"use client";

// =============================================================================
// Video Studio UI — Video Job List Component
// =============================================================================

import { VideoJobCard } from "./VideoJobCard";
import type { VideoJob } from "@/app/lib/video/types";

interface VideoJobListProps {
  readonly jobs: readonly VideoJob[];
  readonly isLoading?: boolean;
  readonly error?: string | null;
}

export function VideoJobList({ jobs, isLoading, error }: VideoJobListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500 text-lg">No jobs yet</p>
        <p className="text-gray-400 text-sm mt-1">Create a video to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto">
      {jobs.map((job) => (
        <VideoJobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
