const projects = [
  {
    name: "YouTube AI Shorts",
    type: "Video",
    status: "Completed",
  },
  {
    name: "Facebook Viral Post",
    type: "Image",
    status: "Processing",
  },
  {
    name: "TikTok Voiceover",
    type: "Voice",
    status: "Pending",
  },
  {
    name: "AI Script for Ads",
    type: "Script",
    status: "Completed",
  },
];

export default function RecentProjects() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-2xl font-bold mb-6">📁 Recent Projects</h2>

      <div className="space-y-4">
        {projects.map((project) => (
          <div
            key={project.name}
            className="flex items-center justify-between border rounded-xl p-4 hover:bg-gray-50 transition"
          >
            <div>
              <h3 className="font-semibold">{project.name}</h3>
              <p className="text-sm text-gray-500">{project.type}</p>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                project.status === "Completed"
                  ? "bg-green-100 text-green-700"
                  : project.status === "Processing"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {project.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}