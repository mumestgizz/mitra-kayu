"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const BUCKET = "payment-proofs";

type Payment = {
  id: string;
  kind: string;
  amount: number;
  note: string | null;
  proof_path: string | null;
  created_at: string;
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function PaymentPanel({
  orderId,
  total,
}: {
  orderId: string;
  total: number;
}) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"dp" | "final">("dp");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("id, kind, amount, note, proof_path, created_at")
      .eq("order_id", orderId)
      .order("created_at");
    if (error) setError(error.message);
    else setPayments((data ?? []) as Payment[]);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = total - paid;
  const label =
    paid === 0
      ? "Belum dibayar"
      : paid >= total
        ? "Lunas"
        : paid >= total * 0.5
          ? "Uang muka terpenuhi"
          : "Dibayar sebagian";

  async function addPayment() {
    setError(null);
    const value = Number(amount);
    if (amount === "" || isNaN(value) || value <= 0) {
      setError("Isi jumlah pembayaran yang valid.");
      return;
    }
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Bukti pembayaran harus berupa gambar.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Ukuran gambar maksimal 5 MB.");
        return;
      }
    }

    setBusy(true);
    let path: string | null = null;
    if (file) {
      const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      path = `${orderId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file);
      if (upErr) {
        setError("Gagal mengunggah bukti: " + upErr.message);
        setBusy(false);
        return;
      }
    }

    const { error } = await supabase.rpc("record_payment", {
      p_order: orderId,
      p_kind: kind,
      p_amount: value,
      p_note: note,
      p_proof: path ?? "",
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAmount("");
    setNote("");
    setFile(null);
    setFileKey(fileKey + 1);
    await load();
  }

  async function removePayment(id: string) {
    if (!confirm("Hapus catatan pembayaran ini?")) return;
    setError(null);
    const { error } = await supabase.rpc("delete_payment", { p_payment: id });
    if (error) setError(error.message);
    await load();
  }

  async function viewProof(path: string) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60);
    if (error || !data) setError("Gagal membuka bukti pembayaran.");
    else window.open(data.signedUrl, "_blank");
  }

  const box = "rounded border border-gray-300 p-1 text-gray-900";

  return (
    <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          Dibayar <span className="font-bold">{rupiah(paid)}</span> dari{" "}
          {rupiah(total)}
          {remaining > 0 && <> (sisa {rupiah(remaining)})</>} -{" "}
          <span
            className={`font-bold ${
              paid >= total ? "text-green-700" : "text-orange-700"
            }`}
          >
            {label}
          </span>
        </p>
        <button
          onClick={() => setOpen(!open)}
          className="text-amber-800 underline"
        >
          {open ? "Tutup pembayaran" : "Kelola pembayaran"}
        </button>
      </div>

      {error && <p className="mt-2 text-red-600">Error: {error}</p>}

      {open && (
        <div className="mt-3">
          <ul className="mb-3 space-y-1">
            {payments.length === 0 && (
              <li className="text-gray-600">Belum ada pembayaran.</li>
            )}
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  {p.created_at.slice(0, 10)} -{" "}
                  {p.kind === "dp" ? "Uang muka" : "Pelunasan"}:{" "}
                  <span className="font-semibold">
                    {rupiah(Number(p.amount))}
                  </span>
                  {p.note && ` (${p.note})`}
                </span>
                <span className="flex gap-3">
                  {p.proof_path && (
                    <button
                      onClick={() => viewProof(p.proof_path!)}
                      className="text-amber-800 underline"
                    >
                      Lihat bukti
                    </button>
                  )}
                  <button
                    onClick={() => removePayment(p.id)}
                    className="text-red-700 underline"
                  >
                    Hapus
                  </button>
                </span>
              </li>
            ))}
          </ul>

          {remaining > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as "dp" | "final")}
                className={box}
              >
                <option value="dp">Uang muka</option>
                <option value="final">Pelunasan</option>
              </select>
              <input
                type="number"
                placeholder="Jumlah (Rp)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${box} w-36`}
              />
              <input
                placeholder="Catatan (opsional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${box} min-w-40 flex-1`}
              />
              <input
                key={fileKey}
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-xs"
              />
              <button
                onClick={addPayment}
                disabled={busy}
                className="rounded bg-green-700 px-3 py-1 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Menyimpan..." : "Catat pembayaran"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}