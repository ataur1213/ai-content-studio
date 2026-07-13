"use client";

import { useEffect, useState } from "react";

interface HistoryItem {
  id: string;
  prompt: string;
  image: string;
  createdAt: string;
}

export default function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Realistic");
  const [ratio, setRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");

  async function loadHistory() {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();

      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function generateImage() {
    if (!prompt.trim()) {
      alert("Enter a prompt");
      return;
    }

    setLoading(true);

    try {
      const promptRes = await fetch("/api/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
        }),
      });

      const promptData = await promptRes.json();

      if (!promptData.success) {
        alert(promptData.message);
        setLoading(false);
        return;
      }

      setEnhancedPrompt(promptData.prompt);

      const imageRes = await fetch("/api/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `${promptData.prompt}, ${style}, aspect ratio ${ratio}`,
        }),
      });

      const imageData = await imageRes.json();

      if (imageData.success) {
        setImage(imageData.image);
        loadHistory();
      } else {
        alert(imageData.message);
      }
    } catch (err) {
      console.error(err);
      alert("Server Error");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="bg-white rounded-xl shadow-lg p-6">

          <h2 className="text-2xl font-bold mb-5">
            AI Image Generator
          </h2>

          <textarea
            className="w-full border rounded-lg p-3 h-40"
            placeholder="Describe your image..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="mt-5">
            <label className="font-semibold">
              Style
            </label>

            <select
              className="w-full border rounded-lg p-2 mt-2"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              <option>Realistic</option>
              <option>Cinematic</option>
              <option>Anime</option>
              <option>Fantasy</option>
              <option>3D Render</option>
              <option>Logo</option>
            </select>
          </div>

          <div className="mt-5">
            <label className="font-semibold">
              Aspect Ratio
            </label>

            <select
              className="w-full border rounded-lg p-2 mt-2"
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
            >
              <option>1:1</option>
              <option>16:9</option>
              <option>9:16</option>
              <option>4:5</option>
            </select>
          </div>

          <button
            onClick={generateImage}
            disabled={loading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
          >
            {loading ? "Generating..." : "Generate Image"}
          </button>

          {enhancedPrompt && (
            <div className="mt-6">
              <h3 className="font-bold mb-2">
                Enhanced Prompt
              </h3>

              <div className="border rounded-lg p-3 text-sm bg-gray-50">
                {enhancedPrompt}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 lg:col-span-2">

          <h2 className="text-2xl font-bold mb-5">
            Generated Image
          </h2>

          {image ? (
            <>
              <img
                src={image}
                alt="Generated"
                className="w-full rounded-xl"
              />

              <a
                href={image}
                download="ai-image.png"
                className="block mt-5"
              >
                <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg">
                  Download Image
                </button>
              </a>
            </>
          ) : (
            <div className="border-2 border-dashed rounded-xl h-[500px] flex items-center justify-center text-gray-400">
              No Image Generated
            </div>
          )}
        </div>

      </div>

      <div className="bg-white rounded-xl shadow-lg mt-8 p-6">

        <h2 className="text-2xl font-bold mb-5">
          Image History
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">

          {history.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg overflow-hidden cursor-pointer"
              onClick={() => {
                setImage(item.image);
                setPrompt(item.prompt);
              }}
            >
              <img
                src={item.image}
                alt=""
                className="w-full h-32 object-cover"
              />

              <div className="p-2 text-xs line-clamp-2">
                {item.prompt}
              </div>
            </div>
          ))}

        </div>

      </div>

    </div>
  );
}