import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">

        <h1 className="text-7xl font-bold">
          404
        </h1>

        <p className="text-xl mt-4 text-gray-600">
          Page Not Found
        </p>

        <Link
          href="/dashboard"
          className="inline-block mt-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl"
        >
          Go to Dashboard
        </Link>

      </div>
    </main>
  );
}