"use client";

import Link from "next/link";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-4xl mx-auto">

        <div className="bg-white rounded-2xl shadow-xl p-8">

          <div className="flex items-center gap-6">

            <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-4xl font-bold">
              A
            </div>

            <div>
              <h1 className="text-3xl font-bold">
                Guest User
              </h1>

              <p className="text-gray-500 mt-2">
                guest@example.com
              </p>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

            <div className="bg-slate-100 rounded-xl p-6">
              <h2 className="text-gray-500">
                Images
              </h2>

              <p className="text-3xl font-bold mt-3">
                0
              </p>
            </div>

            <div className="bg-slate-100 rounded-xl p-6">
              <h2 className="text-gray-500">
                Scripts
              </h2>

              <p className="text-3xl font-bold mt-3">
                0
              </p>
            </div>

            <div className="bg-slate-100 rounded-xl p-6">
              <h2 className="text-gray-500">
                Videos
              </h2>

              <p className="text-3xl font-bold mt-3">
                0
              </p>
            </div>

          </div>

          <div className="mt-10 flex gap-4">

            <Link
              href="/settings"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl"
            >
              Settings
            </Link>

            <button
              className="bg-red-600 text-white px-6 py-3 rounded-xl"
            >
              Logout
            </button>

          </div>

        </div>

      </div>
    </main>
  );
}