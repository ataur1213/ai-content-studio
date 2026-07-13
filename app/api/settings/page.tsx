"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [providers] = useState([
    {
      name: "OpenRouter",
      env: "OPENROUTER_API_KEY",
      status: "Connected",
    },
    {
      name: "Hugging Face",
      env: "HUGGINGFACE_API_KEY",
      status: "Connected",
    },
    {
      name: "Gemini",
      env: "GEMINI_API_KEY",
      status: "Not Configured",
    },
    {
      name: "Groq",
      env: "GROQ_API_KEY",
      status: "Not Configured",
    },
    {
      name: "Together AI",
      env: "TOGETHER_API_KEY",
      status: "Not Configured",
    },
  ]);

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-5xl mx-auto">

        <h1 className="text-4xl font-bold">
          AI Provider Settings
        </h1>

        <p className="text-gray-500 mt-2">
          Configure all AI providers in one place.
        </p>

        <div className="mt-8 space-y-4">

          {providers.map((provider) => (
            <div
              key={provider.name}
              className="bg-white rounded-xl shadow p-5 flex justify-between items-center"
            >
              <div>
                <h2 className="text-xl font-bold">
                  {provider.name}
                </h2>

                <p className="text-gray-500">
                  {provider.env}
                </p>
              </div>

              <span
                className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  provider.status === "Connected"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {provider.status}
              </span>
            </div>
          ))}

        </div>

      </div>
    </main>
  );
}