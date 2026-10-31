"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Link from "next/link";

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
  const [qty, setQty] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("m3");
  const [newMin, setNewMin] = useState("0");

  const loadMaterials = useCallback(async () => {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .order("name");
    if (error) setError(error.message);
    else setMaterials(data ?? []);
  }, []);

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

      await loadMaterials();
      setReady(true);
    }
    init();
  }, [router, loadMaterials]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function addMaterial() {
    setError(null);
    if (!newName.trim()) return;
    const { error } = await supabase.from("materials").insert({
      name: newName.trim(),
      unit: newUnit.trim() || "m3",
      min_stock: Number(newMin) || 0,
    });
    if (error) setError(error.message);
    else {
      setNewName("");
      setNewMin("0");
      await loadMaterials();
    }
  }

  async function moveStock(id: string, type: "in" | "out") {
    setError(null);
    const amount = Number(qty[id]);
    if (!amount || amount <= 0) {
      setError("Isi jumlah yang valid.");
      return;
    }
    const { error } = await supabase.rpc("record_stock_movement", {
      p_material: id,
      p_type: type,
      p_qty: amount,
      p_note: null,
    });
    if (error) setError(error.message);
    else {
      setQty({ ...qty, [id]: "" });
      await loadMaterials();
    }
  }

  async function removeMaterial(id: string, name: string) {
    if (!confirm(`Hapus ${name}? Riwayat stoknya juga ikut terhapus.`)) return;
    setError(null);
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) setError(error.message);
    else await loadMaterials();
  }

  if (!ready) {
    return <main className="p-6 text-gray-900">Memuat...</main>;
  }

  const isOwner = role === "owner";

  return (
    <main className="min-h-screen bg-amber-50 p-6 text-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">Stok Bahan Baku</h1>
        <div className="text-right text-sm">
          <p>
            {email} ({role})
          </p>
          <Link href="/production" className="mr-3 text-amber-800 underline">
  Antrean produksi
</Link>
{isOwner && (
  <>
    <Link href="/orders" className="mr-3 text-amber-800 underline">
      Pesanan
    </Link>
    <Link href="/products" className="mr-3 text-amber-800 underline">
      Produk
    </Link>
    <Link href="/expenses" className="mr-3 text-amber-800 underline">
      Pengeluaran
    </Link>
  </>
)}
<button onClick={logout} className="text-red-700 underline">
  Keluar
</button>
        </div>
      </div>

      {error && <p className="mb-3 text-red-600">Error: {error}</p>}

      {isOwner && (
        <div className="mb-4 flex flex-wrap gap-2 rounded bg-white p-3 shadow">
          <input
            placeholder="Nama bahan"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded border border-gray-300 p-2 text-gray-900"
          />
          <input
            placeholder="Satuan"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            className="w-24 rounded border border-gray-300 p-2 text-gray-900"
          />
          <input
            placeholder="Stok minimum"
            type="number"
            value={newMin}
            onChange={(e) => setNewMin(e.target.value)}
            className="w-32 rounded border border-gray-300 p-2 text-gray-900"
          />
          <button
            onClick={addMaterial}
            className="rounded bg-amber-800 px-4 py-2 font-semibold text-white"
          >
            Tambah
          </button>
        </div>
      )}

      <ul className="space-y-2">
        {materials.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-3 shadow"
          >
            <div>
              <span className="font-semibold">{m.name}</span>: {m.current_stock}{" "}
              {m.unit}
              <span className="ml-2 text-sm text-gray-500">
                (min {m.min_stock})
              </span>
              {m.current_stock < m.min_stock && (
                <span className="ml-2 font-bold text-red-600">
                  Stok menipis!
                </span>
              )}
            </div>
            {isOwner && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Jumlah"
                  value={qty[m.id] ?? ""}
                  onChange={(e) => setQty({ ...qty, [m.id]: e.target.value })}
                  className="w-24 rounded border border-gray-300 p-1 text-gray-900"
                />
                <button
                  onClick={() => moveStock(m.id, "in")}
                  className="rounded bg-green-700 px-3 py-1 text-white"
                >
                  Masuk
                </button>
                <button
                  onClick={() => moveStock(m.id, "out")}
                  className="rounded bg-orange-700 px-3 py-1 text-white"
                >
                  Keluar
                </button>
                <button
                  onClick={() => removeMaterial(m.id, m.name)}
                  className="rounded bg-red-700 px-3 py-1 text-white"
                >
                  Hapus
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}