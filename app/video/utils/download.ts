
// =============================================================================
// Video Studio UI — Download Utilities
// =============================================================================

import type { VideoJob } from "@/app/lib/video";

// -----------------------------------------------------------------------------
// Download Blob
// -----------------------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// Download File from URL
// -----------------------------------------------------------------------------

export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  const blob = await response.blob();
  downloadBlob(blob, filename);
}

// -----------------------------------------------------------------------------
// Download Video Job Output
// -----------------------------------------------------------------------------

export function downloadVideoJobOutput(job: VideoJob): void {
  if (job.state !== "completed" || !job.result?.outputPaths || job.result.outputPaths.length === 0) {
    return;
  }

  const outputPath = job.result.outputPaths[0];
  const filename = job.name.endsWith(".mp4") ? job.name : `${job.name}.mp4`;
  void downloadFromUrl(outputPath, filename);
}

