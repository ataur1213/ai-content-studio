import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import {
  FileText,
  Image,
  Video,
  Mic,
  ArrowRight,
} from "lucide-react";

const tools = [
  {
    title: "AI Script Writer",
    description: "Generate YouTube, TikTok, Facebook and Blog scripts.",
    icon: FileText,
    color: "bg-blue-600",
  },
  {
    title: "AI Image Generator",
    description: "Create stunning AI images in seconds.",
    icon: Image,
    color: "bg-green-600",
  },
  {
    title: "AI Video Generator",
    description: "Generate AI videos automatically.",
    icon: Video,
    color: "bg-purple-600",
  },
  {
    title: "AI Voice Generator",
    description: "Create realistic AI voiceovers.",
    icon: Mic,
    color: "bg-orange-500",
  },
];

export default function AIStudioPage() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header />

        <main className="p-8">
          <h1 className="text-4xl font-bold">🤖 AI Studio</h1>

          <p className="text-gray-600 mt-2">
            Choose an AI tool to start creating content.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-10">
            {tools.map((tool) => {
              const Icon = tool.icon;

              return (
                <div
                  key={tool.title}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all"
                >
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tool.color}`}
                  >
                    <Icon className="text-white" size={28} />
                  </div>

                  <h2 className="text-xl font-bold mt-5">
                    {tool.title}
                  </h2>

                  <p className="text-gray-500 mt-3 text-sm">
                    {tool.description}
                  </p>

                  <button className="mt-6 flex items-center gap-2 text-blue-600 font-semibold hover:gap-3 transition-all">
                    Open Tool
                    <ArrowRight size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}