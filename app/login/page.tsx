"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// Change these to the shop's real name and wording
const SHOP_NAME = "Mitra Kayu";
const APP_TITLE = "Sistem Manajemen Pesanan & Produksi";
const APP_TAGLINE =
  "Kelola pesanan, stok kayu, pembayaran, dan produksi dalam satu tempat.";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
    else router.replace("/");
  }

  const input =
    "w-full rounded border border-gray-300 p-2 text-gray-900 focus:border-amber-700 focus:outline-none";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-amber-50 p-6">
      <div className="mb-6 flex flex-col items-center text-center">
        {/* Logo: tree rings. To use your own logo, see the note below. */}
        <svg viewBox="0 0 64 64" className="mb-3 h-20 w-20" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#92400e" />
          <circle cx="32" cy="32" r="22" fill="none" stroke="#fde68a" strokeWidth="3" />
          <circle cx="32" cy="32" r="14" fill="none" stroke="#fde68a" strokeWidth="3" />
          <circle cx="32" cy="32" r="6" fill="#fde68a" />
        </svg>
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-700">
          {SHOP_NAME}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-amber-900">{APP_TITLE}</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-700">{APP_TAGLINE}</p>
      </div>

      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded bg-white p-6 text-gray-900 shadow"
      >
        <h2 className="mb-4 text-lg font-bold text-amber-900">Masuk</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${input} mb-3`}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`${input} mb-3`}
          required
        />
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-amber-800 p-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <p className="mt-6 text-xs text-gray-500">
        Khusus pemilik dan staf. Hubungi pemilik jika belum punya akun.
      </p>
    </main>
  );
}