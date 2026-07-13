"use client";

import { useState } from "react";

export default function VoicePage() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("en");
  const [voice, setVoice] = useState("female");
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState("");

  async function generateVoice() {
    if (!text.trim()) {
      alert("Enter text");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/voice", {
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

      if (!res.ok) {
        let message = "Voice generation failed";

        try {
          const err = await res.json();
          message = err.message || message;
        } catch {}

        alert(message);
        return;
      }

      const blob = await res.blob();

      const audioUrl = URL.createObjectURL(blob);

      setAudio(audioUrl);

    } catch (err) {
      console.error(err);
      alert("Voice generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">

      <h1 className="text-3xl font-bold mb-6">
        AI Voice Studio
      </h1>

      <div className="grid lg:grid-cols-2 gap-6">

        <div className="bg-white rounded-xl shadow p-6">

          <textarea
            className="w-full h-64 border rounded-lg p-4"
            placeholder="Enter your script..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4 mt-5">

            <select
              className="border rounded-lg p-3"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="bn">Bangla</option>
              <option value="hi">Hindi</option>
            </select>

            <select
              className="border rounded-lg p-3"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>

          </div>

          <div className="mt-5">

            <label>
              Speed ({speed})
            </label>

            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full"
            />

          </div>

          <div className="mt-5">

            <label>
              Pitch ({pitch})
            </label>

            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="w-full"
            />

          </div>

          <button
            onClick={generateVoice}
            disabled={loading}
            className="w-full mt-6 bg-blue-600 text-white rounded-lg py-3"
          >
            {loading ? "Generating..." : "Generate Voice"}
          </button>

        </div>

        <div className="bg-white rounded-xl shadow p-6">

          <h2 className="text-xl font-bold mb-4">
            Generated Voice
          </h2>

          {audio ? (
            <>
              <audio
                controls
                src={audio}
                className="w-full"
              />

              <a
                href={audio}
                download="voice.mp3"
                className="block mt-6"
              >
                <button className="w-full bg-green-600 text-white rounded-lg py-3">
                  Download MP3
                </button>
              </a>
            </>
          ) : (
            <div className="h-72 border-2 border-dashed rounded-xl flex items-center justify-center text-gray-400">
              No Voice Generated
            </div>
          )}

        </div>

      </div>

    </div>
  );
}