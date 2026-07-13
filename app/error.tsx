"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white shadow-xl rounded-2xl p-10 max-w-lg text-center">

        <h1 className="text-3xl font-bold text-red-600">
          Something went wrong
        </h1>

        <p className="text-gray-500 mt-4">
          {error.message}
        </p>

        <button
          onClick={reset}
          className="mt-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl"
        >
          Try Again
        </button>

      </div>
    </main>
  );
}