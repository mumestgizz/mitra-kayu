"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Material = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
};

export default function Home() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("materials")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setMaterials(data ?? []);
      });
  }, []);

  return (
    <main className="min-h-screen bg-amber-50 p-6">
      <h1 className="text-2xl font-bold text-amber-900 mb-4">
        Stok Bahan Baku
      </h1>
      {error && <p className="text-red-600">Error: {error}</p>}
      <ul className="space-y-2">
        {materials.map((m) => (
          <li key={m.id} className="rounded bg-white p-3 shadow">
            <span className="font-semibold">{m.name}</span>: {m.current_stock}{" "}
            {m.unit}
            {m.current_stock < m.min_stock && (
              <span className="ml-2 text-red-600 font-bold">Stok menipis!</span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}