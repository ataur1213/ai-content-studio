"use client";

import { useState } from "react";

export default function ScriptPage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState("");

  async function generateScript() {
    if (!topic.trim()) {
      alert("Enter a topic");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setScript(data.script);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Server Error");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-5xl mx-auto">

        <h1 className="text-4xl font-bold">
          AI Script Writer
        </h1>

        <p className="text-gray-500 mt-2">
          Create viral YouTube Shorts, TikTok & Facebook scripts.
        </p>

        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Example: Elon Musk AI Robot"
          className="w-full h-40 border rounded-xl p-4 mt-8"
        />

        <button
          onClick={generateScript}
          disabled={loading}
          className="mt-5 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl"
        >
          {loading ? "Generating..." : "Generate Script"}
        </button>

        {script && (
          <div className="bg-white rounded-xl shadow p-6 mt-8">
            <h2 className="text-2xl font-bold mb-4">
              Generated Script
            </h2>

            <pre className="whitespace-pre-wrap text-gray-700">
              {script}
            </pre>
          </div>
        )}

      </div>
    </main>
  );
}