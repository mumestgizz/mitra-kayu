"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.replace("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-amber-50 p-6">
      <div className="w-full max-w-sm rounded bg-white p-6 shadow text-gray-900">
        <h1 className="text-xl font-bold text-amber-900 mb-4">Masuk</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 rounded border border-gray-300 p-2 text-gray-900"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-3 rounded border border-gray-300 p-2 text-gray-900"
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded bg-amber-800 p-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </div>
    </main>
  );
}