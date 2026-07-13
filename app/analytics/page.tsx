"use client";

export default function AnalyticsPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold">
          Analytics Dashboard
        </h1>

        <p className="text-gray-500 mt-2">
          Track your AI content performance.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-10">

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-gray-500">Total Images</h2>
            <p className="text-4xl font-bold mt-4">0</p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-gray-500">Scripts</h2>
            <p className="text-4xl font-bold mt-4">0</p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-gray-500">Videos</h2>
            <p className="text-4xl font-bold mt-4">0</p>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-gray-500">Voice</h2>
            <p className="text-4xl font-bold mt-4">0</p>
          </div>

        </div>

        <div className="bg-white rounded-2xl shadow p-8 mt-8">
          <h2 className="text-2xl font-bold">
            Activity
          </h2>

          <div className="mt-6 text-gray-500">
            No activity yet.
          </div>
        </div>

      </div>
    </main>
  );
}