import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconBox, IconAlert, IconPlus, IconCheck, IconExpand, IconCollapse, IconSearch } from "../lib/icons";
import { macroStatus, getItemStatusCounts, progressSegments, progressCaption, MACRO_STATUS_LABELS } from "../lib/orderProgress";

// Opciones del filtro de estado de la pestaña Inventario > Pedidos (valor -> macroStatus).
const PEDIDOS_STATUS_FILTERS = ["sinVerificar", "verificado", "enviado", "empacado", "parcial", "entregado"];

const UNITS = ["kg", "unidad", "caja", "litro"];
const MATERIAL_TYPES = ["Polimero", "Aditivo", "Tinta", "Insumo"];

const emptyForm = {
  name: "", category: "Materia Prima",
  unit: "kg", stock: "", unitCost: "", location: "",
  materialType: MATERIAL_TYPES[0],
};

// Mismo alto que el buscador (py-1.5 text-xs) para que la barra quede pareja.
const selectFilterClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:border-brand-400";

const STOCK_STATUSES = ["Suficiente", "Insuficiente"];

// Umbral mínimo de existencia según la unidad del artículo: por debajo de
// este número se marca como Insuficiente, de lo contrario Suficiente.
const STOCK_THRESHOLDS = { kg: 11, litro: 11, unidad: 100, caja: 100 };

function stockStatus(item) {
  const threshold = STOCK_THRESHOLDS[item.unit] ?? 0;
  if ((item.stock || 0) < threshold) return "Insuficiente";
  return "Suficiente";
}

// Tabla de artículos de almacén, reutilizada para Materia Prima y Producto
// Terminado (mismas columnas y acciones, solo cambia la lista que reciben).
// showColor: la columna Color solo aplica a Producto Terminado.
// expanded: la barra de búsqueda/filtros solo se muestra (y solo filtra)
// cuando esta tabla está ampliada a pantalla completa.
function WarehouseItemsTable({ items, loading, error, emptyText, onEdit, onDelete, showColor = false, showType = false, expanded = false }) {
  const [search, setSearch] = useState("");
  const [articleFilter, setArticleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const articles = useMemo(
    () => Array.from(new Set(items.map((i) => i.name).filter(Boolean))).sort(),
    [items]
  );
  const locations = useMemo(
    () => Array.from(new Set(items.map((i) => i.location).filter(Boolean))).sort(),
    [items]
  );
  const colors = useMemo(
    () => Array.from(new Set(items.map((i) => i.color).filter(Boolean))).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    if (!expanded) return items;
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.name?.toLowerCase().includes(q)) return false;
      if (showColor && articleFilter && i.name !== articleFilter) return false;
      if (locationFilter && i.location !== locationFilter) return false;
      if (showColor && colorFilter && i.color !== colorFilter) return false;
      if (showType && typeFilter && i.materialType !== typeFilter) return false;
      if (statusFilter && stockStatus(i) !== statusFilter) return false;
      return true;
    });
  }, [items, expanded, search, articleFilter, locationFilter, colorFilter, typeFilter, statusFilter, showColor, showType]);

  const hasActiveFilters = Boolean(search || articleFilter || locationFilter || colorFilter || typeFilter || statusFilter);

  return (
    <>
      {expanded ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <IconSearch width={16} height={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar artículo…"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400"
            />
          </div>
          {showColor ? (
            <select value={articleFilter} onChange={(e) => setArticleFilter(e.target.value)} className={selectFilterClass}>
              <option value="">Artículo: Todos</option>
              {articles.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          ) : null}
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={selectFilterClass}>
            <option value="">Bodega: Todos</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          {showColor ? (
            <select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} className={selectFilterClass}>
              <option value="">Color: Todos</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : null}
          {showType ? (
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectFilterClass}>
              <option value="">Tipo: Todos</option>
              {MATERIAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : null}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectFilterClass}>
            <option value="">Stock: Todos</option>
            {STOCK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasActiveFilters ? (
            <button
              onClick={() => { setSearch(""); setArticleFilter(""); setLocationFilter(""); setColorFilter(""); setTypeFilter(""); setStatusFilter(""); }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      ) : null}

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && filteredItems.length === 0}
        emptyText={expanded && hasActiveFilters ? "Ningún artículo coincide con los filtros." : emptyText}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-4 font-semibold">Artículo</th>
                {showColor ? <th className="pb-3 pr-4 font-semibold">Color</th> : null}
                {showType ? <th className="pb-3 pr-4 font-semibold">Tipo</th> : null}
                <th className="pb-3 pr-4 font-semibold">Existencia</th>
                <th className="pb-3 pr-4 font-semibold">Bodega</th>
                <th className="pb-3 pr-4 font-semibold">Stock</th>
                <th className="pb-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((i) => (
                <tr key={i._id} className="text-slate-600 transition hover:bg-slate-50/60">
                  <td className="py-3 pr-4 font-semibold text-slate-800">{i.name}</td>
                  {showColor ? <td className="py-3 pr-4">{i.color || "—"}</td> : null}
                  {showType ? <td className="py-3 pr-4">{i.materialType || "—"}</td> : null}
                  <td className="py-3 pr-4 tabular-nums">{(i.stock || 0).toLocaleString("es-SV")} {i.unit}</td>
                  <td className="py-3 pr-4">{i.location || "—"}</td>
                  <td className="py-3 pr-4"><StatusPill status={stockStatus(i)} /></td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2 text-xs font-semibold">
                      <button onClick={() => onEdit(i)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                      <button onClick={() => onDelete(i)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncState>
    </>
  );
}

function Inventario() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch("/inventory");
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useFetch("/orders");
  // Bodegas configurables desde Configuración > Bodegas (Parte 8), en vez del
  // arreglo fijo que antes vivía en hooks/useBatchForm.js.
  const { data: warehousesData } = useFetch("/warehouses");
  const warehouses = (Array.isArray(warehousesData) ? warehousesData : []).map((w) => w.name);
  const [activeTab, setActiveTab] = useState("articulos");
  // Cuál de las dos tablas de "Artículos en almacén" está ampliada a pantalla
  // completa (ocupa todo el ancho); null = las dos en columnas, lado a lado.
  const [expandedWarehouseTable, setExpandedWarehouseTable] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState(null);
  const [sending, setSending] = useState(false);
  const [deleteReportModalOpen, setDeleteReportModalOpen] = useState(false);
  const [deleteReportTarget, setDeleteReportTarget] = useState(null);
  const [deletingReport, setDeletingReport] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyWarehouse, setVerifyWarehouse] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sendingToManufacturing, setSendingToManufacturing] = useState(false);
  // Id del pedido cuyos productos se muestran en el modal "Info Pedido" de la
  // tabla de Pedidos (se guarda el id, no el objeto, para que el modal
  // siempre refleje el estado más reciente tras verificar/empacar/enviar).
  const [pedidoInfoOrderId, setPedidoInfoOrderId] = useState(null);
  // Filtros de la pestaña Pedidos: por estado macro (barra de Progreso) y
  // "solo con pendientes" (algún producto todavía sin verificar).
  const [pedidosStatusFilter, setPedidosStatusFilter] = useState("");
  const [pedidosOnlyPending, setPedidosOnlyPending] = useState(false);

  const list = Array.isArray(data) ? data : [];
  const orders = Array.isArray(ordersData) ? ordersData : [];

  // Pedidos solicitados a Inventario desde Pedidos (botón "Solicitar"). Solo
  // informativo: no reserva ni descuenta stock.
  const requestedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.inventoryRequestedAt)
        .sort((a, b) => new Date(b.inventoryRequestedAt) - new Date(a.inventoryRequestedAt)),
    [orders]
  );

  // requestedOrders filtrados por estado macro y/o "solo con pendientes",
  // mismo patrón que filteredItems en WarehouseItemsTable: el filtrado es
  // client-side, sobre datos que ya vinieron de useFetch("/orders").
  const filteredRequestedOrders = useMemo(() => {
    return requestedOrders.filter((o) => {
      if (pedidosStatusFilter && macroStatus(o) !== pedidosStatusFilter) return false;
      if (pedidosOnlyPending && getItemStatusCounts(o).sinVerificar === 0) return false;
      return true;
    });
  }, [requestedOrders, pedidosStatusFilter, pedidosOnlyPending]);

  const hasActivePedidosFilters = Boolean(pedidosStatusFilter || pedidosOnlyPending);

  // Pedido mostrado en el modal "Info Pedido" (se recalcula de requestedOrders
  // en cada render, así refleja al toque cualquier verificación/empaque/envío
  // hecho desde dentro del modal).
  const pedidoInfoOrder = useMemo(
    () => requestedOrders.find((o) => o._id === pedidoInfoOrderId) || null,
    [requestedOrders, pedidoInfoOrderId]
  );

  // Artículos generados automáticamente al confirmar "Reportar" en Fabricación
  // (llevan batchNumber). Se quedan en "Lotes Reportados" para siempre, se
  // hayan enviado o no a almacén.
  const reportedItems = useMemo(
    () =>
      list
        .filter((i) => i.batchNumber)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [list]
  );

  // "Artículos en almacén": solo artículos sin batchNumber. Un lote reportado
  // nunca aparece aquí directamente: al "Enviar" (ver Lotes Reportados), sus
  // unidades se suman al producto terminado existente con mismo artículo,
  // color y bodega, o crean uno nuevo si no hay coincidencia.
  const warehouseItems = useMemo(
    () => list.filter((i) => !i.batchNumber),
    [list]
  );

  // "Artículos en almacén" se divide en dos tablas: Materia Prima y Producto Terminado.
  const rawMaterialItems = useMemo(
    () => warehouseItems.filter((i) => i.category === "Materia Prima"),
    [warehouseItems]
  );
  const finishedItems = useMemo(
    () => warehouseItems.filter((i) => i.category === "Producto Terminado"),
    [warehouseItems]
  );

  // Bodegas donde ya hay stock del producto/color que se está verificando
  // (modal "Verificar producto en inventario").
  const verifyMatches = useMemo(() => {
    if (!verifyTarget) return [];
    return finishedItems.filter(
      (i) => i.name === verifyTarget.item.product && (i.color || "") === (verifyTarget.item.color || "")
    );
  }, [finishedItems, verifyTarget]);

  const verifySelectedMatch = verifyMatches.find((m) => m.location === verifyWarehouse);
  const verifyInsufficientSelected = Boolean(
    verifySelectedMatch && (verifySelectedMatch.stock || 0) < (verifyTarget?.item.quantity || 0)
  );
  // Ninguna bodega tiene suficiente existencia para cubrir lo pedido: se
  // ofrece "Enviar a fabricación" como alternativa a esperar stock.
  const verifyHasSufficientStock = useMemo(() => {
    if (!verifyTarget) return true;
    return verifyMatches.some((m) => (m.stock || 0) >= (verifyTarget.item.quantity || 0));
  }, [verifyMatches, verifyTarget]);

  const fmtDate = (raw) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
  };

  const kpis = useMemo(() => {
    const raw = warehouseItems.filter((i) => i.category === "Materia Prima").length;
    const finished = warehouseItems.filter((i) => i.category === "Producto Terminado").length;
    const low = warehouseItems.filter((i) => stockStatus(i) === "Insuficiente").length;
    const value = warehouseItems.reduce((s, i) => s + (i.stock || 0) * (i.unitCost || 0), 0);
    return { raw, finished, low, value };
  }, [warehouseItems]);

  function openCreate(category = "Materia Prima") {
    setEditingId(null);
    setForm({ ...emptyForm, category, location: warehouses[0] || "" });
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingId(item._id);
    setForm({
      name: item.name || "", category: item.category || "Materia Prima",
      unit: item.unit || "kg",
      stock: item.stock ?? "",
      unitCost: item.unitCost ?? "", location: item.location || warehouses[0] || "",
      materialType: item.materialType || MATERIAL_TYPES[0],
    });
    setModalOpen(true);
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // El costo unitario solo aplica (y solo se pide) a Producto Terminado; para
  // Materia Prima no se envía, así no se pisa un valor que ya tuviera.
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      category: form.category,
      stock: Number(form.stock) || 0,
      unit: form.unit,
      location: form.location,
    };
    if (form.category === "Producto Terminado") {
      payload.unitCost = Number(form.unitCost) || 0;
    } else {
      payload.materialType = form.materialType;
    }
    try {
      if (editingId) {
        await api.put(`/inventory/${editingId}`, payload);
        toast.success("Artículo actualizado");
      } else {
        await api.post("/inventory", payload);
        toast.success("Artículo agregado");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Elimina un artículo de "Artículos en almacén". Si viene de un lote
  // reportado, el backend no borra el registro: solo lo saca de esta tabla,
  // su reporte se mantiene intacto en "Lotes Reportados".
  async function handleDelete(item) {
    const message = item.batchNumber
      ? `¿Eliminar ${item.name} de Artículos en almacén? Su reporte se mantendrá en Lotes Reportados.`
      : `¿Eliminar ${item.name}?`;
    if (!window.confirm(message)) return;
    try {
      await api.del(`/inventory/${item._id}`);
      toast.success("Artículo eliminado de Artículos en almacén");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function openSend(item) {
    setSendTarget(item);
    setSendModalOpen(true);
  }

  // Envía un lote reportado a "Artículos en almacén": si ya existe un
  // producto terminado con el mismo artículo, color y bodega, solo se le
  // suman las unidades reportadas; si no, se crea uno nuevo. El lote se
  // marca como enviado, pero sigue apareciendo (y con su misma existencia)
  // en Lotes Reportados.
  async function confirmSend() {
    setSending(true);
    try {
      await api.patch(`/inventory/${sendTarget._id}/send`);
      toast.success(`${sendTarget.name} enviado a Artículos en almacén`);
      setSendModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  function openDeleteReport(item) {
    setDeleteReportTarget(item);
    setDeleteReportModalOpen(true);
  }

  // Elimina un lote reportado: el lote en Fabricación queda igual (su
  // producción y estado no cambian), solo deja de estar "reportado" (vuelve
  // a mostrar el botón "Reportar"). Si ya se había enviado a almacén, ese
  // stock se conserva sin cambios en Artículos en almacén; si no, se borra.
  async function confirmDeleteReport() {
    setDeletingReport(true);
    try {
      await api.del(`/inventory/${deleteReportTarget._id}/report`);
      toast.success(`Reporte de ${deleteReportTarget.batchNumber} eliminado`);
      setDeleteReportModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeletingReport(false);
    }
  }

  // Elimina un pedido de esta pestaña por completo: si algún producto ya
  // estaba verificado, le devuelve las unidades al stock de esa bodega y
  // desmarca verified/packed de todos los productos (el backend se encarga).
  // Así, si el pedido se vuelve a solicitar después, aparece limpio ("Sin
  // Verificar") en vez de arrastrar el estado anterior. En Pedidos vuelve a
  // mostrar el botón "Solicitar".
  async function handleCancelRequest(o) {
    if (!window.confirm(`¿Eliminar ${o.orderNumber} de Pedidos? Se borra todo su rastro de verificación aquí.`)) return;
    try {
      await api.del(`/orders/${o._id}/request-inventory`);
      toast.success("Pedido eliminado de la lista");
      refetchOrders();
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function openPedidoInfo(order) {
    setPedidoInfoOrderId(order._id);
  }

  // Se abre desde el modal "Info Pedido": cierra ese modal para dar paso al
  // de verificación (así no quedan dos modales encimados).
  function openVerify(row) {
    setPedidoInfoOrderId(null);
    setVerifyTarget(row);
    setVerifyWarehouse("");
    setVerifyModalOpen(true);
  }

  // Confirma la bodega elegida en el modal: resta la cantidad pedida del
  // stock de ese producto/color en esa bodega y marca la línea como Lista.
  async function confirmVerify() {
    if (!verifyTarget || !verifyWarehouse) return;
    setVerifying(true);
    try {
      await api.patch(`/orders/${verifyTarget.order._id}/items/${verifyTarget.index}/verify`, {
        warehouse: verifyWarehouse,
      });
      toast.success(`${verifyTarget.item.product} verificado`);
      setVerifyModalOpen(false);
      refetchOrders();
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  }

  // Envía la línea a Fabricación cuando no hay stock suficiente en ninguna
  // bodega: no toca inventario, solo marca la línea como enviada para que
  // aparezca en Fabricación > Pedidos. Aquí queda mostrada como "Enviado".
  async function sendToManufacturing() {
    if (!verifyTarget) return;
    setSendingToManufacturing(true);
    try {
      await api.patch(`/orders/${verifyTarget.order._id}/items/${verifyTarget.index}/send-manufacturing`);
      toast.success(`${verifyTarget.item.product} enviado a fabricación`);
      setVerifyModalOpen(false);
      refetchOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingToManufacturing(false);
    }
  }

  // Empaca un producto ya verificado: el pedido pasa a "Empacado" (visible
  // así también en Pedidos y Logística, lista para asignar motorista).
  async function handlePack(row) {
    if (
      !window.confirm(
        `¿Marcar ${row.item.product} como empacado? El pedido ${row.order.orderNumber} pasará a "Empacado".`
      )
    )
      return;
    try {
      await api.patch(`/orders/${row.order._id}/items/${row.index}/pack`);
      toast.success(`${row.item.product} empacado`);
      refetchOrders();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Materia prima" value={kpis.raw} icon={IconBox} trend={{ tone: "blue", label: "insumos" }} />
        <KpiCard label="Productos terminados" value={kpis.finished} icon={IconBox} trend={{ tone: "blue", label: "referencias" }} />
        <KpiCard label="Stock bajo" value={kpis.low} icon={IconAlert} trend={{ tone: kpis.low ? "yellow" : "green", label: kpis.low ? "Reponer" : "OK" }} />
        <KpiCard label="Valor del inventario" value={`$${kpis.value.toLocaleString("es-SV", { maximumFractionDigits: 0 })}`} icon={IconBox} trend={{ tone: "green", label: "estimado" }} />
      </div>

      {/* Selector de tabla: Artículos en almacén / Lotes Reportados */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setActiveTab("articulos")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "articulos" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Artículos en almacén
        </button>
        <button
          onClick={() => setActiveTab("lotes")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "lotes" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Lotes Reportados
        </button>
        <button
          onClick={() => setActiveTab("pedidos")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "pedidos" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Pedidos
        </button>
      </div>

      {activeTab === "articulos" ? (
        <div className={expandedWarehouseTable ? "space-y-6" : "grid grid-cols-1 items-start gap-4 lg:grid-cols-2"}>
          {expandedWarehouseTable !== "finished" ? (
            <SectionCard
              title="Materia Prima"
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedWarehouseTable((cur) => (cur === "raw" ? null : "raw"))}
                    title={expandedWarehouseTable === "raw" ? "Ver en columnas" : "Ampliar tabla"}
                    className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                  >
                    {expandedWarehouseTable === "raw" ? <IconCollapse width={16} height={16} /> : <IconExpand width={16} height={16} />}
                  </button>
                  <button onClick={() => openCreate("Materia Prima")} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
                    <IconPlus width={16} height={16} /> Agregar
                  </button>
                </div>
              }
            >
              <WarehouseItemsTable
                items={rawMaterialItems}
                loading={loading}
                error={error}
                emptyText="No hay materia prima en almacén."
                onEdit={openEdit}
                onDelete={handleDelete}
                showType
                expanded={expandedWarehouseTable === "raw"}
              />
            </SectionCard>
          ) : null}

          {expandedWarehouseTable !== "raw" ? (
            <SectionCard
              title="Producto Terminado"
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedWarehouseTable((cur) => (cur === "finished" ? null : "finished"))}
                    title={expandedWarehouseTable === "finished" ? "Ver en columnas" : "Ampliar tabla"}
                    className="rounded-lg bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                  >
                    {expandedWarehouseTable === "finished" ? <IconCollapse width={16} height={16} /> : <IconExpand width={16} height={16} />}
                  </button>
                  <button onClick={() => openCreate("Producto Terminado")} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
                    <IconPlus width={16} height={16} /> Agregar
                  </button>
                </div>
              }
            >
              <WarehouseItemsTable
                items={finishedItems}
                loading={loading}
                error={error}
                emptyText="No hay productos terminados en almacén."
                onEdit={openEdit}
                onDelete={handleDelete}
                showColor
                expanded={expandedWarehouseTable === "finished"}
              />
            </SectionCard>
          ) : null}
        </div>
      ) : activeTab === "lotes" ? (
        <SectionCard
          title="Lotes Reportados"
          action={
            <button onClick={() => navigate("/fabricacion")} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100">
              Ir a Fabricación
            </button>
          }
        >
          <AsyncState
            loading={loading}
            error={error}
            empty={!loading && reportedItems.length === 0}
            emptyText="Aún no hay lotes reportados desde Fabricación."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Lote</th>
                    <th className="pb-3 pr-4 font-semibold">Artículo</th>
                    <th className="pb-3 pr-4 font-semibold">Color</th>
                    <th className="pb-3 pr-4 font-semibold">Categoría</th>
                    <th className="pb-3 pr-4 font-semibold">Existencia</th>
                    <th className="pb-3 pr-4 font-semibold">Bodega</th>
                    <th className="pb-3 pr-4 font-semibold">Fecha Reportaje</th>
                    <th className="pb-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportedItems.map((i) => (
                    <tr key={i._id} className="text-slate-600 transition hover:bg-slate-50/60">
                      <td className="py-3 pr-4 font-semibold text-slate-800">{i.batchNumber}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-800">{i.name}</td>
                      <td className="py-3 pr-4">{i.color || "—"}</td>
                      <td className="py-3 pr-4">{i.category}</td>
                      <td className="py-3 pr-4 tabular-nums">{(i.stock || 0).toLocaleString("es-SV")} {i.unit}</td>
                      <td className="py-3 pr-4">{i.location || "—"}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(i.updatedAt)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs font-semibold">
                          {i.sentToWarehouse ? (
                            <StatusPill status="Enviado" tone="green" />
                          ) : (
                            <button onClick={() => openSend(i)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Enviar</button>
                          )}
                          <button onClick={() => openDeleteReport(i)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </SectionCard>
      ) : (
        <SectionCard
          title="Pedidos"
          action={
            <button onClick={() => navigate("/pedidos")} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100">
              Ir a Pedidos
            </button>
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select
              value={pedidosStatusFilter}
              onChange={(e) => setPedidosStatusFilter(e.target.value)}
              className={selectFilterClass}
            >
              <option value="">Estado: Todos</option>
              {PEDIDOS_STATUS_FILTERS.map((key) => (
                <option key={key} value={key}>{MACRO_STATUS_LABELS[key]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={pedidosOnlyPending}
                onChange={(e) => setPedidosOnlyPending(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              Solo con pendientes
            </label>
            {hasActivePedidosFilters ? (
              <button
                onClick={() => { setPedidosStatusFilter(""); setPedidosOnlyPending(false); }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>

          <AsyncState
            loading={ordersLoading}
            error={ordersError}
            empty={!ordersLoading && filteredRequestedOrders.length === 0}
            emptyText={
              hasActivePedidosFilters && requestedOrders.length > 0
                ? "Ningún pedido coincide con los filtros."
                : "Aún no hay pedidos solicitados a inventario."
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Pedido</th>
                    <th className="pb-3 pr-4 font-semibold">Cliente</th>
                    <th className="pb-3 pr-4 font-semibold">Info Pedido</th>
                    <th className="pb-3 pr-4 font-semibold">Progreso</th>
                    <th className="pb-3 pr-4 font-semibold">Fecha Solicitado</th>
                    <th className="pb-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequestedOrders.map((order) => {
                    const segments = progressSegments(order);
                    const caption = progressCaption(order);
                    return (
                      <tr key={order._id} className="text-slate-600 transition hover:bg-slate-50/60">
                        <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap">{order.orderNumber}</td>
                        <td className="py-3 pr-4">{order.customer?.name || "—"}</td>
                        <td className="py-3 pr-4">
                          <button onClick={() => openPedidoInfo(order)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">Ver</button>
                        </td>
                        <td className="py-3 pr-4 min-w-[200px]">
                          <div>
                            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              {segments.map((seg) => (
                                <div
                                  key={seg.key}
                                  className={seg.colorClass}
                                  style={{ width: `${seg.pct}%` }}
                                  title={`${seg.count} ${seg.label}`}
                                />
                              ))}
                            </div>
                            <p className="mt-1 text-[11px] leading-tight text-slate-500">{caption || "Sin productos"}</p>
                          </div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(order.inventoryRequestedAt)}</td>
                        <td className="py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5 text-xs font-semibold">
                            <button onClick={() => handleCancelRequest(order)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
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
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          (editingId ? "Editar " : "Agregar ") +
          (form.category === "Producto Terminado" ? "producto terminado" : "materia prima")
        }
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="inv-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="inv-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Artículo" name="name" value={form.name} onChange={handleChange} required />
          <Field label="Existencia" name="stock" type="number" value={form.stock} onChange={handleChange} required />
          <SelectField label="Unidad" name="unit" value={form.unit} onChange={handleChange} options={UNITS} />
          <SelectField label="Bodega" name="location" value={form.location} onChange={handleChange} options={warehouses} required />
          {form.category === "Producto Terminado" ? (
            <Field label="Costo unitario ($)" name="unitCost" type="number" step="0.01" value={form.unitCost} onChange={handleChange} />
          ) : (
            <SelectField label="Tipo" name="materialType" value={form.materialType} onChange={handleChange} options={MATERIAL_TYPES} required />
          )}
        </form>
      </Modal>

      <Modal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        title="Enviar a Artículos en almacén"
        footer={
          <>
            <button onClick={() => setSendModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={confirmSend} disabled={sending} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {sending ? "Enviando…" : "Confirmar envío"}
            </button>
          </>
        }
      >
        {sendTarget ? (
          <p className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-800">
            Vas a enviar <strong>{sendTarget.name}</strong> (lote {sendTarget.batchNumber}) a Artículos en almacén.
            Si ya existe un producto terminado con el mismo artículo, color y bodega, sus {(sendTarget.stock || 0).toLocaleString("es-SV")} {sendTarget.unit}
            se sumarán a la existencia de ese producto; si no existe, se creará uno nuevo. Aquí en Lotes Reportados no cambia nada.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={deleteReportModalOpen}
        onClose={() => setDeleteReportModalOpen(false)}
        title="Eliminar lote reportado"
        footer={
          <>
            <button onClick={() => setDeleteReportModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={confirmDeleteReport} disabled={deletingReport} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {deletingReport ? "Eliminando…" : "Eliminar"}
            </button>
          </>
        }
      >
        {deleteReportTarget ? (
          <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
            Vas a eliminar el reporte de <strong>{deleteReportTarget.name}</strong> (lote {deleteReportTarget.batchNumber}).
            El lote en Fabricación queda igual (su producción y estado no cambian), solo deja de estar reportado.
            {deleteReportTarget.sentToWarehouse
              ? " Como ya se había enviado a almacén, ese stock se conserva sin cambios en Artículos en almacén."
              : " Como todavía no se había enviado a almacén, no queda ningún stock que conservar."}
          </p>
        ) : null}
      </Modal>

      <Modal
        open={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        title="Verificar producto en inventario"
        footer={
          <>
            <button onClick={() => setVerifyModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            {!verifyHasSufficientStock ? (
              <button
                onClick={sendToManufacturing}
                disabled={sendingToManufacturing}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {sendingToManufacturing ? "Enviando…" : "Enviar a fabricación"}
              </button>
            ) : null}
            <button
              onClick={confirmVerify}
              disabled={verifying || !verifyWarehouse || verifyInsufficientSelected}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {verifying ? "Verificando…" : "Confirmar"}
            </button>
          </>
        }
      >
        {verifyTarget ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Buscando <strong>{verifyTarget.item.quantity} {verifyTarget.item.product}</strong>
              {verifyTarget.item.color ? ` (${verifyTarget.item.color})` : ""} para el pedido{" "}
              <strong>{verifyTarget.order.orderNumber}</strong> en las bodegas disponibles.
            </p>
            {verifyMatches.length === 0 ? (
              <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                No se encontró este producto en ninguna bodega de Artículos en almacén.
              </p>
            ) : (
              <div className="space-y-2">
                {verifyMatches.map((m) => {
                  const insufficient = (m.stock || 0) < verifyTarget.item.quantity;
                  return (
                    <label
                      key={m._id}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition ${
                        verifyWarehouse === m.location ? "border-brand-400 bg-brand-50" : "border-slate-200"
                      } ${insufficient ? "opacity-60" : "cursor-pointer hover:border-brand-300"}`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="verify-warehouse"
                          value={m.location}
                          checked={verifyWarehouse === m.location}
                          disabled={insufficient}
                          onChange={(e) => setVerifyWarehouse(e.target.value)}
                        />
                        <span className="font-semibold text-slate-800">{m.location || "—"}</span>
                      </span>
                      <span className={insufficient ? "font-semibold text-red-600" : "text-slate-500"}>
                        {(m.stock || 0).toLocaleString("es-SV")} {m.unit} disponibles
                        {insufficient ? " · insuficiente" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!pedidoInfoOrder}
        onClose={() => setPedidoInfoOrderId(null)}
        title={`Productos del pedido ${pedidoInfoOrder?.orderNumber || ""}`}
        size="lg"
        footer={
          <button onClick={() => setPedidoInfoOrderId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button>
        }
      >
        {pedidoInfoOrder?.items?.length ? (
          <div className="space-y-2">
            {pedidoInfoOrder.items.map((it, idx) => {
              const row = { order: pedidoInfoOrder, item: it, index: idx };
              // Mismo orden de prioridad que en todos lados (empacado > verificado
              // > enviado a fabricación > sin verificar), "Entregado" aparte
              // porque es del pedido completo, no de la línea.
              const itemStatus = pedidoInfoOrder.delivery?.driver
                ? "Entregado"
                : it.packed
                ? "Empacado"
                : it.verified
                ? "Verificado"
                : it.sentToManufacturing
                ? "En Fabricación"
                : "Sin Verificar";
              // La etiqueta de estado siempre va, nunca queda vacía; el botón de
              // la siguiente acción (si aplica) va justo al lado.
              return (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800">{it.product}{it.color ? ` · ${it.color}` : ""}</p>
                    <p className="text-xs text-slate-500">{it.quantity} unidades</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {itemStatus === "Empacado" || itemStatus === "Entregado" ? (
                      <IconCheck width={14} height={14} className="text-emerald-600" />
                    ) : null}
                    <StatusPill status={itemStatus} />
                    {itemStatus === "Sin Verificar" ? (
                      <button onClick={() => openVerify(row)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">Verificar</button>
                    ) : itemStatus === "En Fabricación" ? (
                      <span className="text-xs text-slate-400">esperando lote</span>
                    ) : itemStatus === "Verificado" ? (
                      <button onClick={() => handlePack(row)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">Empacar</button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Este pedido no tiene productos.</p>
        )}
      </Modal>
    </div>
  );
}

export default Inventario;