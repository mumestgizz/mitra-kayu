"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type QItem = {
  description: string;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  material: string | null;
  finish: string | null;
  quantity: number;
};

type QOrder = {
  id: string;
  order_number: number;
  order_type: string;
  customer_name: string;
  notes: string | null;
  status: string;
  items: QItem[];
};

const STEPS: Record<string, { next: string; button: string; label: string }> = {
  queue: { next: "cutting", button: "Mulai potong", label: "Antrean" },
  cutting: {
    next: "assembly",
    button: "Selesai potong, mulai rakit",
    label: "Pemotongan",
  },
  assembly: { next: "done", button: "Selesai dirakit", label: "Perakitan" },
};

const NEXT_LABEL: Record<string, string> = {
  cutting: "Pemotongan",
  assembly: "Perakitan",
  done: "Selesai",
};

const BADGE: Record<string, string> = {
  queue: "bg-gray-200",
  cutting: "bg-orange-200",
  assembly: "bg-blue-200",
};

export default function Production() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<QOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_production_queue");
    if (error) setError(error.message);
    else setOrders((data ?? []) as QOrder[]);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/login");
        return;
      }
      await load();
      setReady(true);
    }
    init();
  }, [router, load]);

  async function advance(o: QOrder) {
    const step = STEPS[o.status];
    if (!step) return;
    const num = String(o.order_number).padStart(4, "0");
    if (
      !confirm(
        `Pesanan #${num} (${o.customer_name}): ubah ke "${NEXT_LABEL[step.next]}"?\nHanya owner yang bisa mengembalikan.`
      )
    )
      return;
    setError(null);
    setBusyId(o.id);
    const { error } = await supabase.rpc("advance_production", {
      p_order: o.id,
      p_status: step.next,
    });
    setBusyId(null);
    if (error) setError(error.message);
    await load();
  }

  if (!ready) {
    return <main className="p-6 text-gray-900">Memuat...</main>;
  }

  return (
    <main className="min-h-screen bg-amber-50 p-4 text-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">Antrean Produksi</h1>
        <div className="flex gap-3 text-sm">
          <button onClick={load} className="text-amber-800 underline">
            Muat ulang
          </button>
          <Link href="/stock" className="text-amber-800 underline">
            Kembali
          </Link>
        </div>
      </div>

      {error && <p className="mb-3 text-red-600">Error: {error}</p>}

      <ul className="space-y-3">
        {orders.length === 0 && (
          <li className="text-gray-600">Tidak ada pesanan dalam produksi.</li>
        )}
        {orders.map((o, index) => {
          const step = STEPS[o.status];
          return (
            <li key={o.id} className="rounded bg-white p-4 shadow">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="mr-2 text-sm text-gray-500">
                    Urutan {index + 1}
                  </span>
                  <span className="font-bold">
                    #{String(o.order_number).padStart(4, "0")}
                  </span>{" "}
                  <span className="font-semibold">{o.customer_name}</span>
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs">
                    {o.order_type === "custom" ? "Pesanan khusus" : "Siap jual"}
                  </span>
                </div>
                <span
                  className={`rounded px-2 py-1 text-sm font-semibold ${BADGE[o.status] ?? ""}`}
                >
                  {step?.label ?? o.status}
                </span>
              </div>

              <ul className="mb-2 space-y-2">
                {o.items.map((i, k) => (
                  <li key={k} className="rounded bg-amber-50 p-2">
                    <p className="font-semibold">
                      {i.quantity} x {i.description}
                    </p>
                    {(i.length_cm || i.width_cm || i.height_cm) && (
                      <p className="text-lg font-bold">
                        {i.length_cm ?? "-"} x {i.width_cm ?? "-"} x{" "}
                        {i.height_cm ?? "-"} cm
                      </p>
                    )}
                    {(i.material || i.finish) && (
                      <p className="text-sm text-gray-700">
                        {i.material && `Bahan: ${i.material}`}
                        {i.material && i.finish && " | "}
                        {i.finish && `Finishing: ${i.finish}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>

              {o.notes && (
                <p className="mb-2 text-sm text-gray-700">Catatan: {o.notes}</p>
              )}

              {step && (
                <button
                  onClick={() => advance(o)}
                  disabled={busyId === o.id}
                  className="w-full rounded bg-green-700 py-3 text-lg font-semibold text-white disabled:opacity-50"
                >
                  {busyId === o.id ? "Memproses..." : step.button}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}