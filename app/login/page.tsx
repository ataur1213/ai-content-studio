"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    setLoading(true);

    try {
      // Supabase Login এখানে পরে যোগ হবে
      alert("Login system coming next...");
    } catch (error: unknown) {
      console.error(error);
      alert("Login failed.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center">
          Welcome Back
        </h1>

        <p className="text-center text-gray-500 mt-2">
          Login to AI Content Studio
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-5">

          <div>
            <label className="font-medium">Email</label>

            <input
              type="email"
              className="w-full border rounded-xl p-3 mt-2"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="font-medium">Password</label>

            <input
              type="password"
              className="w-full border rounded-xl p-3 mt-2"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3"
          >
            {loading ? "Signing In..." : "Login"}
          </button>

        </form>

        <div className="text-center mt-6">
          <span className="text-gray-500">
            Don&apos;t have an account?
          </span>

          <Link
            href="/register"
            className="text-blue-600 ml-2 font-semibold"
          >
            Register
          </Link>
        </div>

      </div>
    </main>
  );
}