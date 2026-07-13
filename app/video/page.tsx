
"use client";

import { useState } from "react";

interface VideoResponse {
  success: boolean;
  provider?: string;
  video?: string;
  message?: string;
}

const MODELS = [
  {
    id: "fal-ai/kling-video/v2/master/image-to-video",
    name: "Kling V2 Image To Video",
  },
  {
    id: "fal-ai/kling-video/o3/pro/video-to-video/edit",
    name: "Kling O3 Video Edit",
  },
];

const ASPECT_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
];

export default function VideoPage() {

  const [prompt, setPrompt] =
    useState("");

  const [imageUrl, setImageUrl] =
    useState("");

  const [
    negativePrompt,
    setNegativePrompt,
  ] = useState("");

  const [model, setModel] =
    useState(
      "fal-ai/kling-video/v2/master/image-to-video"
    );

  const [
    aspectRatio,
    setAspectRatio,
  ] = useState("16:9");

  const [duration, setDuration] =
    useState<5 | 10>(5);

  const [loading, setLoading] =
    useState(false);

  const [videoUrl, setVideoUrl] =
    useState("");

  const [provider, setProvider] =
    useState("");

  const [error, setError] =
    useState("");

  async function handleGenerate() {

    if (!prompt.trim()) {

      setError(
        "Please enter a prompt."
      );

      return;

    }

    try {

      setLoading(true);

      setError("");

      setVideoUrl("");

      setProvider("");

      const response = await fetch(
        "/api/video",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            prompt,
            imageUrl,
            model,
            aspectRatio,
            duration,
            negativePrompt,
          }),
        }
      );

      const data: VideoResponse =
        await response.json();

      if (!response.ok) {

        throw new Error(
          data.message ||
            "Video generation failed."
        );

      }

      setVideoUrl(
        data.video || ""
      );

      setProvider(
        data.provider || ""
      );

    } catch (err: any) {

      setError(
        err.message ||
          "Something went wrong."
      );

    } finally {

      setLoading(false);

    }

  }

  return (

    <main className="min-h-screen bg-slate-100 py-10 px-6">

      <div className="max-w-7xl mx-auto">

        <div className="mb-8">

          <h1 className="text-4xl font-bold">
            🎬 AI Video Studio
          </h1>

          <p className="text-gray-500 mt-2">
            Generate AI videos using
            FAL AI Kling Models.
          </p>

        </div>
        <div className="grid lg:grid-cols-2 gap-8">

          <div className="bg-white rounded-2xl shadow-lg p-6">

            <h2 className="text-2xl font-bold mb-6">
              Video Generator
            </h2>

            <div className="space-y-5">

              <div>

                <label className="block text-sm font-semibold mb-2">
                  Prompt
                </label>

                <textarea
                  value={prompt}
                  onChange={(e) =>
                    setPrompt(e.target.value)
                  }
                  rows={6}
                  placeholder="Describe the video you want..."
                  className="w-full rounded-xl border border-gray-300 p-4 outline-none focus:ring-2 focus:ring-blue-500"
                />

              </div>

              <div>

                <label className="block text-sm font-semibold mb-2">
                  Image URL
                </label>

                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) =>
                    setImageUrl(e.target.value)
                  }
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-xl border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />

              </div>

              <div>

                <label className="block text-sm font-semibold mb-2">
                  Negative Prompt
                </label>

                <textarea
                  value={negativePrompt}
                  onChange={(e) =>
                    setNegativePrompt(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Low quality, blurry..."
                  className="w-full rounded-xl border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />

              </div>

              <div>

                <label className="block text-sm font-semibold mb-2">
                  Model
                </label>

                <select
                  value={model}
                  onChange={(e) =>
                    setModel(e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-300 p-3"
                >
                  {MODELS.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>
                  ))}
                </select>

              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>

                  <label className="block text-sm font-semibold mb-2">
                    Aspect Ratio
                  </label>

                  <select
                    value={aspectRatio}
                    onChange={(e) =>
                      setAspectRatio(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 p-3"
                  >
                    {ASPECT_RATIOS.map(
                      (ratio) => (
                        <option
                          key={ratio}
                          value={ratio}
                        >
                          {ratio}
                        </option>
                      )
                    )}
                  </select>

                </div>

                <div>

                  <label className="block text-sm font-semibold mb-2">
                    Duration
                  </label>

                  <select
                    value={duration}
                    onChange={(e) =>
                      setDuration(
                        Number(
                          e.target.value
                        ) as 5 | 10
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 p-3"
                  >
                    <option value={5}>
                      5 Seconds
                    </option>

                    <option value={10}>
                      10 Seconds
                    </option>

                  </select>

                </div>

              </div>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full mt-6 rounded-xl bg-blue-600 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loading
                  ? "Generating Video..."
                  : "🎬 Generate Video"}
              </button>

              {error && (
                <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-red-600">
                  {error}
                </div>
              )}

            </div>

          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">

            <h2 className="text-2xl font-bold mb-6">
              Video Preview
            </h2>

            {loading ? (

              <div className="h-[420px] flex flex-col items-center justify-center">

                <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>

                <p className="mt-6 text-gray-500">
                  AI is generating your video...
                </p>

              </div>

            ) : videoUrl ? (

              <div className="space-y-6">

                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-xl border"
                />

                <div className="rounded-xl bg-slate-100 p-4">

                  <p className="text-sm text-gray-500">
                    Provider
                  </p>

                  <p className="font-semibold mt-1">
                    {provider}
                  </p>

                </div>

                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-xl bg-green-600 py-4 text-center font-bold text-white transition hover:bg-green-700"
                >
                  ⬇ Download Video
                </a>

              </div>

            ) : (

              <div className="h-[420px] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center">

                <div className="text-7xl">
                  🎬
                </div>

                <h3 className="mt-6 text-2xl font-bold">
                  No Video Generated
                </h3>

                <p className="mt-3 max-w-sm text-center text-gray-500">
                  Enter a prompt, choose your
                  settings and click
                  <strong> Generate Video</strong>.
                </p>

              </div>

            )}
          </div>

        </div>

        <div className="mt-10 rounded-2xl bg-white p-6 shadow-lg">

          <h2 className="text-xl font-bold">
            💡 Tips
          </h2>

          <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-600">

            <li>
              Use detailed prompts for better
              video quality.
            </li>

            <li>
              Adding an Image URL produces more
              consistent results.
            </li>

            <li>
              Use Negative Prompt to remove
              unwanted objects or styles.
            </li>

            <li>
              5 Seconds is faster, while
              10 Seconds produces longer videos.
            </li>

            <li>
              Kling V2 works best for
              Image-to-Video generation.
            </li>

          </ul>

        </div>

      </div>

    </main>

  );

}