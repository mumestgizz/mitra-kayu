"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

type Material = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
};

export default function Home() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      setEmail(session.user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      setRole(profile?.role ?? null);

      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("name");
      if (error) setError(error.message);
      else setMaterials(data ?? []);
      setReady(true);
    }
    init();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return <main className="p-6 text-gray-900">Memuat...</main>;
  }

  return (
    <main className="min-h-screen bg-amber-50 p-6 text-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">Stok Bahan Baku</h1>
        <div className="text-right text-sm">
          <p>{email} ({role})</p>
          <button onClick={logout} className="text-red-700 underline">
            Keluar
          </button>
        </div>
      </div>
      {error && <p className="text-red-600">Error: {error}</p>}
      <ul className="space-y-2">
        {materials.map((m) => (
          <li key={m.id} className="rounded bg-white p-3 shadow">
            <span className="font-semibold">{m.name}</span>: {m.current_stock}{" "}
            {m.unit}
            {m.current_stock < m.min_stock && (
              <span className="ml-2 font-bold text-red-600">Stok menipis!</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}