"use client";

import Link from "next/link";

const cards = [
  {
    title: "AI Chat",
    description: "Chat with multiple AI models",
    href: "/chat",
    icon: "💬",
  },
  {
    title: "Image Studio",
    description: "Generate AI Images",
    href: "/image",
    icon: "🖼️",
  },
  {
    title: "Script Writer",
    description: "Create viral scripts",
    href: "/script",
    icon: "📝",
  },
  {
    title: "Voice Studio",
    description: "AI Voice Generator",
    href: "/voice",
    icon: "🎤",
  },
  {
    title: "Video Studio",
    description: "Create AI Videos",
    href: "/video",
    icon: "🎬",
  },
  {
    title: "Automation",
    description: "Auto Publish Content",
    href: "/automation",
    icon: "🤖",
  },
  {
    title: "Analytics",
    description: "Content Analytics",
    href: "/analytics",
    icon: "📊",
  },
  {
    title: "Settings",
    description: "API & Preferences",
    href: "/settings",
    icon: "⚙️",
  },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold">
          AI Content Studio
        </h1>

        <p className="text-gray-600 mt-2">
          One Click AI Automation Platform
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-10">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="bg-white rounded-2xl shadow hover:shadow-xl transition p-6"
            >
              <div className="text-5xl">
                {card.icon}
              </div>

              <h2 className="text-xl font-bold mt-5">
                {card.title}
              </h2>

              <p className="text-gray-500 mt-2">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}