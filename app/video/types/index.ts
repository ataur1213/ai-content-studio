// =============================================================================
// Video Studio UI — Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Import Shared Types (Reuse backend types where appropriate)
// -----------------------------------------------------------------------------
import type {
  JobState,
  VideoJob,
} from "@/app/lib/video/types";

// -----------------------------------------------------------------------------
// Form & Generation Types
// -----------------------------------------------------------------------------

export interface VideoGenerationForm {
  readonly prompt: string;
  readonly model: ModelOption["id"];
  readonly aspectRatio: AspectRatio;
  readonly negativePrompt?: string;
  readonly imageInput?: UploadedFile;
  readonly durationSeconds: number;
  readonly includeAudio: boolean;
  readonly advanced: AdvancedOptions;
}

export interface AdvancedOptions {
  readonly seed?: number;
  readonly quality: "standard" | "high" | "ultra";
  readonly stylePreset?: string;
  readonly temperature?: number;
}

// -----------------------------------------------------------------------------
// Model & Aspect Ratio
// -----------------------------------------------------------------------------

export interface ModelOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly isFree: boolean;
  readonly maxDurationSeconds: number;
}

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "21:9";

// -----------------------------------------------------------------------------
// Upload & File Types
// -----------------------------------------------------------------------------

export type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface UploadedFile {
  readonly id: string;
  readonly file: File;
  readonly previewUrl: string;
  readonly status: UploadStatus;
  readonly progress: number;
  readonly error?: string;
}

export interface UploadProgress {
  readonly percentage: number;
  readonly bytesUploaded: number;
  readonly totalBytes: number;
  readonly speedBytesPerSecond: number;
  readonly estimatedTimeRemainingSeconds: number;
}

// -----------------------------------------------------------------------------
// Preview Types
// -----------------------------------------------------------------------------

export interface VideoPreview {
  readonly url: string;
  readonly thumbnailUrl: string;
  readonly durationSeconds: number;
  readonly width: number;
  readonly height: number;
}

export interface ThumbnailPreview {
  readonly url: string;
  readonly timestampSeconds: number;
  readonly index: number;
}

// -----------------------------------------------------------------------------
// History Types
// -----------------------------------------------------------------------------

export interface HistoryItem {
  readonly id: string;
  readonly jobId: string;
  readonly title: string;
  readonly thumbnailUrl?: string;
  readonly status: JobState;
  readonly createdAt: Date;
  readonly durationSeconds?: number;
  readonly aspectRatio: AspectRatio;
}

// -----------------------------------------------------------------------------
// Component Prop Types
// -----------------------------------------------------------------------------

export interface UploadZoneProps {
  readonly onFileSelect: (file: File) => void;
  readonly accept: readonly string[];
  readonly maxSizeBytes: number;
  readonly disabled?: boolean;
}

export interface UploadPreviewProps {
  readonly file: UploadedFile;
  readonly onRemove: () => void;
}

export interface UploadProgressProps {
  readonly progress: UploadProgress;
}

export interface JobCardProps {
  readonly job: VideoJob;
}

export interface JobProgressProps {
  readonly progress: number;
  readonly status: JobState;
}

export interface JobStatusProps {
  readonly status: JobState;
  readonly className?: string;
}

export interface VideoPreviewProps {
  readonly preview?: VideoPreview;
  readonly className?: string;
}

export interface PromptFormProps {
  readonly form: VideoGenerationForm;
  readonly onChange: (form: VideoGenerationForm) => void;
  readonly onSubmit: () => void;
  readonly isSubmitting: boolean;
  readonly isValid: boolean;
}

export interface ModelSelectorProps {
  readonly selectedModelId: ModelOption["id"];
  readonly models: readonly ModelOption[];
  readonly onChange: (modelId: ModelOption["id"]) => void;
}

export interface AspectRatioSelectorProps {
  readonly selectedRatio: AspectRatio;
  readonly onChange: (ratio: AspectRatio) => void;
}

export interface ImageInputProps {
  readonly image: UploadedFile | undefined;
  readonly onImageSelect: (file: File) => void;
  readonly onImageRemove: () => void;
}

export interface AdvancedOptionsProps {
  readonly options: AdvancedOptions;
  readonly onChange: (options: AdvancedOptions) => void;
}

export interface SubmitButtonProps {
  readonly isSubmitting: boolean;
  readonly disabled: boolean;
}

export interface HistoryListProps {
  readonly history: readonly HistoryItem[];
  readonly onSelect: (item: HistoryItem) => void;
  readonly selectedId?: string;
}

export interface HistoryItemProps {
  readonly item: HistoryItem;
  readonly isSelected: boolean;
  readonly onSelect: (item: HistoryItem) => void;
}
