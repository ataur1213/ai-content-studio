"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !email || !password) {
      alert("Please fill all fields.");
      return;
    }

    setLoading(true);

    try {
      // Supabase Register পরে যোগ হবে
      alert("Register system coming next...");
    } catch (error) {
      console.error(error);
      alert("Registration failed.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

        <h1 className="text-3xl font-bold text-center">
          Create Account
        </h1>

        <p className="text-center text-gray-500 mt-2">
          Join AI Content Studio
        </p>

        <form onSubmit={handleRegister} className="mt-8 space-y-5">

          <div>
            <label className="font-medium">Full Name</label>
            <input
              type="text"
              className="w-full border rounded-xl p-3 mt-2"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

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
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>

        </form>

        <div className="text-center mt-6">
          <span className="text-gray-500">
            Already have an account?
          </span>

          <Link
            href="/login"
            className="text-blue-600 ml-2 font-semibold"
          >
            Login
          </Link>
        </div>

      </div>
    </main>
  );
}