"use client";

// =============================================================================
// Video Studio UI — Video Upload Zone Component
// =============================================================================

import { useCallback, useState } from "react";
import { useVideoUpload } from "../hooks/useVideoUpload";
import { ACCEPTED_UPLOAD_MIME_TYPES, MAX_UPLOAD_SIZE_MB } from "../constants";

export function VideoUploadZone() {
  const {
    uploadedFile,
    selectFile,
    clearFile,
    validationError,
  } = useVideoUpload();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selectFile(file);
  }, [selectFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
  }, [selectFile]);

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {!uploadedFile ? (
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-blue-400"
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept={ACCEPTED_UPLOAD_MIME_TYPES.join(",")}
            onChange={handleFileSelect}
          />
        </label>
      ) : (
        <div className="p-4 border border-gray-300 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">{uploadedFile.file.name}</p>
                <p className="text-xs text-gray-500">
                  {(uploadedFile.file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="mt-3 text-sm text-red-500 hover:text-red-700"
          >
            Remove file
          </button>
        </div>
      )}

      {/* Validation Error */}
      {validationError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{validationError}</p>
        </div>
      )}

      {/* File Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>Accepted file types: {ACCEPTED_UPLOAD_MIME_TYPES.join(", ")}</p>
        <p>Maximum upload size: {MAX_UPLOAD_SIZE_MB} MB</p>
      </div>
    </div>
  );
}
