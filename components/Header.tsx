"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-8">

      <div>
        <h2 className="text-2xl font-bold">
          AI Content Studio
        </h2>
      </div>

      <div className="flex items-center gap-4">

        <Link
          href="/pricing"
          className="bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700"
        >
          Upgrade
        </Link>

        <Link
          href="/profile"
          className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold"
        >
          A
        </Link>

      </div>

    </header>
  );
}