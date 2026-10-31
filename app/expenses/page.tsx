"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const CATEGORIES = ["Bahan baku", "Upah", "Transport", "Operasional", "Lainnya"];

type Expense = {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  note: string | null;
};

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Expenses() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [rows, setRows] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(today());
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    const start = `${m}-01`;
    const end =
      mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
    const { data, error } = await supabase
      .from("expenses")
      .select("id, expense_date, category, amount, note")
      .gte("expense_date", start)
      .lt("expense_date", end)
      .order("expense_date", { ascending: false });
    if (error) setError(error.message);
    else setRows(data ?? []);
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
      setReady(true);
    }
    guard();
  }, [router]);

  useEffect(() => {
    if (ready) load(month);
  }, [ready, month, load]);

  async function addExpense() {
    setError(null);
    const value = Number(amount);
    if (!value || value <= 0) {
      setError("Isi jumlah yang valid.");
      return;
    }
    const { error } = await supabase.from("expenses").insert({
      expense_date: date,
      category,
      amount: value,
      note: note.trim() || null,
    });
    if (error) setError(error.message);
    else {
      setAmount("");
      setNote("");
      await load(month);
    }
  }

  async function removeExpense(id: string) {
    if (!confirm("Hapus pengeluaran ini?")) return;
    setError(null);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) setError(error.message);
    else await load(month);
  }

  if (!ready) {
    return <main className="p-6 text-gray-900">Memuat...</main>;
  }

  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const perCategory = CATEGORIES.map((c) => ({
    name: c,
    sum: rows
      .filter((r) => r.category === c)
      .reduce((s, r) => s + Number(r.amount), 0),
  })).filter((c) => c.sum > 0);

  return (
    <main className="min-h-screen bg-amber-50 p-6 text-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">Pengeluaran</h1>
        <Link href="/" className="text-amber-800 underline">
          Kembali ke stok
        </Link>
      </div>

      {error && <p className="mb-3 text-red-600">Error: {error}</p>}

      <div className="mb-4 flex flex-wrap gap-2 rounded bg-white p-3 shadow">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-gray-300 p-2 text-gray-900"
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
          placeholder="Jumlah (Rp)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-40 rounded border border-gray-300 p-2 text-gray-900"
        />
        <input
          placeholder="Catatan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-w-48 flex-1 rounded border border-gray-300 p-2 text-gray-900"
        />
        <button
          onClick={addExpense}
          className="rounded bg-amber-800 px-4 py-2 font-semibold text-white"
        >
          Simpan
        </button>
      </div>

      <div className="mb-4 rounded bg-white p-3 shadow">
        <div className="mb-2 flex items-center gap-3">
          <label className="font-semibold">Bulan:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-gray-300 p-1 text-gray-900"
          />
        </div>
        <p className="text-lg">
          Total bulan ini: <span className="font-bold">{rupiah(total)}</span>
        </p>
        {perCategory.length > 0 && (
          <ul className="mt-1 text-sm text-gray-700">
            {perCategory.map((c) => (
              <li key={c.name}>
                {c.name}: {rupiah(c.sum)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="space-y-2">
        {rows.length === 0 && (
          <li className="text-gray-600">Belum ada pengeluaran di bulan ini.</li>
        )}
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded bg-white p-3 shadow"
          >
            <div>
              <span className="text-sm text-gray-500">{r.expense_date}</span>{" "}
              <span className="font-semibold">{r.category}</span>:{" "}
              {rupiah(Number(r.amount))}
              {r.note && <span className="ml-2 text-gray-600">({r.note})</span>}
            </div>
            <button
              onClick={() => removeExpense(r.id)}
              className="rounded bg-red-700 px-3 py-1 text-white"
            >
              Hapus
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}