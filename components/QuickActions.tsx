import { Video, Image, Mic, FileText } from "lucide-react";

const actions = [
  {
    title: "AI Video",
    description: "Create professional AI videos",
    icon: Video,
    color: "bg-blue-600",
  },
  {
    title: "AI Image",
    description: "Generate stunning AI images",
    icon: Image,
    color: "bg-green-600",
  },
  {
    title: "AI Voice",
    description: "Generate realistic voiceovers",
    icon: Mic,
    color: "bg-purple-600",
  },
  {
    title: "AI Script",
    description: "Write scripts in seconds",
    icon: FileText,
    color: "bg-orange-500",
  },
];

export default function QuickActions() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-6">⚡ Quick Actions</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {actions.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.title}
              className="border border-gray-200 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-1 transition-all text-left"
            >
              <div
                className={`w-14 h-14 rounded-xl ${item.color} flex items-center justify-center mb-4`}
              >
                <Icon className="text-white" size={28} />
              </div>

              <h3 className="font-bold text-lg">{item.title}</h3>

              <p className="text-gray-500 text-sm mt-2">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}