"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const STATUSES = [
  { value: "waiting_payment", label: "Menunggu pembayaran" },
  { value: "queue", label: "Antrean" },
  { value: "cutting", label: "Pemotongan" },
  { value: "assembly", label: "Perakitan" },
  { value: "done", label: "Selesai" },
  { value: "delivered", label: "Dikirim" },
  { value: "cancelled", label: "Dibatalkan" },
];

type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  status: string;
  total_price: number;
};
type Payment = { order_id: string; amount: number; created_at: string };
type Expense = { amount: number; expense_date: string };
type Material = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  min_stock: number;
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

// Month (YYYY-MM) of a timestamp, in the viewer's local time
const localMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA").slice(0, 7);

export default function Dashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [month, setMonth] = useState("");

  const loadAll = useCallback(async () => {
    const [o, p, e, m] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, customer_name, status, total_price")
        .order("order_number"),
      supabase.from("payments").select("order_id, amount, created_at"),
      supabase.from("expenses").select("amount, expense_date"),
      supabase
        .from("materials")
        .select("id, name, unit, current_stock, min_stock")
        .order("name"),
    ]);
    const err = o.error || p.error || e.error || m.error;
    if (err) {
      setError(err.message);
      return;
    }
    setOrders((o.data ?? []) as Order[]);
    setPayments((p.data ?? []) as Payment[]);
    setExpenses((e.data ?? []) as Expense[]);
    setMaterials((m.data ?? []) as Material[]);
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
      await loadAll();
      setMonth(new Date().toLocaleDateString("en-CA").slice(0, 7));
      setReady(true);
    }
    guard();
  }, [router, loadAll]);

  if (!ready) {
    return <main className="p-6 text-gray-900">Memuat...</main>;
  }

  // Money paid per order
  const paidByOrder: Record<string, number> = {};
  payments.forEach((p) => {
    paidByOrder[p.order_id] = (paidByOrder[p.order_id] ?? 0) + Number(p.amount);
  });

  const activeCount = orders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled"
  ).length;
  const waiting = orders.filter((o) => o.status === "waiting_payment");
  const lowStock = materials.filter(
    (m) => Number(m.current_stock) < Number(m.min_stock)
  );
  const outstanding = orders
    .filter((o) => o.status !== "cancelled")
    .reduce(
      (s, o) =>
        s + Math.max(0, Number(o.total_price) - (paidByOrder[o.id] ?? 0)),
      0
    );

  const income = payments
    .filter((p) => localMonth(p.created_at) === month)
    .reduce((s, p) => s + Number(p.amount), 0);
  const spent = expenses
    .filter((e) => e.expense_date.slice(0, 7) === month)
    .reduce((s, e) => s + Number(e.amount), 0);
  const diff = income - spent;
  const maxBar = Math.max(income, spent, 1);

  const statusCounts = STATUSES.map((s) => ({
    ...s,
    count: orders.filter((o) => o.status === s.value).length,
  }));

  const card = "rounded bg-white p-4 shadow";

  return (
    <main className="min-h-screen bg-amber-50 p-6 text-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">Dashboard</h1>
        <div className="flex gap-3 text-sm">
          <button onClick={loadAll} className="text-amber-800 underline">
            Muat ulang
          </button>
          <Link href="/stock" className="text-amber-800 underline">
            Kembali ke stok
          </Link>
        </div>
      </div>

      {error && <p className="mb-3 text-red-600">Error: {error}</p>}

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={card}>
          <p className="text-sm text-gray-600">Pesanan aktif</p>
          <p className="text-3xl font-bold">{activeCount}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-600">Menunggu pembayaran</p>
          <p className="text-3xl font-bold text-orange-700">{waiting.length}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-600">Stok menipis</p>
          <p
            className={`text-3xl font-bold ${
              lowStock.length > 0 ? "text-red-700" : ""
            }`}
          >
            {lowStock.length}
          </p>
        </div>
        <div className={card}>
          <p className="text-sm text-gray-600">Sisa tagihan pelanggan</p>
          <p className="text-xl font-bold">{rupiah(outstanding)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Income vs expenses */}
        <section className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-amber-900">
              Pemasukan vs pengeluaran
            </h2>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded border border-gray-300 p-1 text-gray-900"
            />
          </div>
          <div className="mb-2">
            <p className="text-sm">
              Pemasukan: <span className="font-bold">{rupiah(income)}</span>
            </p>
            <div className="h-4 rounded bg-gray-100">
              <div
                className="h-4 rounded bg-green-600"
                style={{ width: `${(income / maxBar) * 100}%` }}
              />
            </div>
          </div>
          <div className="mb-3">
            <p className="text-sm">
              Pengeluaran: <span className="font-bold">{rupiah(spent)}</span>
            </p>
            <div className="h-4 rounded bg-gray-100">
              <div
                className="h-4 rounded bg-red-600"
                style={{ width: `${(spent / maxBar) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-lg">
            Selisih:{" "}
            <span
              className={`font-bold ${
                diff >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {rupiah(diff)}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Pemasukan = pembayaran yang dicatat bulan ini, bukan total nilai
            pesanan.
          </p>
        </section>

        {/* Orders by status */}
        <section className={card}>
          <h2 className="mb-3 text-lg font-bold text-amber-900">
            Pesanan per status
          </h2>
          <ul className="space-y-1">
            {statusCounts.map((s) => (
              <li key={s.value} className="flex justify-between">
                <span>{s.label}</span>
                <span className="font-bold">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Waiting for payment */}
        <section className={card}>
          <h2 className="mb-3 text-lg font-bold text-amber-900">
            Menunggu uang muka
          </h2>
          {waiting.length === 0 ? (
            <p className="text-gray-600">Tidak ada.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {waiting.map((o) => {
                const paid = paidByOrder[o.id] ?? 0;
                const needDp = Math.max(0, Number(o.total_price) * 0.5 - paid);
                return (
                  <li key={o.id} className="rounded bg-amber-50 p-2">
                    <p>
                      <span className="font-bold">
                        #{String(o.order_number).padStart(4, "0")}
                      </span>{" "}
                      {o.customer_name} - total {rupiah(Number(o.total_price))}
                    </p>
                    <p className="text-gray-700">
                      Dibayar {rupiah(paid)}
                      {needDp > 0
                        ? `, kurang ${rupiah(needDp)} untuk uang muka 50%`
                        : ", uang muka sudah terpenuhi (siap masuk antrean)"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Low stock */}
        <section className={card}>
          <h2 className="mb-3 text-lg font-bold text-amber-900">
            Stok menipis
          </h2>
          {lowStock.length === 0 ? (
            <p className="text-gray-600">Semua stok aman.</p>
          ) : (
            <ul className="space-y-1">
              {lowStock.map((m) => (
                <li key={m.id} className="flex justify-between">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-red-700">
                    {m.current_stock} {m.unit} (min {m.min_stock})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}