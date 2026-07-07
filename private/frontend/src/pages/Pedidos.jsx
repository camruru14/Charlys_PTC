import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconOrders, IconTruck, IconCheck, IconPlus } from "../lib/icons";

const STATUSES = ["Pendiente", "Procesando", "En Fabricación", "Empacado", "En Tránsito", "Entregado"];
const PAYMENT = ["Pendiente", "Pagado", "Reembolsado"];
const PRODUCTS = ["Pajilla", "Pelota #4", "Pelota #6", "Otro"];
const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];

const emptyForm = {
  orderNumber: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerAddress: "",
  product: "Pajilla",
  color: "Rojo",
  quantity: "",
  unitPrice: "",
  status: "Pendiente",
  paymentStatus: "Pendiente",
};

function newOrderNumber() {
  return "ORD-" + String(Date.now()).slice(-6);
}

function Pedidos() {
  const { data, loading, error, refetch } = useFetch("/orders");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(data) ? data : [];

  const kpis = useMemo(() => ({
    total: list.length,
    pending: list.filter((o) => o.status === "Pendiente").length,
    transit: list.filter((o) => o.status === "En Tránsito").length,
    delivered: list.filter((o) => o.status === "Entregado").length,
  }), [list]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, orderNumber: newOrderNumber() });
    setModalOpen(true);
  }

  function openEdit(o) {
    setEditingId(o._id);
    const item = o.items?.[0] || {};
    setForm({
      orderNumber: o.orderNumber || "",
      customerName: o.customer?.name || "",
      customerEmail: o.customer?.email || "",
      customerPhone: o.customer?.phone || "",
      customerAddress: o.customer?.address || "",
      product: item.product || "Pajilla",
      color: item.color || "",
      quantity: item.quantity ?? "",
      unitPrice: item.unitPrice ?? "",
      status: o.status || "Pendiente",
      paymentStatus: o.paymentStatus || "Pendiente",
    });
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const quantity = Number(form.quantity) || 0;
    const unitPrice = Number(form.unitPrice) || 0;
    const subtotal = quantity * unitPrice;
    const payload = {
      orderNumber: form.orderNumber,
      customer: {
        name: form.customerName,
        email: form.customerEmail,
        phone: form.customerPhone,
        address: form.customerAddress,
      },
      items: [{ product: form.product, color: form.color, quantity, unitPrice, subtotal }],
      total: subtotal,
      status: form.status,
      paymentStatus: form.paymentStatus,
    };
    try {
      if (editingId) {
        await api.put(`/orders/${editingId}`, payload);
        toast.success("Pedido actualizado");
      } else {
        await api.post("/orders", payload);
        toast.success("Pedido creado");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(o, status) {
    try {
      await api.patch(`/orders/${o._id}/status`, { status });
      toast.success(`Pedido ${o.orderNumber}: ${status}`);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(o) {
    if (!window.confirm(`¿Eliminar el pedido ${o.orderNumber}?`)) return;
    try {
      await api.del(`/orders/${o._id}`);
      toast.success("Pedido eliminado");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total de pedidos" value={kpis.total} icon={IconOrders} trend={{ tone: "blue", label: "en sistema" }} />
        <KpiCard label="Pendientes" value={kpis.pending} icon={IconOrders} trend={{ tone: kpis.pending ? "yellow" : "green", label: kpis.pending ? "Por procesar" : "Al día" }} />
        <KpiCard label="En tránsito" value={kpis.transit} icon={IconTruck} trend={{ tone: "yellow", label: "en ruta" }} />
        <KpiCard label="Entregados" value={kpis.delivered} icon={IconCheck} trend={{ tone: "green", label: "completados" }} />
      </div>

      <SectionCard
        title="Pedidos del e-commerce"
        action={
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            <IconPlus width={16} height={16} /> Nuevo pedido
          </button>
        }
      >
        <AsyncState loading={loading} error={error} empty={!loading && list.length === 0} emptyText="No hay pedidos.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Pedido</th>
                  <th className="pb-3 pr-4 font-semibold">Cliente</th>
                  <th className="pb-3 pr-4 font-semibold">Total</th>
                  <th className="pb-3 pr-4 font-semibold">Pago</th>
                  <th className="pb-3 pr-4 font-semibold">Estado</th>
                  <th className="pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((o) => (
                  <tr key={o._id} className="text-slate-600 transition hover:bg-slate-50/60">
                    <td className="py-3 pr-4 font-semibold text-slate-800">{o.orderNumber}</td>
                    <td className="py-3 pr-4">{o.customer?.name || "—"}</td>
                    <td className="py-3 pr-4 tabular-nums">${Number(o.total || 0).toFixed(2)}</td>
                    <td className="py-3 pr-4"><StatusPill status={o.paymentStatus} /></td>
                    <td className="py-3 pr-4">
                      <select
                        value={o.status}
                        onChange={(e) => changeStatus(o, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2 text-xs font-semibold">
                        <button onClick={() => openEdit(o)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                        <button onClick={() => handleDelete(o)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar pedido" : "Nuevo pedido"}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="order-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="order-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Número de pedido" name="orderNumber" value={form.orderNumber} onChange={handleChange} required />
          <Field label="Cliente" name="customerName" value={form.customerName} onChange={handleChange} required />
          <Field label="Correo del cliente" name="customerEmail" type="email" value={form.customerEmail} onChange={handleChange} />
          <Field label="Teléfono" name="customerPhone" value={form.customerPhone} onChange={handleChange} />
          <Field label="Dirección" name="customerAddress" value={form.customerAddress} onChange={handleChange} />
          <SelectField label="Producto" name="product" value={form.product} onChange={handleChange} options={PRODUCTS} required />
          <SelectField label="Color" name="color" value={form.color} onChange={handleChange} options={COLORS} placeholder="Sin color" />
          <Field label="Cantidad" name="quantity" type="number" value={form.quantity} onChange={handleChange} required />
          <Field label="Precio unitario ($)" name="unitPrice" type="number" step="0.01" value={form.unitPrice} onChange={handleChange} required />
          <SelectField label="Estado" name="status" value={form.status} onChange={handleChange} options={STATUSES} />
          <SelectField label="Estado de pago" name="paymentStatus" value={form.paymentStatus} onChange={handleChange} options={PAYMENT} />
          <div className="sm:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Total estimado: <b className="text-slate-900">${((Number(form.quantity) || 0) * (Number(form.unitPrice) || 0)).toFixed(2)}</b>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default Pedidos;
