// =============================================================================
// Video Studio UI — useVideoGeneration Hook
// =============================================================================

import { useState, useCallback } from "react";
import type { VideoGenerationForm } from "../types";
import { createJob } from "../services/api";
import { mapFormToCreateJobOptions } from "../services/mappers";
import type { VideoJob } from "@/app/lib/video";

// -----------------------------------------------------------------------------
// Hook Return Type
// -----------------------------------------------------------------------------

export interface UseVideoGenerationReturn {
  readonly form: VideoGenerationForm;
  readonly setForm: (form: VideoGenerationForm) => void;
  readonly isGenerating: boolean;
  readonly currentJob: VideoJob | null;
  readonly error: string | null;
  readonly generate: (form: VideoGenerationForm) => Promise<VideoJob>;
  readonly reset: () => void;
}

// -----------------------------------------------------------------------------
// Default Form State
// -----------------------------------------------------------------------------

const DEFAULT_FORM: VideoGenerationForm = {
  prompt: "",
  model: "default",
  aspectRatio: "16:9",
  durationSeconds: 5,
  includeAudio: true,
  advanced: {
    quality: "standard",
    seed: undefined,
    stylePreset: undefined,
    temperature: undefined,
  },
};

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useVideoGeneration(): UseVideoGenerationReturn {
  const [form, setFormState] = useState<VideoGenerationForm>(DEFAULT_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJob, setCurrentJob] = useState<VideoJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setForm = useCallback((newForm: VideoGenerationForm) => {
    setFormState(newForm);
  }, []);

  const generate = useCallback(async (formToGenerate: VideoGenerationForm): Promise<VideoJob> => {
    setIsGenerating(true);
    setError(null);

    try {
      const options = mapFormToCreateJobOptions(formToGenerate);
      const response = await createJob(options);

      setCurrentJob(response.job);
      return response.job;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred during video generation.";
      setError(message);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setFormState(DEFAULT_FORM);
    setCurrentJob(null);
    setError(null);
  }, []);

  return {
    form,
    setForm,
    isGenerating,
    currentJob,
    error,
    generate,
    reset,
  };
}
