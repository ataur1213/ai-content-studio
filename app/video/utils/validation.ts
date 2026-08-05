// =============================================================================
// Video Studio UI — Validation Utilities
// =============================================================================

import type { VideoGenerationForm, AspectRatio } from "../types";
import {
  ACCEPTED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  MIN_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_DURATION_SECONDS,
} from "../constants";

// -----------------------------------------------------------------------------
// Validation Result Type
// -----------------------------------------------------------------------------

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<ValidationError>;
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

// -----------------------------------------------------------------------------
// Valid Aspect Ratios
// -----------------------------------------------------------------------------

const VALID_ASPECT_RATIOS: ReadonlySet<AspectRatio> = new Set([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "21:9",
]);

// -----------------------------------------------------------------------------
// Validation Functions
// -----------------------------------------------------------------------------

export function validatePrompt(prompt: string): ValidationError | null {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return {
      field: "prompt",
      message: "Prompt is required",
    };
  }
  if (trimmed.length > 1000) {
    return {
      field: "prompt",
      message: "Prompt must be 1000 characters or less",
    };
  }
  return null;
}

export function validateDuration(duration: number): ValidationError | null {
  if (
    !Number.isFinite(duration) ||
    duration < MIN_VIDEO_DURATION_SECONDS ||
    duration > MAX_VIDEO_DURATION_SECONDS
  ) {
    return {
      field: "durationSeconds",
      message: `Duration must be between ${MIN_VIDEO_DURATION_SECONDS} and ${MAX_VIDEO_DURATION_SECONDS} seconds`,
    };
  }
  return null;
}

export function validateAspectRatio(
  aspectRatio: string
): ValidationError | null {
  if (!VALID_ASPECT_RATIOS.has(aspectRatio as AspectRatio)) {
    return {
      field: "aspectRatio",
      message: "Invalid aspect ratio",
    };
  }
  return null;
}

export function validateFile(file: File): ValidationError | null {
  if (!ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type as typeof ACCEPTED_UPLOAD_MIME_TYPES[number])) {
    return {
      field: "imageInput",
      message: `Unsupported file type. Accepted types: ${ACCEPTED_UPLOAD_MIME_TYPES.join(", ")}`,
    };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      field: "imageInput",
      message: `File too large. Max size: ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB`,
    };
  }
  return null;
}

export function validateForm(form: VideoGenerationForm): ValidationResult {
  const errors: ValidationError[] = [];

  const promptError = validatePrompt(form.prompt);
  if (promptError) errors.push(promptError);

  const durationError = validateDuration(form.durationSeconds);
  if (durationError) errors.push(durationError);

  const aspectRatioError = validateAspectRatio(form.aspectRatio);
  if (aspectRatioError) errors.push(aspectRatioError);

  if (form.imageInput) {
    const fileError = validateFile(form.imageInput.file);
    if (fileError) errors.push(fileError);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
