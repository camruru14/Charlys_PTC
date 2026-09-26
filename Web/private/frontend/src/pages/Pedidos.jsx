import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useUrlState } from "../hooks/useUrlState";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import StatusPill from "../components/ui/StatusPill";
import SearchInput from "../components/ui/SearchInput";
import FilterChips from "../components/ui/FilterChips";
import Stepper from "../components/ui/Stepper";
import StatTile from "../components/ui/StatTile";
import EmptyState from "../components/ui/EmptyState";
import { MasterDetail, ListPanel, DetailPanel, ListRow } from "../components/ui/MasterDetail";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { Field, SelectField } from "../components/ui/Field";
import { blockNegativeKey, blockWheel } from "../lib/numberInput";
import { buttonClass } from "../lib/buttonStyles";
import { fmtMoney, fmtNumber, fmtDate, fmtDateYear } from "../lib/format";
import { orderJourneySteps, lastStatusEntry } from "../lib/orderJourney";
import ColorSwatch from "../components/ui/ColorSwatch";
import ActionsMenu from "../components/ui/ActionsMenu";
import { IconPlus, IconClose, IconOrders } from "../lib/icons";

const PAYMENT = ["Pendiente", "Pagado", "Reembolsado"];
const PRODUCTS = ["Pajilla", "Pelota"];
const COLORS = ["Rojo", "Azul", "Verde", "Blanco", "Negro", "Amarillo"];

// Chips de la lista: key -> filtro sobre el pedido.
const CHIP_FILTERS = {
  all: () => true,
  pendientes: (o) => o.status === "Pendiente",
  enRuta: (o) => o.status === "En Tránsito",
  sinPago: (o) => o.paymentStatus === "Pendiente",
};

// Campo de texto más chico que Field, solo para la fila de "agregar
// producto" del modal de pedido (esa fila no necesita casillas tan grandes).
// El desplegable de esa misma fila usa SelectField size="sm", que ya trae su
// propia variante compacta con estas mismas medidas.
function CompactField({ label, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold text-muted">{label}</span>
      <input
        className="w-full rounded-[8px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none transition placeholder:text-faint focus:border-select-bar focus:ring-2 focus:ring-primary-soft"
        {...rest}
      />
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

function OrderRow({ order, selected, onSelect }) {
  return (
    <ListRow selected={selected} onClick={onSelect}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-bold tabular-nums text-ink">{order.orderNumber}</span>
        <StatusPill status={order.status} domain="pedido" variant="dot" />
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="truncate text-[12.5px] text-ink-2">{order.customer?.name || "—"}</span>
        <span className="shrink-0 text-[12.5px] tabular-nums text-ink-2">{fmtMoney(order.total)}</span>
      </div>
    </ListRow>
  );
}

function OrderDetail({ order, onEdit, onDelete }) {
  const steps = orderJourneySteps(order);
  const last = lastStatusEntry(order);
  const items = order.items || [];
  const units = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const address = order.delivery?.address || order.customer?.address;

  return (
    <DetailPanel
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-1 text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-ink">{order.orderNumber}</h2>
            <StatusPill status={order.status} domain="pedido" size="lg" />
            <StatusPill status={order.paymentStatus} domain="pago" />
            {order.sentToInventoryAt ? (
              <span className="inline-flex h-[22px] items-center rounded-[7px] bg-primary-soft px-2 text-[11px] font-semibold text-primary-soft-text">
                Pasó solo a Inventario
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="detail" onClick={onEdit}>
              Editar
            </Button>
            <ActionsMenu items={[{ label: "Eliminar pedido", onClick: onDelete, danger: true }]} />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <p className="t-label">Recorrido del pedido</p>
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[540px]">
              <Stepper steps={steps} />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatTile label="Cliente">
            <p className="text-[14px] font-bold text-ink">{order.customer?.name || "—"}</p>
            <p className="mt-0.5 break-words text-[12.5px] text-ink-2">{order.customer?.email || "—"}</p>
            <p className="text-[12.5px] tabular-nums text-ink-2">{order.customer?.phone || "—"}</p>
          </StatTile>
          <StatTile label="Entrega">
            <p className="break-words text-[13px] text-ink">{address || "—"}</p>
            {/* La zona y la ruta llegan con el modelo de rutas de Logística. */}
            <p className="t-aux mt-0.5">sin asignar</p>
          </StatTile>
          <StatTile label="Fechas">
            <p className="text-[12.5px] tabular-nums text-ink-2">
              <span className="text-muted">Solicitado · </span>
              {fmtDateYear(order.createdAt)}
            </p>
            <p className="mt-0.5 text-[12.5px] tabular-nums text-ink-2">
              <span className="text-muted">Última acción · </span>
              {last ? `${fmtDate(last.at)} · ${last.status.toLowerCase()}` : "—"}
            </p>
          </StatTile>
        </div>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="t-label">Productos del pedido</p>
            <p className="t-aux tabular-nums">
              {fmtNumber(items.length)} {items.length === 1 ? "línea" : "líneas"} · {fmtNumber(units)}{" "}
              {units === 1 ? "unidad" : "unidades"}
            </p>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-line">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="h-8 bg-band text-[10.5px] font-bold uppercase tracking-[0.1em] text-band-text">
                    <th className="px-4 font-bold">Producto</th>
                    <th className="px-3 font-bold">Color</th>
                    <th className="px-3 text-right font-bold">Cant.</th>
                    <th className="px-3 text-right font-bold">Unitario</th>
                    <th className="px-4 text-right font-bold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="t-aux px-4 py-4 text-center">
                        Este pedido no tiene productos.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={idx} className="h-11 border-b border-line-soft last:border-0">
                        <td className="px-4">
                          <span className="flex items-center gap-2 t-row-name">
                            <ColorSwatch color={it.color} />
                            {it.product}
                          </span>
                        </td>
                        <td className="t-row px-3">{it.color || "—"}</td>
                        <td className="t-row px-3 text-right tabular-nums">{fmtNumber(it.quantity)}</td>
                        <td className="t-row px-3 text-right tabular-nums">{fmtMoney(it.unitPrice)}</td>
                        <td className="t-row px-4 text-right tabular-nums">{fmtMoney(it.subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line-soft bg-surface-2 px-4 py-3">
              <span className="text-[13px] font-semibold text-ink-2">Total del pedido</span>
              <span className="text-[16px] font-bold tabular-nums text-ink">{fmtMoney(order.total)}</span>
            </div>
          </div>
        </section>
      </div>
    </DetailPanel>
  );
}

function Pedidos() {
  const { confirm, confirmProps } = useConfirm();
  const { data, loading, error, refetch } = useFetch("/orders");
  const [selectedId, setSelectedId] = useUrlState("id");
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([]);
  const [lineForm, setLineForm] = useState(emptyLine);
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const total = useMemo(() => items.reduce((s, i) => s + i.subtotal, 0), [items]);
  const activeCount = useMemo(() => list.filter((o) => o.status !== "Entregado").length, [list]);

  const chipOptions = useMemo(
    () => [
      { key: "all", label: "Todos", count: list.length },
      { key: "pendientes", label: "Pendientes", count: list.filter(CHIP_FILTERS.pendientes).length, tone: "gray" },
      { key: "enRuta", label: "En ruta", count: list.filter(CHIP_FILTERS.enRuta).length, tone: "teal" },
      { key: "sinPago", label: "Sin pago", count: list.filter(CHIP_FILTERS.sinPago).length, tone: "amber" },
    ],
    [list],
  );

  // Búsqueda por N° de pedido, cliente o correo + chip activo.
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byChip = CHIP_FILTERS[chip] || CHIP_FILTERS.all;
    return list.filter((o) => {
      if (!byChip(o)) return false;
      if (!q) return true;
      const haystack = `${o.orderNumber || ""} ${o.customer?.name || ""} ${o.customer?.email || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [list, search, chip]);

  const selected = useMemo(() => list.find((o) => o._id === selectedId) || null, [list, selectedId]);

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
    // Se conservan los campos de avance de cada línea (verificado, empacado,
    // enviado a fabricación, lote…) para que editar datos del cliente o del
    // pago no borre el progreso en Inventario/Fabricación. El lote viene
    // populado: se manda solo su id para que el backend lo castee.
    // sourceIndex le dice al backend de qué línea original viene cada una:
    // si al guardar se quita o se cambia una línea con stock tomado, el
    // backend lo devuelve a su bodega (o rechaza si ya está empacada).
    setItems(
      (o.items || []).map((i, idx) => ({
        ...i,
        sourceIndex: idx,
        color: i.color || "",
        subtotal: i.subtotal ?? i.quantity * i.unitPrice,
        manufacturingBatch: i.manufacturingBatch?._id || i.manufacturingBatch || undefined,
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
        if (res?._id) setSelectedId(res._id);
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(o) {
    const message = `¿Eliminar el pedido ${o.orderNumber}? El stock ya tomado de bodega vuelve a su lugar y se borran sus lotes que sigan Programados.`;
    if (!(await confirm(message, { danger: true }))) return;
    try {
      await api.del(`/orders/${o._id}`);
      toast.success("Pedido eliminado");
      if (selectedId === o._id) setSelectedId(null);
      refetch();
    } catch (err) {
      // El backend explica qué resolver primero (desempacar en Inventario o
      // resolver el lote en Fabricación): se muestra tal cual y con tiempo
      // suficiente para leerlo.
      toast.error(err.message, { duration: 6000 });
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Pedidos"
        subtitle={`${fmtNumber(activeCount)} activos · selecciona un pedido para ver su ficha completa`}
        actions={
          <Button icon={IconPlus} onClick={openCreate}>
            Nuevo pedido
          </Button>
        }
      />

      <MasterDetail listWidth={452}>
        <ListPanel
          header={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar pedido" />
              <FilterChips options={chipOptions} value={chip} onChange={setChip} />
            </>
          }
        >
          {loading && !data ? (
            <EmptyState title="Cargando pedidos…" />
          ) : error ? (
            <EmptyState title="No se pudieron cargar los pedidos" description={error} />
          ) : filteredList.length === 0 ? (
            <EmptyState
              title={list.length === 0 ? "No hay pedidos." : "Ningún pedido coincide con la búsqueda."}
            />
          ) : (
            filteredList.map((o) => (
              <OrderRow key={o._id} order={o} selected={o._id === selectedId} onSelect={() => setSelectedId(o._id)} />
            ))
          )}
        </ListPanel>

        {selected ? (
          <OrderDetail order={selected} onEdit={() => openEdit(selected)} onDelete={() => handleDelete(selected)} />
        ) : (
          <DetailPanel>
            <EmptyState
              icon={IconOrders}
              title={selectedId && !loading ? "Este pedido ya no existe" : "Selecciona un pedido"}
              description="Su ficha completa aparece aquí: recorrido, cliente, entrega y productos."
            />
          </DetailPanel>
        )}
      </MasterDetail>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar pedido" : "Nuevo pedido"}
        subtitle={form.orderNumber}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className={buttonClass("secondary", "modal")}>Cancelar</button>
            <button type="submit" form="order-form" disabled={saving} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="order-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente" name="customerName" value={form.customerName} onChange={handleChange} required />
          <Field label="Correo del cliente" name="customerEmail" type="email" value={form.customerEmail} onChange={handleChange} />
          <Field label="Teléfono" name="customerPhone" value={form.customerPhone} onChange={handleChange} />
          <Field label="Dirección" name="customerAddress" value={form.customerAddress} onChange={handleChange} />
          {/* El estado del pedido no se elige a mano: avanza solo según lo
              que pasa en Inventario/Fabricación/Logística (ver
              computeOrderStatus en el backend). Un pedido nuevo siempre
              arranca en "Pendiente" (ver emptyForm); al editar, se muestra
              nada más de referencia. */}
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Estado</span>
            <div className="flex h-[38px] items-center rounded-[10px] border border-dashed border-line bg-surface-2 px-3">
              <StatusPill status={form.status} domain="pedido" />
            </div>
          </div>
          <SelectField label="Estado de pago" name="paymentStatus" value={form.paymentStatus} onChange={handleChange} options={PAYMENT} />

          {/* Productos del pedido: se arman en esta mini tabla, así un mismo
              pedido puede llevar varios productos. */}
          <div className="flex flex-col gap-3 rounded-[12px] border border-line p-4 sm:col-span-2">
            <span className="t-label">Productos del pedido</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.3fr_1fr_0.8fr_1fr_auto] sm:items-end">
              <SelectField size="sm" label="Producto" name="product" value={lineForm.product} onChange={handleLineChange} options={PRODUCTS} />
              <SelectField size="sm" label="Color" name="color" value={lineForm.color} onChange={handleLineChange} options={COLORS} placeholder="Sin color" />
              <CompactField label="Cantidad" name="quantity" type="number" min="0" onKeyDown={blockNegativeKey} onWheel={blockWheel} value={lineForm.quantity} onChange={handleLineChange} />
              <CompactField label="Precio unitario" name="unitPrice" type="number" step="0.01" min="0" onKeyDown={blockNegativeKey} onWheel={blockWheel} value={lineForm.unitPrice} onChange={handleLineChange} />
              <Button size="row" onClick={addLine}>
                Agregar
              </Button>
            </div>

            {items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="h-8 border-b border-line-soft">
                      <th className="t-label pr-3">Producto</th>
                      <th className="t-label pr-3">Color</th>
                      <th className="t-label pr-3 text-right">Cant.</th>
                      <th className="t-label pr-3 text-right">Unitario</th>
                      <th className="t-label pr-3 text-right">Subtotal</th>
                      <th className="t-label text-right">Quitar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} className="h-10 border-b border-line-soft last:border-0">
                        <td className="t-row-name pr-3">{it.product}</td>
                        <td className="t-row pr-3">{it.color || "—"}</td>
                        <td className="t-row pr-3 text-right tabular-nums">{fmtNumber(it.quantity)}</td>
                        <td className="t-row pr-3 text-right tabular-nums">{fmtMoney(it.unitPrice)}</td>
                        <td className="t-row pr-3 text-right tabular-nums">{fmtMoney(it.subtotal)}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="rounded-[8px] p-1 text-tone-rose-text transition hover:bg-tone-rose"
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
              <p className="t-aux">Aún no hay productos agregados a este pedido.</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-[12px] bg-surface-2 px-4 py-3 sm:col-span-2">
            <span className="text-[13px] font-semibold text-ink-2">Total del pedido</span>
            <span className="text-[16px] font-bold tabular-nums text-ink">{fmtMoney(total)}</span>
          </div>
        </form>
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Pedidos;
