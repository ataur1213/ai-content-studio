// =============================================================================
// Video Studio UI — useVideoUpload Hook
// =============================================================================

import { useState, useCallback, useEffect } from "react";
import type { UploadedFile, UploadStatus, UploadProgress } from "../types";
import {
  ACCEPTED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES
} from "../constants";

// -----------------------------------------------------------------------------
// Hook Return Type
// -----------------------------------------------------------------------------

export interface UseVideoUploadReturn {
  readonly uploadedFile: UploadedFile | null;
  readonly uploadStatus: UploadStatus;
  readonly uploadProgress: UploadProgress | null;
  readonly validationError: string | null;
  readonly selectFile: (file: File) => void;
  readonly clearFile: () => void;
  readonly validateFile: (file: File) => string | null;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useVideoUpload(): UseVideoUploadReturn {
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type as (typeof ACCEPTED_UPLOAD_MIME_TYPES)[number])) {
      return `Unsupported file type. Please upload one of: ${ACCEPTED_UPLOAD_MIME_TYPES.join(", ")}`;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return `File too large. Maximum size is ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB`;
    }

    return null;
  }, []);

  const selectFile = useCallback((file: File): void => {
    setValidationError(null);
    setUploadProgress(null);
    setUploadStatus("idle");

    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      setUploadedFile(null);
      return;
    }

    const fileId = generateFileId();
    const previewUrl = createPreviewUrl(file);

    setUploadedFile({
      id: fileId,
      file,
      previewUrl,
      status: "idle",
      progress: 0,
    });
  }, [validateFile]);

  const clearFile = useCallback((): void => {
    if (uploadedFile) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }
    setUploadedFile(null);
    setUploadStatus("idle");
    setUploadProgress(null);
    setValidationError(null);
  }, [uploadedFile]);

  useEffect(() => {
    return () => {
      if (uploadedFile) {
        URL.revokeObjectURL(uploadedFile.previewUrl);
      }
    };
  }, [uploadedFile]);

  return {
    uploadedFile,
    uploadStatus,
    uploadProgress,
    validationError,
    selectFile,
    clearFile,
    validateFile,
  };
}
