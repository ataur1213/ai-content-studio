"use client";

// =============================================================================
// Video Studio UI — Video Form Component
// =============================================================================

import { useCallback } from "react";
import { useVideoGeneration } from "../hooks/useVideoGeneration";
import { useVideoUpload } from "../hooks/useVideoUpload";
import { useVideoPolling } from "../hooks/useVideoPolling";
import { validateForm } from "../utils/validation";
import type { ModelOption, AspectRatio } from "../types";
import { ACCEPTED_UPLOAD_MIME_TYPES, MIN_VIDEO_DURATION_SECONDS, MAX_VIDEO_DURATION_SECONDS } from "../constants";

// -----------------------------------------------------------------------------
// Mock Data
// -----------------------------------------------------------------------------

const MODEL_OPTIONS: readonly ModelOption[] = [
  { id: "default", name: "Default Model", description: "Balanced quality and speed", isFree: true, maxDurationSeconds: 60 },
  { id: "high-quality", name: "High Quality", description: "Best quality, slower speed", isFree: false, maxDurationSeconds: 120 },
];

const ASPECT_RATIOS: readonly AspectRatio[] = ["16:9", "9:16", "1:1", "4:3", "21:9"];

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function VideoForm() {
  const { form, setForm, isGenerating, generate, error } = useVideoGeneration();
  const { uploadedFile, selectFile, clearFile, validationError: uploadValidationError } = useVideoUpload();
  const { startPolling } = useVideoPolling();

  const validation = validateForm({
    ...form,
    imageInput: uploadedFile || undefined,
  });

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm({ ...form, prompt: e.target.value });
  }, [form, setForm]);

  const handleModelChange = useCallback((modelId: string) => {
    setForm({ ...form, model: modelId });
  }, [form, setForm]);

  const handleAspectRatioChange = useCallback((ratio: AspectRatio) => {
    setForm({ ...form, aspectRatio: ratio });
  }, [form, setForm]);

  const handleDurationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, durationSeconds: Number(e.target.value) });
  }, [form, setForm]);

  const handleIncludeAudioChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, includeAudio: e.target.checked });
  }, [form, setForm]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
  }, [selectFile]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) return;
    const job = await generate({
      ...form,
      imageInput: uploadedFile || undefined,
    });
    startPolling(job.id as unknown as string);
  }, [form, generate, uploadedFile, validation.isValid, startPolling]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Prompt */}
      <div>
        <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
          Prompt
        </label>
        <textarea
          id="prompt"
          value={form.prompt}
          onChange={handlePromptChange}
          placeholder="Describe the video you want to generate..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={4}
          disabled={isGenerating}
        />
        {validation.errors.find((e) => e.field === "prompt") && (
          <p className="text-red-500 text-sm mt-1">
            {validation.errors.find((e) => e.field === "prompt")?.message}
          </p>
        )}
      </div>

      {/* Model Selector */}
      <div>
        <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <select
          id="model"
          value={form.model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isGenerating}
        >
          {MODEL_OPTIONS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {/* Aspect Ratio */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Aspect Ratio
        </label>
        <div className="grid grid-cols-5 gap-2">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => handleAspectRatioChange(ratio)}
              className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                form.aspectRatio === ratio
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
              disabled={isGenerating}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
          Duration (seconds)
        </label>
        <input
          id="duration"
          type="number"
          min={MIN_VIDEO_DURATION_SECONDS}
          max={MAX_VIDEO_DURATION_SECONDS}
          value={form.durationSeconds}
          onChange={handleDurationChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isGenerating}
        />
        {validation.errors.find((e) => e.field === "durationSeconds") && (
          <p className="text-red-500 text-sm mt-1">
            {validation.errors.find((e) => e.field === "durationSeconds")?.message}
          </p>
        )}
      </div>

      {/* Image Upload */}
      <div>
        <label htmlFor="image-upload" className="block text-sm font-medium text-gray-700 mb-1">
          Image Input (Optional)
        </label>
        {uploadedFile ? (
          <div className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg">
            <img
              src={uploadedFile.previewUrl}
              alt="Uploaded preview"
              className="w-16 h-16 object-cover rounded"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">{uploadedFile.file.name}</p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="text-red-500 hover:text-red-700"
              disabled={isGenerating}
            >
              Remove
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
            </div>
            <input
              id="image-upload"
              type="file"
              className="hidden"
              accept={ACCEPTED_UPLOAD_MIME_TYPES.join(",")}
              onChange={handleFileSelect}
              disabled={isGenerating}
            />
          </label>
        )}
        {uploadValidationError && (
          <p className="text-red-500 text-sm mt-1">{uploadValidationError}</p>
        )}
        {validation.errors.find((e) => e.field === "imageInput") && (
          <p className="text-red-500 text-sm mt-1">
            {validation.errors.find((e) => e.field === "imageInput")?.message}
          </p>
        )}
      </div>

      {/* Include Audio */}
      <div className="flex items-center gap-2">
        <input
          id="include-audio"
          type="checkbox"
          checked={form.includeAudio}
          onChange={handleIncludeAudioChange}
          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
          disabled={isGenerating}
        />
        <label htmlFor="include-audio" className="text-sm font-medium text-gray-700">
          Include Audio
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Generate Button */}
      <button
        type="submit"
        disabled={isGenerating || !validation.isValid}
        className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? "Generating..." : "Generate Video"}
      </button>
    </form>
  );
}
