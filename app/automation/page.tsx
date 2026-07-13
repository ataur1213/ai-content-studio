"use client";

export default function AutomationPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-6xl mx-auto">

        <h1 className="text-4xl font-bold">
          AI Automation
        </h1>

        <p className="text-gray-500 mt-2">
          Automate your entire content workflow.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-10">

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold">📅 Scheduler</h2>
            <p className="text-gray-500 mt-3">
              Schedule content publishing.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold">📺 YouTube</h2>
            <p className="text-gray-500 mt-3">
              Auto upload YouTube videos.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold">📘 Facebook</h2>
            <p className="text-gray-500 mt-3">
              Publish Facebook posts automatically.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold">📸 Instagram</h2>
            <p className="text-gray-500 mt-3">
              Auto publish Instagram content.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold">🎵 TikTok</h2>
            <p className="text-gray-500 mt-3">
              Upload TikTok videos automatically.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold">🐦 X (Twitter)</h2>
            <p className="text-gray-500 mt-3">
              Schedule and publish posts.
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}