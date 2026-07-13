
"use client";

import { useState } from "react";

export default function VoicePage() {

  const [text, setText] = useState("");

  const [language, setLanguage] = useState("en");

  const [voice, setVoice] = useState("female");

  const [speed, setSpeed] = useState(1);

  const [pitch, setPitch] = useState(1);

  const [loading, setLoading] = useState(false);

  const [audioUrl, setAudioUrl] = useState("");

  async function generateVoice() {

    if (!text.trim()) {

      alert("Please enter text.");

      return;

    }

    try {

      setLoading(true);

      const response = await fetch("/api/voice", {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          text,

          language,

          voice,

          speed,

          pitch,

        }),

      });

      if (!response.ok) {

        throw new Error("Voice generation failed");

      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      setAudioUrl(url);

    } catch (error) {

      console.error(error);

      alert("Voice generation failed.");

    } finally {

      setLoading(false);

    }

  }

  return (

    <main className="min-h-screen bg-slate-100 p-8">

      <div className="max-w-5xl mx-auto">

        <h1 className="text-4xl font-bold">

          AI Voice Studio

        </h1>

        <p className="text-gray-500 mt-2">

          Generate realistic AI voices.

        </p>

        <div className="bg-white rounded-2xl shadow mt-8 p-6">

          <label className="font-semibold">

            Text

          </label>

          <textarea

            value={text}

            onChange={(e) => setText(e.target.value)}

            className="w-full mt-2 border rounded-xl p-4 h-40"

            placeholder="Enter your script..."

          />

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>

              <label className="font-semibold">
                Language
              </label>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full mt-2 border rounded-xl p-3"
              >
                <option value="en">English</option>
                <option value="bn">Bangla</option>
                <option value="hi">Hindi</option>
              </select>

            </div>

            <div>

              <label className="font-semibold">
                Voice
              </label>

              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full mt-2 border rounded-xl p-3"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>

            </div>

            <div>

              <label className="font-semibold">
                Speed
              </label>

              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speed}
                onChange={(e) =>
                  setSpeed(Number(e.target.value))
                }
                className="w-full mt-2"
              />

              <p className="text-sm text-gray-500 mt-1">
                {speed}x
              </p>

            </div>

            <div>

              <label className="font-semibold">
                Pitch
              </label>

              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={pitch}
                onChange={(e) =>
                  setPitch(Number(e.target.value))
                }
                className="w-full mt-2"
              />

              <p className="text-sm text-gray-500 mt-1">
                {pitch}x
              </p>

            </div>

          </div>

          <button
            onClick={generateVoice}
            disabled={loading}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-4 rounded-xl font-bold transition"
          >
            {loading
              ? "Generating Voice..."
              : "Generate Voice"}
          </button>

        </div>

        {audioUrl && (
          <div className="bg-white rounded-2xl shadow mt-8 p-6">
            <h2 className="text-2xl font-bold mb-4">
              Generated Voice
            </h2>

            <audio
              controls
              className="w-full"
              src={audioUrl}
            />

            <div className="mt-6 flex flex-wrap gap-4">

              <a
                href={audioUrl}
                download="ai-voice.mp3"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold"
              >
                Download MP3
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  alert("Text copied.");
                }}
                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold"
              >
                Copy Script
              </button>

              <button
                onClick={() => {
                  setAudioUrl("");
                }}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold"
              >
                Clear
              </button>

            </div>

          </div>
        )}

      </div>

    </main>

  );

}
