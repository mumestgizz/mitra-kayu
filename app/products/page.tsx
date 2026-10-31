"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const CATEGORIES = [
  "Kursi",
  "Meja",
  "Tempat tidur",
  "Container warung",
  "Kitchen set",
  "Gerobak",
  "Bufet",
  "Pintu",
  "Lainnya",
];

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Products() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, price, active")
      .order("category")
      .order("name");
    if (error) setError(error.message);
    else setProducts(data ?? []);
  }, []);

  // Only the owner may be here
  useEffect(() => {
    async function guard() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile?.role !== "owner") {
        router.replace("/");
        return;
      }
      await load();
      setReady(true);
    }
    guard();
  }, [router, load]);

  async function addProduct() {
    setError(null);
    const value = Number(price);
    if (!name.trim()) {
      setError("Isi nama produk.");
      return;
    }
    if (price === "" || isNaN(value) || value < 0) {
      setError("Isi harga yang valid.");
      return;
    }
    const { error } = await supabase
      .from("products")
      .insert({ name: name.trim(), category, price: value });
    if (error) setError(error.message);
    else {
      setName("");
      setPrice("");
      await load();
    }
  }

  async function updatePrice(id: string) {
    setError(null);
    const value = Number(edits[id]);
    if (edits[id] === undefined || edits[id] === "" || isNaN(value) || value < 0) {
      setError("Isi harga baru yang valid.");
      return;
    }
    const { error } = await supabase
      .from("products")
      .update({ price: value })
      .eq("id", id);
    if (error) setError(error.message);
    else {
      setEdits({ ...edits, [id]: "" });
      await load();
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setError(null);
    const { error } = await supabase
      .from("products")
      .update({ active: !active })
      .eq("id", id);
    if (error) setError(error.message);
    else await load();
  }

  if (!ready) {
    return <main className="p-6 text-gray-900">Memuat...</main>;
  }

  return (
    <main className="min-h-screen bg-amber-50 p-6 text-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">Katalog Produk</h1>
        <Link href="/" className="text-amber-800 underline">
          Kembali ke stok
        </Link>
      </div>

      {error && <p className="mb-3 text-red-600">Error: {error}</p>}

      <div className="mb-4 flex flex-wrap gap-2 rounded bg-white p-3 shadow">
        <input
          placeholder="Nama produk"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-48 flex-1 rounded border border-gray-300 p-2 text-gray-900"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-gray-300 p-2 text-gray-900"
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Harga (Rp)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-40 rounded border border-gray-300 p-2 text-gray-900"
        />
        <button
          onClick={addProduct}
          className="rounded bg-amber-800 px-4 py-2 font-semibold text-white"
        >
          Tambah
        </button>
      </div>

      <ul className="space-y-2">
        {products.length === 0 && (
          <li className="text-gray-600">Belum ada produk.</li>
        )}
        {products.map((p) => (
          <li
            key={p.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded bg-white p-3 shadow ${
              p.active ? "" : "opacity-60"
            }`}
          >
            <div>
              <span className="text-sm text-gray-500">{p.category}</span>{" "}
              <span className="font-semibold">{p.name}</span>:{" "}
              {rupiah(Number(p.price))}
              {!p.active && (
                <span className="ml-2 text-sm text-gray-500">(nonaktif)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Harga baru"
                value={edits[p.id] ?? ""}
                onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })}
                className="w-32 rounded border border-gray-300 p-1 text-gray-900"
              />
              <button
                onClick={() => updatePrice(p.id)}
                className="rounded bg-amber-800 px-3 py-1 text-white"
              >
                Ubah harga
              </button>
              <button
                onClick={() => toggleActive(p.id, p.active)}
                className="rounded bg-gray-700 px-3 py-1 text-white"
              >
                {p.active ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}