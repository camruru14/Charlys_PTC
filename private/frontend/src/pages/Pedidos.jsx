import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { blockNegativeKey, blockWheel } from "../lib/numberInput";
import { IconOrders, IconTruck, IconCheck, IconPlus, IconClose } from "../lib/icons";

const STATUSES = ["Pendiente", "Procesando", "En Fabricación", "Empacado", "En Tránsito", "Entregado"];
const PAYMENT = ["Pendiente", "Pagado", "Reembolsado"];
const PRODUCTS = ["Pajilla", "Pelota"];
const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];

// Campos más chicos que Field/SelectField, solo para la fila de "agregar
// producto" del modal de pedido (esa fila no necesita casillas tan grandes).
const compactLabelClass = "mb-1 block text-xs font-medium text-slate-600";
const compactControlClass =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

function CompactField({ label, ...rest }) {
  return (
    <label className="block">
      <span className={compactLabelClass}>{label}</span>
      <input className={compactControlClass} {...rest} />
    </label>
  );
}

function CompactSelect({ label, options, placeholder, ...rest }) {
  return (
    <label className="block">
      <span className={compactLabelClass}>{label}</span>
      <select className={compactControlClass} {...rest}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}

const emptyForm = {
  orderNumber: "",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerAddress: "",
  status: "Pendiente",
  paymentStatus: "Pendiente",
};

// Línea en construcción en la mini tabla de productos del modal, antes de
// agregarse a la lista de items del pedido.
const emptyLine = { product: "Pajilla", color: "Rojo", quantity: "", unitPrice: "" };

// Vista previa del próximo N° de pedido (el backend genera el definitivo al guardar)
function previewOrderNumber(list) {
  const prefix = `ORD-${new Date().getFullYear()}-`;
  const lastNumber = list.reduce((max, o) => {
    if (!o.orderNumber?.startsWith(prefix)) return max;
    const n = parseInt(o.orderNumber.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

function Pedidos() {
  const { data, loading, error, refetch } = useFetch("/orders");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [lineForm, setLineForm] = useState(emptyLine);
  const [saving, setSaving] = useState(false);
  // Pedido cuyos productos se muestran en el modal "Ver productos" de la tabla.
  const [viewTarget, setViewTarget] = useState(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestTarget, setRequestTarget] = useState(null);
  const [requesting, setRequesting] = useState(false);

  const total = useMemo(() => items.reduce((s, i) => s + i.subtotal, 0), [items]);

  const list = Array.isArray(data) ? data : [];

  const kpis = useMemo(() => ({
    total: list.length,
    pending: list.filter((o) => o.status === "Pendiente").length,
    transit: list.filter((o) => o.status === "En Tránsito").length,
    delivered: list.filter((o) => o.status === "Entregado").length,
  }), [list]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, orderNumber: previewOrderNumber(list) });
    setItems([]);
    setLineForm(emptyLine);
    setModalOpen(true);
  }

  function openEdit(o) {
    setEditingId(o._id);
    setForm({
      orderNumber: o.orderNumber || "",
      customerName: o.customer?.name || "",
      customerEmail: o.customer?.email || "",
      customerPhone: o.customer?.phone || "",
      customerAddress: o.customer?.address || "",
      status: o.status || "Pendiente",
      paymentStatus: o.paymentStatus || "Pendiente",
    });
    setItems(
      (o.items || []).map((i) => ({
        product: i.product,
        color: i.color || "",
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal ?? i.quantity * i.unitPrice,
      })),
    );
    setLineForm(emptyLine);
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const handleLineChange = (e) => setLineForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Agrega la línea en construcción (Producto/Color/Cantidad/Precio unitario)
  // a la mini tabla de productos del pedido.
  function addLine() {
    const quantity = Number(lineForm.quantity) || 0;
    const unitPrice = Number(lineForm.unitPrice) || 0;
    if (!lineForm.product) {
      toast.error("Selecciona un producto");
      return;
    }
    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    setItems((prev) => [...prev, { product: lineForm.product, color: lineForm.color, quantity, unitPrice, subtotal: quantity * unitPrice }]);
    setLineForm(emptyLine);
  }

  function removeLine(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Agrega al menos un producto al pedido");
      return;
    }
    setSaving(true);
    const payload = {
      customer: {
        name: form.customerName,
        email: form.customerEmail,
        phone: form.customerPhone,
        address: form.customerAddress,
      },
      items,
      total,
      status: form.status,
      paymentStatus: form.paymentStatus,
    };
    try {
      if (editingId) {
        await api.put(`/orders/${editingId}`, payload);
        toast.success("Pedido actualizado");
      } else {
        const res = await api.post("/orders", payload);
        toast.success(res?.orderNumber ? `Pedido ${res.orderNumber} creado` : "Pedido creado");
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

  function openRequest(o) {
    setRequestTarget(o);
    setRequestModalOpen(true);
  }

  // Solicita a Inventario los productos de este pedido: no descuenta ni
  // reserva stock, solo hace que el pedido aparezca en Inventario > Pedidos.
  async function confirmRequest() {
    setRequesting(true);
    try {
      await api.patch(`/orders/${requestTarget._id}/request-inventory`);
      toast.success(`${requestTarget.orderNumber} solicitado a inventario`);
      setRequestModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRequesting(false);
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
            <table className="w-full min-w-[1480px] table-fixed text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="w-[150px] pb-3 pr-4 font-semibold">Pedido</th>
                  <th className="w-[140px] pb-3 pr-4 font-semibold">Cliente</th>
                  <th className="w-[150px] pb-3 pr-8 font-semibold">Correo</th>
                  <th className="w-[120px] pb-3 pr-8 font-semibold">Teléfono</th>
                  <th className="w-[200px] pb-3 pr-4 font-semibold">Dirección</th>
                  <th className="w-[100px] pb-3 pr-8 font-semibold">Productos</th>
                  <th className="w-[90px] pb-3 pr-4 font-semibold">Total</th>
                  <th className="w-[110px] pb-3 pr-4 font-semibold">Pago</th>
                  <th className="w-[160px] pb-3 pr-4 font-semibold">Estado</th>
                  <th className="w-[260px] pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((o) => {
                  return (
                    <tr key={o._id} className="text-slate-600 transition hover:bg-slate-50/60">
                      <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap">{o.orderNumber}</td>
                      <td className="py-3 pr-4">{o.customer?.name || "—"}</td>
                      <td className="py-3 pr-8 w-[16ch] max-w-[16ch] whitespace-normal break-words">{o.customer?.email || "—"}</td>
                      <td className="py-3 pr-8">{o.customer?.phone || "—"}</td>
                      <td className="py-3 pr-4 w-[22ch] max-w-[22ch] whitespace-normal break-words">{o.customer?.address || "—"}</td>
                      <td className="py-3 pr-8">
                        <button onClick={() => setViewTarget(o)} className="block w-full rounded-lg bg-slate-100 px-3 py-1 text-center text-xs font-semibold text-slate-600 hover:bg-slate-200">
                          Ver
                        </button>
                      </td>
                      <td className="py-3 pr-4 tabular-nums">${Number(o.total || 0).toFixed(2)}</td>
                      <td className="py-3 pr-4"><StatusPill status={o.paymentStatus} /></td>
                      <td className="py-3 pr-4">
                        <select
                          value={o.status}
                          onChange={(e) => changeStatus(o, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap justify-end gap-1.5 text-xs font-semibold">
                          {o.inventoryRequestedAt ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
                              <IconCheck width={14} height={14} /> Solicitado
                            </span>
                          ) : (
                            <button onClick={() => openRequest(o)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Solicitar</button>
                          )}
                          <button onClick={() => openEdit(o)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                          <button onClick={() => handleDelete(o)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
          {/* N° de pedido autogenerado (solo lectura) */}
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Número de pedido</span>
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <span className="text-sm font-semibold text-slate-800">{form.orderNumber}</span>
            </div>
          </div>
          <Field label="Cliente" name="customerName" value={form.customerName} onChange={handleChange} required />
          <Field label="Correo del cliente" name="customerEmail" type="email" value={form.customerEmail} onChange={handleChange} />
          <Field label="Teléfono" name="customerPhone" value={form.customerPhone} onChange={handleChange} />
          <Field label="Dirección" name="customerAddress" value={form.customerAddress} onChange={handleChange} />
          <SelectField label="Estado" name="status" value={form.status} onChange={handleChange} options={STATUSES} />
          <SelectField label="Estado de pago" name="paymentStatus" value={form.paymentStatus} onChange={handleChange} options={PAYMENT} />

          {/* Productos del pedido: se arman en esta mini tabla en vez de ser
              un solo Producto/Color/Cantidad/Precio unitario fijos, así un
              mismo pedido puede llevar varios productos. */}
          <div className="sm:col-span-2 space-y-3 rounded-xl border border-slate-200 p-4">
            <span className="block text-sm font-medium text-slate-700">Productos del pedido</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.3fr_1fr_0.8fr_1fr_auto] sm:items-end">
              <CompactSelect label="Producto" name="product" value={lineForm.product} onChange={handleLineChange} options={PRODUCTS} />
              <CompactSelect label="Color" name="color" value={lineForm.color} onChange={handleLineChange} options={COLORS} placeholder="Sin color" />
              <CompactField label="Cantidad" name="quantity" type="number" min="0" onKeyDown={blockNegativeKey} onWheel={blockWheel} value={lineForm.quantity} onChange={handleLineChange} />
              <CompactField label="Precio unitario" name="unitPrice" type="number" step="0.01" min="0" onKeyDown={blockNegativeKey} onWheel={blockWheel} value={lineForm.unitPrice} onChange={handleLineChange} />
              <button type="button" onClick={addLine} className="h-fit rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
                Agregar
              </button>
            </div>

            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="pb-2 pr-3 font-semibold">Producto</th>
                      <th className="pb-2 pr-3 font-semibold">Color</th>
                      <th className="pb-2 pr-3 font-semibold">Cantidad</th>
                      <th className="pb-2 pr-3 font-semibold">Precio unitario</th>
                      <th className="pb-2 pr-3 font-semibold">Subtotal</th>
                      <th className="pb-2 font-semibold text-right">Quitar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, idx) => (
                      <tr key={idx} className="text-slate-600">
                        <td className="py-2 pr-3 font-semibold text-slate-800">{it.product}</td>
                        <td className="py-2 pr-3">{it.color || "—"}</td>
                        <td className="py-2 pr-3 tabular-nums">{it.quantity}</td>
                        <td className="py-2 pr-3 tabular-nums">${it.unitPrice.toFixed(2)}</td>
                        <td className="py-2 pr-3 tabular-nums">${it.subtotal.toFixed(2)}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="rounded-lg p-1 text-red-500 transition hover:bg-red-50"
                            aria-label={`Quitar ${it.product}`}
                          >
                            <IconClose width={14} height={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Aún no hay productos agregados a este pedido.</p>
            )}
          </div>

          <div className="sm:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Total del pedido: <b className="text-slate-900">${total.toFixed(2)}</b>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!viewTarget}
        onClose={() => setViewTarget(null)}
        title={`Productos del pedido ${viewTarget?.orderNumber || ""}`}
        footer={
          <button onClick={() => setViewTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button>
        }
      >
        {viewTarget?.items?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-3 font-semibold">Producto</th>
                  <th className="pb-2 pr-3 font-semibold">Color</th>
                  <th className="pb-2 pr-3 font-semibold">Cantidad</th>
                  <th className="pb-2 pr-3 font-semibold">Precio unitario</th>
                  <th className="pb-2 font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viewTarget.items.map((it, idx) => (
                  <tr key={idx} className="text-slate-600">
                    <td className="py-2 pr-3 font-semibold text-slate-800">{it.product}</td>
                    <td className="py-2 pr-3">{it.color || "—"}</td>
                    <td className="py-2 pr-3 tabular-nums">{it.quantity}</td>
                    <td className="py-2 pr-3 tabular-nums">${Number(it.unitPrice || 0).toFixed(2)}</td>
                    <td className="py-2 tabular-nums">${Number(it.subtotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
              Total del pedido: <b className="text-slate-900">${Number(viewTarget.total || 0).toFixed(2)}</b>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Este pedido no tiene productos.</p>
        )}
      </Modal>

      <Modal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Solicitar a inventario"
        footer={
          <>
            <button onClick={() => setRequestModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={confirmRequest} disabled={requesting} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {requesting ? "Solicitando…" : "Confirmar"}
            </button>
          </>
        }
      >
        {requestTarget ? (
          <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
            Solicitar a inventario los productos para este pedido ({requestTarget.orderNumber}).
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

export default Pedidos;