
"use client";

// =============================================================================
// Video Studio UI — Video Preview Component
// =============================================================================

import { useCallback } from "react";
import type { VideoPreviewProps } from "../types";
import { formatDuration, formatFileSize } from "../utils/formatter";
import { downloadFromUrl } from "../utils/download";

export function VideoPreview({ preview, className }: VideoPreviewProps) {
  const handleDownload = useCallback(() => {
    if (!preview) return;
    void downloadFromUrl(preview.url, "video.mp4");
  }, [preview]);

  const handleCopyUrl = useCallback(() => {
    if (!preview) return;
    void navigator.clipboard.writeText(preview.url);
  }, [preview]);

  const handleOpenNewTab = useCallback(() => {
    if (!preview) return;
    window.open(preview.url, "_blank", "noopener,noreferrer");
  }, [preview]);

  if (!preview) {
    return (
      <div className={`flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg ${className}`}>
        <div className="text-center">
          <p className="text-gray-500 text-lg">No video to preview</p>
          <p className="text-gray-400 text-sm mt-1">Generate a video to see the preview here</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Video Player */}
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video
          src={preview.url}
          poster={preview.thumbnailUrl}
          controls
          className="w-full h-full object-contain"
        />
      </div>

      {/* Video Info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Duration</p>
          <p className="text-lg font-medium text-gray-900">{formatDuration(preview.durationSeconds)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Resolution</p>
          <p className="text-lg font-medium text-gray-900">{preview.width} × {preview.height}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">File Size</p>
          <p className="text-lg font-medium text-gray-900">{formatFileSize(0)}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          Download
        </button>
        <button
          onClick={handleCopyUrl}
          className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Copy URL
        </button>
        <button
          onClick={handleOpenNewTab}
          className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Open in New Tab
        </button>
      </div>
    </div>
  );
}
