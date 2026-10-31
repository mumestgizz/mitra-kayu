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

type Product = { id: string; name: string; category: string; price: number };

type OrderItem = {
  id: string;
  description: string;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  material: string | null;
  finish: string | null;
  quantity: number;
  unit_price: number;
};

type Order = {
  id: string;
  order_number: number;
  order_type: string;
  customer_name: string;
  customer_phone: string | null;
  notes: string | null;
  total_price: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

type CartItem = {
  key: string;
  product_id: string | null;
  description: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  material: string;
  finish: string;
  quantity: number;
  unit_price: number;
};

const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Orders() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState("active");

  // New order form
  const [orderType, setOrderType] = useState<"ready_made" | "custom">("ready_made");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Ready-made item inputs
  const [selProduct, setSelProduct] = useState("");
  const [rmQty, setRmQty] = useState("1");
  const [rmPrice, setRmPrice] = useState("");

  // Custom item inputs
  const [cDesc, setCDesc] = useState("");
  const [cL, setCL] = useState("");
  const [cW, setCW] = useState("");
  const [cH, setCH] = useState("");
  const [cMaterial, setCMaterial] = useState("");
  const [cFinish, setCFinish] = useState("");
  const [cQty, setCQty] = useState("1");
  const [cPrice, setCPrice] = useState("");

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setOrders((data ?? []) as Order[]);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, price")
      .eq("active", true)
      .order("category")
      .order("name");
    if (error) setError(error.message);
    else setProducts((data ?? []) as Product[]);
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
      await Promise.all([loadProducts(), loadOrders()]);
      setReady(true);
    }
    guard();
  }, [router, loadProducts, loadOrders]);

  function changeType(t: "ready_made" | "custom") {
    if (t === orderType) return;
    setOrderType(t);
    setCart([]); // an order has one type, so switching clears the items
  }

  function chooseProduct(id: string) {
    setSelProduct(id);
    const p = products.find((x) => x.id === id);
    setRmPrice(p ? String(p.price) : "");
  }

  function addReadyMade() {
    setError(null);
    const p = products.find((x) => x.id === selProduct);
    const qty = Number(rmQty);
    const price = Number(rmPrice);
    if (!p) {
      setError("Pilih produk.");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("Jumlah harus bilangan bulat lebih dari 0.");
      return;
    }
    if (rmPrice === "" || isNaN(price) || price < 0) {
      setError("Isi harga yang valid.");
      return;
    }
    setCart([
      ...cart,
      {
        key: crypto.randomUUID(),
        product_id: p.id,
        description: p.name,
        length_cm: "",
        width_cm: "",
        height_cm: "",
        material: "",
        finish: "",
        quantity: qty,
        unit_price: price,
      },
    ]);
    setSelProduct("");
    setRmQty("1");
    setRmPrice("");
  }

  function addCustom() {
    setError(null);
    const qty = Number(cQty);
    const price = Number(cPrice);
    if (!cDesc.trim()) {
      setError("Isi deskripsi produk pesanan khusus.");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setError("Jumlah harus bilangan bulat lebih dari 0.");
      return;
    }
    if (cPrice === "" || isNaN(price) || price < 0) {
      setError("Isi harga yang valid.");
      return;
    }
    setCart([
      ...cart,
      {
        key: crypto.randomUUID(),
        product_id: null,
        description: cDesc.trim(),
        length_cm: cL,
        width_cm: cW,
        height_cm: cH,
        material: cMaterial.trim(),
        finish: cFinish.trim(),
        quantity: qty,
        unit_price: price,
      },
    ]);
    setCDesc("");
    setCL("");
    setCW("");
    setCH("");
    setCMaterial("");
    setCFinish("");
    setCQty("1");
    setCPrice("");
  }

  function removeFromCart(key: string) {
    setCart(cart.filter((i) => i.key !== key));
  }

  const cartTotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  async function saveOrder() {
    setError(null);
    if (!customer.trim()) {
      setError("Isi nama pelanggan.");
      return;
    }
    if (cart.length === 0) {
      setError("Tambahkan minimal satu item.");
      return;
    }
    setSaving(true);
    const items = cart.map((i) => ({
      product_id: i.product_id,
      description: i.description,
      length_cm: i.length_cm === "" ? null : Number(i.length_cm),
      width_cm: i.width_cm === "" ? null : Number(i.width_cm),
      height_cm: i.height_cm === "" ? null : Number(i.height_cm),
      material: i.material || null,
      finish: i.finish || null,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }));
    const { error } = await supabase.rpc("create_order", {
      p_type: orderType,
      p_customer: customer,
      p_phone: phone,
      p_notes: notes,
      p_items: items,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCustomer("");
    setPhone("");
    setNotes("");
    setCart([]);
    await loadOrders();
  }

  async function changeStatus(id: string, status: string) {
    setError(null);
    const { error } = await supabase.rpc("set_order_status", {
      p_order: id,
      p_status: status,
    });
    if (error) setError(error.message);
    await loadOrders();
  }

  if (!ready) {
    return <main className="p-6 text-gray-900">Memuat...</main>;
  }

const visibleOrders = orders.filter((o) => {
  if (filterStatus === "all") return true;
  if (filterStatus === "active")
    return o.status !== "delivered" && o.status !== "cancelled";
  if (filterStatus === "history")
    return o.status === "delivered" || o.status === "cancelled";
  return o.status === filterStatus;
});

  const input = "rounded border border-gray-300 p-2 text-gray-900";

  return (
    <main className="min-h-screen bg-amber-50 p-6 text-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-amber-900">Pesanan</h1>
        <Link href="/" className="text-amber-800 underline">
          Kembali ke stok
        </Link>
      </div>

      {error && <p className="mb-3 text-red-600">Error: {error}</p>}

      {/* New order */}
      <section className="mb-6 rounded bg-white p-4 shadow">
        <h2 className="mb-3 text-lg font-bold text-amber-900">Pesanan baru</h2>

        <div className="mb-3 flex gap-2">
          <button
            onClick={() => changeType("ready_made")}
            className={`rounded px-4 py-2 font-semibold ${
              orderType === "ready_made"
                ? "bg-amber-800 text-white"
                : "bg-gray-200 text-gray-900"
            }`}
          >
            Produk siap jual
          </button>
          <button
            onClick={() => changeType("custom")}
            className={`rounded px-4 py-2 font-semibold ${
              orderType === "custom"
                ? "bg-amber-800 text-white"
                : "bg-gray-200 text-gray-900"
            }`}
          >
            Pesanan khusus
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <input
            placeholder="Nama pelanggan"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className={`${input} min-w-48 flex-1`}
          />
          <input
            placeholder="No. WhatsApp"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`${input} w-48`}
          />
          <input
            placeholder="Catatan (opsional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${input} min-w-48 flex-1`}
          />
        </div>

        {orderType === "ready_made" ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-dashed border-gray-300 p-3">
            <select
              value={selProduct}
              onChange={(e) => chooseProduct(e.target.value)}
              className={`${input} min-w-64 flex-1`}
            >
              <option value="">-- Pilih produk --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.category} - {p.name} ({rupiah(Number(p.price))})
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Jumlah"
              value={rmQty}
              onChange={(e) => setRmQty(e.target.value)}
              className={`${input} w-24`}
            />
            <input
              type="number"
              placeholder="Harga satuan"
              value={rmPrice}
              onChange={(e) => setRmPrice(e.target.value)}
              className={`${input} w-40`}
            />
            <button
              onClick={addReadyMade}
              className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
            >
              Tambah item
            </button>
          </div>
        ) : (
          <div className="mb-3 space-y-2 rounded border border-dashed border-gray-300 p-3">
            <input
              placeholder="Deskripsi (mis. Meja makan jati custom)"
              value={cDesc}
              onChange={(e) => setCDesc(e.target.value)}
              className={`${input} w-full`}
            />
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                placeholder="Panjang (cm)"
                value={cL}
                onChange={(e) => setCL(e.target.value)}
                className={`${input} w-32`}
              />
              <input
                type="number"
                placeholder="Lebar (cm)"
                value={cW}
                onChange={(e) => setCW(e.target.value)}
                className={`${input} w-32`}
              />
              <input
                type="number"
                placeholder="Tinggi (cm)"
                value={cH}
                onChange={(e) => setCH(e.target.value)}
                className={`${input} w-32`}
              />
              <input
                placeholder="Bahan (mis. jati)"
                value={cMaterial}
                onChange={(e) => setCMaterial(e.target.value)}
                className={`${input} w-40`}
              />
              <input
                placeholder="Finishing"
                value={cFinish}
                onChange={(e) => setCFinish(e.target.value)}
                className={`${input} w-40`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                placeholder="Jumlah"
                value={cQty}
                onChange={(e) => setCQty(e.target.value)}
                className={`${input} w-24`}
              />
              <input
                type="number"
                placeholder="Harga satuan (Rp)"
                value={cPrice}
                onChange={(e) => setCPrice(e.target.value)}
                className={`${input} w-48`}
              />
              <button
                onClick={addCustom}
                className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
              >
                Tambah item
              </button>
            </div>
          </div>
        )}

        {cart.length > 0 && (
          <ul className="mb-3 space-y-1 text-sm">
            {cart.map((i) => (
              <li
                key={i.key}
                className="flex items-center justify-between rounded bg-amber-50 p-2"
              >
                <span>
                  {i.quantity} x {i.description}
                  {(i.length_cm || i.width_cm || i.height_cm) &&
                    ` (${i.length_cm || "-"} x ${i.width_cm || "-"} x ${i.height_cm || "-"} cm)`}
                  {i.material && `, ${i.material}`}
                  {i.finish && `, ${i.finish}`} @ {rupiah(i.unit_price)}
                </span>
                <button
                  onClick={() => removeFromCart(i.key)}
                  className="ml-2 text-red-700 underline"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between">
          <p className="text-lg">
            Total: <span className="font-bold">{rupiah(cartTotal)}</span>
          </p>
          <button
            onClick={saveOrder}
            disabled={saving}
            className="rounded bg-amber-800 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan pesanan"}
          </button>
        </div>
      </section>

      {/* Order list */}
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-bold text-amber-900">Daftar pesanan</h2>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded border border-gray-300 p-1 text-gray-900"
        >
        <option value="active">Pesanan aktif</option>
<option value="history">Riwayat (dikirim / dibatalkan)</option>
<option value="all">Semua status</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-3">
        {visibleOrders.length === 0 && (
          <li className="text-gray-600">Belum ada pesanan.</li>
        )}
        {visibleOrders.map((o) => (
          <li key={o.id} className="rounded bg-white p-4 shadow">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold">
                  #{String(o.order_number).padStart(4, "0")}
                </span>{" "}
                <span className="font-semibold">{o.customer_name}</span>
                {o.customer_phone && (
                  <span className="ml-2 text-sm text-gray-600">
                    {o.customer_phone}
                  </span>
                )}
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs">
                  {o.order_type === "custom" ? "Pesanan khusus" : "Siap jual"}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {o.created_at.slice(0, 10)}
                </span>
              </div>
              <select
                value={o.status}
                onChange={(e) => changeStatus(o.id, e.target.value)}
                className="rounded border border-gray-300 p-1 text-gray-900"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <ul className="text-sm text-gray-800">
              {o.order_items.map((i) => (
                <li key={i.id}>
                  {i.quantity} x {i.description}
                  {(i.length_cm || i.width_cm || i.height_cm) &&
                    ` (${i.length_cm ?? "-"} x ${i.width_cm ?? "-"} x ${i.height_cm ?? "-"} cm)`}
                  {i.material && `, ${i.material}`}
                  {i.finish && `, ${i.finish}`} @ {rupiah(Number(i.unit_price))}
                </li>
              ))}
            </ul>
            {o.notes && (
              <p className="mt-1 text-sm text-gray-600">Catatan: {o.notes}</p>
            )}
            <p className="mt-2 font-bold">
              Total: {rupiah(Number(o.total_price))}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}