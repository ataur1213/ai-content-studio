"use client";

const docs = [
  {
    title: "AI Image Generator",
    description: "Generate high-quality AI images from text prompts.",
  },
  {
    title: "Prompt Enhancer",
    description: "Automatically improve prompts for better AI results.",
  },
  {
    title: "Script Writer",
    description: "Generate viral YouTube Shorts, TikTok and Facebook scripts.",
  },
  {
    title: "AI Video",
    description: "Create videos from scripts and images. (Coming Soon)",
  },
  {
    title: "AI Voice",
    description: "Generate realistic AI voiceovers. (Coming Soon)",
  },
  {
    title: "Automation",
    description: "Automatically publish content to social media.",
  },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-4xl font-bold">
          Documentation
        </h1>

        <p className="text-gray-500 mt-2">
          Learn how to use AI Content Studio.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mt-10">

          {docs.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl shadow p-6"
            >
              <h2 className="text-2xl font-bold">
                {item.title}
              </h2>

              <p className="text-gray-500 mt-3">
                {item.description}
              </p>
            </div>
          ))}

        </div>

      </div>
    </main>
  );
}