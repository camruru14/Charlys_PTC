import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useBatchForm } from "../hooks/useBatchForm";
import { useDailyBatchForm } from "../hooks/useDailyBatchForm";
import { useConfirm } from "../hooks/useConfirm";
import { useDateRange } from "../context/DateRangeContext";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import BatchFormModal from "../components/batches/BatchFormModal";
import PedidoBatchFormModal from "../components/batches/PedidoBatchFormModal";
import ReportBatchModal from "../components/batches/ReportBatchModal";
import UndoReportModal from "../components/batches/UndoReportModal";
import DailyBatchFormModal from "../components/batches/DailyBatchFormModal";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { FilterSelect } from "../components/ui/Field";
import { IconFactory, IconAlert, IconCheck, IconPlus } from "../lib/icons";
import {
  getManufacturingCounts,
  manufacturingMacroStatus,
  manufacturingProgressSegments,
  manufacturingProgressCaption,
  MANUFACTURING_STATUS_LABELS,
  getPedidoBatchCounts,
  pedidoBatchMacroStatus,
  pedidoBatchProgressSegments,
  pedidoBatchProgressCaption,
  PEDIDO_BATCH_STATUS_LABELS,
} from "../lib/manufacturingProgress";

const MANUFACTURING_STATUS_FILTERS = ["enCola", "enFabricacion", "parcial"];
const PEDIDO_BATCH_STATUS_FILTERS = ["programado", "enProceso", "completado", "detenido", "parcial"];

// Mismo alto que el buscador (py-1.5 text-xs), igual que selectFilterClass en Inventario.jsx.
const selectFilterClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:border-brand-400";

function Fabricacion() {
  const navigate = useNavigate();
  const range = useDateRange();
  const { data: batches, loading, error, refetch } = useFetch("/productionBatches");
  const { data: dailyBatches, loading: dailyLoading, error: dailyError, refetch: refetchDaily } = useFetch("/dailyBatches");
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchManufacturingOrders } = useFetch("/orders");
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("fabricacion");
  // Se guarda el id del pedido, no el objeto, para que el modal "Ver" de
  // "Por fabricar" siempre refleje el estado más reciente de orders.
  const [manufacturingInfoOrderId, setManufacturingInfoOrderId] = useState(null);
  // Cuál de los dos modales de editar/crear lote mostrar: "diario" (Lotes de
  // fabricación, sin Meta) o "pedido" (Fabricación de pedidos, con Meta de
  // solo lectura). Ambos comparten el mismo estado de useBatchForm, solo
  // cambia qué componente se monta.
  const [batchModalVariant, setBatchModalVariant] = useState("diario");
  const [manufacturingStatusFilter, setManufacturingStatusFilter] = useState("");
  const [manufacturingOnlyPending, setManufacturingOnlyPending] = useState(false);
  // Mismo patrón para el modal "Ver" y los filtros de "Fabricación de pedidos".
  const [pedidoBatchInfoOrderId, setPedidoBatchInfoOrderId] = useState(null);
  const [pedidoBatchStatusFilter, setPedidoBatchStatusFilter] = useState("");
  const [pedidoBatchOnlyPending, setPedidoBatchOnlyPending] = useState(false);

  // Lista completa (sin filtrar por fecha): necesaria para numerar el siguiente lote
  const list = Array.isArray(batches) ? batches : [];
  // Lista mostrada en la sección: acotada al rango de fechas seleccionado
  const rangeList = useMemo(() => filterBatches(list, defaultBatchFilters, range), [list, range]);
  // "Lotes de fabricación" solo muestra los lotes normales; los creados desde
  // "Fabricar" en Pedidos (categoría "Pedido") se muestran aparte, en
  // "Fabricación de pedidos".
  const diarioRangeList = useMemo(() => rangeList.filter((b) => b.category !== "Pedido"), [rangeList]);
  const pedidoRangeList = useMemo(() => rangeList.filter((b) => b.category === "Pedido"), [rangeList]);
  const dailyList = Array.isArray(dailyBatches) ? dailyBatches : [];
  const orders = Array.isArray(ordersData) ? ordersData : [];

  // Pedidos enviados desde Inventario > Pedidos cuando no había stock
  // disponible (botón "Enviar a fabricación"). Agrupados por pedido: cada
  // grupo trae todas sus líneas enviadas a fabricación, para mostrar una
  // sola fila por pedido en la tabla (igual que "Pedidos" en Inventario).
  const manufacturingGroups = useMemo(() => {
    const groups = [];
    orders.forEach((o) => {
      const lines = [];
      (o.items || []).forEach((item, index) => {
        if (item.sentToManufacturing) lines.push({ item, index });
      });
      if (lines.length) groups.push({ order: o, lines });
    });
    const latest = (group) => Math.max(...group.lines.map((l) => new Date(l.item.sentToManufacturingAt).getTime()));
    return groups.sort((a, b) => latest(b) - latest(a));
  }, [orders]);

  // Pedido mostrado en el modal "Ver" de "Por fabricar" (se recalcula de
  // manufacturingGroups para reflejar el estado más reciente sin cerrar el modal).
  const manufacturingInfoGroup = useMemo(
    () => manufacturingGroups.find((g) => g.order._id === manufacturingInfoOrderId) || null,
    [manufacturingGroups, manufacturingInfoOrderId]
  );

  // manufacturingGroups filtrados por estado macro y/o "solo con pendientes",
  // mismo patrón que filteredRequestedOrders en Inventario.jsx.
  const filteredManufacturingGroups = useMemo(() => {
    return manufacturingGroups.filter((g) => {
      if (manufacturingStatusFilter && manufacturingMacroStatus(g) !== manufacturingStatusFilter) return false;
      if (manufacturingOnlyPending && getManufacturingCounts(g).enCola === 0) return false;
      return true;
    });
  }, [manufacturingGroups, manufacturingStatusFilter, manufacturingOnlyPending]);

  const hasActiveManufacturingFilters = Boolean(manufacturingStatusFilter || manufacturingOnlyPending);

  // Para cada lote de "Fabricación de pedidos" (category "Pedido"), a qué
  // pedido/línea pertenece: item.manufacturingBatch viene poblado ({_id,
  // batchNumber, status}) o, si no, como el ObjectId crudo — se soportan
  // ambos casos. Se usa para decidir qué acción mostrar en esa tabla
  // (Empacar / ya empacado / esperando que se complete el lote).
  const pedidoLineByBatchId = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      (o.items || []).forEach((item, index) => {
        const batchId = item.manufacturingBatch?._id || item.manufacturingBatch;
        if (batchId) map.set(String(batchId), { order: o, item, index });
      });
    });
    return map;
  }, [orders]);

  // "Fabricación de pedidos" agrupada por pedido: cada grupo trae todos sus
  // lotes (category "Pedido"), resueltos vía pedidoLineByBatchId. Los lotes
  // sin pedido vinculado (no debería pasar, pero puede quedar suelto) se
  // agrupan aparte en una sola fila "Sin pedido vinculado".
  const pedidoGroups = useMemo(() => {
    const map = new Map();
    const unlinked = [];
    pedidoRangeList.forEach((batch) => {
      const pedidoLine = pedidoLineByBatchId.get(String(batch._id));
      if (!pedidoLine) {
        unlinked.push({ batch, item: null, index: null });
        return;
      }
      const { order, item, index } = pedidoLine;
      if (!map.has(order._id)) map.set(order._id, { order, batches: [] });
      map.get(order._id).batches.push({ batch, item, index });
    });
    const latest = (group) => Math.max(...group.batches.map(({ batch }) => new Date(batch.startDate || batch.createdAt).getTime()));
    const groups = Array.from(map.values()).sort((a, b) => latest(b) - latest(a));
    if (unlinked.length) groups.push({ order: { _id: "__unlinked__", orderNumber: "Sin pedido vinculado" }, batches: unlinked });
    return groups;
  }, [pedidoRangeList, pedidoLineByBatchId]);

  // Pedido mostrado en el modal "Ver" de "Fabricación de pedidos" (se
  // recalcula de pedidoGroups para reflejar el estado más reciente sin
  // cerrar el modal).
  const pedidoBatchInfoGroup = useMemo(
    () => pedidoGroups.find((g) => g.order._id === pedidoBatchInfoOrderId) || null,
    [pedidoGroups, pedidoBatchInfoOrderId]
  );

  // pedidoGroups filtrados por estado macro y/o "solo con pendientes":
  // "pendiente" acá es "no 100% completado" (detenido también cuenta como
  // pendiente de atención, no solo lo que falta empezar).
  const filteredPedidoGroups = useMemo(() => {
    return pedidoGroups.filter((g) => {
      if (pedidoBatchStatusFilter && pedidoBatchMacroStatus(g) !== pedidoBatchStatusFilter) return false;
      if (pedidoBatchOnlyPending && getPedidoBatchCounts(g).completado === g.batches.length) return false;
      return true;
    });
  }, [pedidoGroups, pedidoBatchStatusFilter, pedidoBatchOnlyPending]);

  const hasActivePedidoBatchFilters = Boolean(pedidoBatchStatusFilter || pedidoBatchOnlyPending);

  // Cambiar el status/producedQuantity de un lote (crear/editar/eliminar/
  // reportar desde "Fabricación de pedidos" o "Lotes de fabricación") puede
  // afectar la barra de progreso de "Por fabricar", que lee
  // item.manufacturingBatch.status desde /orders (una copia poblada, no
  // reactiva al lote). Por eso useBatchForm refetch-ea ambas listas, así la
  // barra refleja el cambio de estado sin recargar la página.
  function refetchBatchesAndOrders() {
    refetch();
    refetchManufacturingOrders();
  }

  const {
    modalOpen,
    setModalOpen,
    editingId,
    form,
    saving,
    operators,
    warehouses,
    openCreate,
    openEdit,
    handleChange,
    handleSubmit,
    handleDelete,
    reportModalOpen,
    setReportModalOpen,
    reportTarget,
    reportForm,
    reporting,
    openReport,
    handleReportChange,
    submitReport,
    undoReportModalOpen,
    setUndoReportModalOpen,
    undoReportTarget,
    undoingReport,
    openUndoReport,
    confirmUndoReport,
    confirmProps: batchConfirmProps,
  } = useBatchForm(list, refetchBatchesAndOrders);

  const {
    modalOpen: dailyModalOpen,
    setModalOpen: setDailyModalOpen,
    editingId: dailyEditingId,
    form: dailyForm,
    saving: dailySaving,
    openCreate: openDailyCreate,
    openEdit: openDailyEdit,
    handleChange: handleDailyChange,
    handleSubmit: handleDailySubmit,
    handleDelete: handleDailyDelete,
    handleSchedule,
    confirmProps: dailyConfirmProps,
  } = useDailyBatchForm(dailyList, refetchDaily, () => {
    refetch();
    setActiveTab("fabricacion");
  });

  // Confirmaciones propias de esta página (Fabricar / Empacar / Eliminar de
  // Fabricación > Pedidos), separadas de las de useBatchForm/useDailyBatchForm.
  const { confirm, confirmProps: pageConfirmProps } = useConfirm();

  // Abrir el modal automáticamente si venimos de "+ Nuevo Lote" del Sidebar
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setBatchModalVariant("diario");
      openCreate();
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // startDate se guarda como medianoche UTC del día elegido (fecha sin hora),
  // así que se lee en UTC para no correrla un día en husos detrás de UTC.
  // createdAt sí es un instante real, por eso ese se lee en la zona local.
  const fmtDate = (b) => {
    const raw = b.startDate || b.createdAt;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    const opts = { day: "2-digit", month: "short", year: "numeric" };
    if (b.startDate) opts.timeZone = "UTC";
    return d.toLocaleDateString("es-SV", opts);
  };

  const fmtDailyDate = (b) => {
    const d = new Date(b.date);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  };

  const fmtOrderDate = (raw) => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Crea el lote de fabricación correspondiente (categoría "Pedido", meta =
  // cantidad pedida) y lo enlaza a esta línea, que pasa a mostrarse como
  // "Fabricado" en vez del botón.
  async function handleManufacture(row) {
    const ok = await confirm(
      `¿Fabricar ${row.item.quantity} ${row.item.product}${row.item.color ? ` (${row.item.color})` : ""} para el pedido ${row.order.orderNumber}? Se creará un lote en Lotes de fabricación.`,
      { confirmLabel: "Fabricar" }
    );
    if (!ok) return;
    try {
      const res = await api.patch(`/orders/${row.order._id}/items/${row.index}/manufacture`);
      toast.success(res?.batchNumber ? `Lote ${res.batchNumber} creado` : "Lote creado");
      refetch();
      refetchManufacturingOrders();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Empaca un producto fabricado exclusivamente para este pedido (lote
  // category "Pedido" ya Completado): no pasa por Inventario, ese stock
  // nunca se comparte con el resto de Producto Terminado.
  async function handlePackManufactured(pedidoLine) {
    if (!pedidoLine) return;
    const { order, item, index } = pedidoLine;
    if (!(await confirm(`¿Marcar ${item.product} como empacado? Quedará listo para que Logística lo recoja en Fabricación.`, { confirmLabel: "Empacar" }))) return;
    try {
      await api.patch(`/orders/${order._id}/items/${index}/pack-manufactured`);
      toast.success(`${item.product} empacado`);
      refetch();
      refetchManufacturingOrders();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Quita la línea de Fabricación > Pedidos: deshace el envío a fabricación,
  // así el producto vuelve a aparecer "Sin Verificar" en Inventario >
  // Pedidos. Si ya se había fabricado, el lote creado se conserva en
  // Fabricación de pedidos, solo se desvincula de este pedido.
  async function handleRemoveManufacturingLine(row) {
    const msg = row.item.manufacturingBatch
      ? `¿Eliminar ${row.item.product} de Fabricación > Pedidos? El lote ${row.item.manufacturingBatch.batchNumber || ""} ya fabricado se conserva en "Fabricación de pedidos", solo se desvincula de este pedido.`
      : `¿Eliminar ${row.item.product} de Fabricación > Pedidos? Podrá volver a solicitarse desde Inventario.`;
    if (!(await confirm(msg, { danger: true }))) return;
    try {
      await api.del(`/orders/${row.order._id}/items/${row.index}/send-manufacturing`);
      toast.success(`${row.item.product} eliminado de Fabricación > Pedidos`);
      refetchManufacturingOrders();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const kpis = useMemo(() => {
    const produced = rangeList.reduce((s, b) => s + (b.producedQuantity || 0), 0);
    const inProcess = rangeList.filter((b) => b.status === "En Proceso").length;
    const stopped = rangeList.filter((b) => b.status === "Detenido").length;
    return { produced, inProcess, stopped };
  }, [rangeList]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Producción total" value={kpis.produced.toLocaleString("es-SV")} icon={IconFactory} trend={{ tone: "blue", label: `${rangeList.length} lotes` }} />
        <KpiCard label="Lotes en proceso" value={kpis.inProcess} icon={IconCheck} trend={{ tone: "blue", label: "activos" }} />
        <KpiCard label="Lotes detenidos" value={kpis.stopped} icon={IconAlert} trend={{ tone: kpis.stopped ? "red" : "green", label: kpis.stopped ? "Alerta" : "OK" }} />
      </div>

      {/* Selector de tabla: Lotes de fabricación / Lotes Diarios / Por
          fabricar / Fabricación de pedidos. Con 4 pestañas (la última
          bastante larga) no cabe en pantallas chicas — overflow-x-auto lo
          deja como scroll horizontal contenido en vez de desbordar la
          página, mismo criterio que las tablas. */}
      <div className="overflow-x-auto">
        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab("fabricacion")}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "fabricacion" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Lotes de fabricación
          </button>
          <button
            onClick={() => setActiveTab("diario")}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "diario" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Lotes Diarios
          </button>
          <button
            onClick={() => setActiveTab("pedidos")}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "pedidos" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Por fabricar
          </button>
          <button
            onClick={() => setActiveTab("fabricacionPedidos")}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "fabricacionPedidos" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Fabricación de pedidos
          </button>
        </div>
      </div>

      {activeTab === "fabricacion" ? (
        <SectionCard
          title="Lotes de fabricación"
          action={
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/fabricacion/historial")} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100">
                Ver todo
              </button>
              <button
                onClick={() => { setBatchModalVariant("diario"); openCreate(); }}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                <IconPlus width={16} height={16} /> Nuevo Lote
              </button>
            </div>
          }
        >
          <AsyncState loading={loading} error={error} empty={!loading && diarioRangeList.length === 0} emptyText="No hay lotes en el rango seleccionado.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Lote</th>
                    <th className="pb-3 pr-4 font-semibold">Fecha</th>
                    <th className="pb-3 pr-4 font-semibold">Producto</th>
                    <th className="pb-3 pr-4 font-semibold">Color</th>
                    <th className="pb-3 pr-4 font-semibold">Línea</th>
                    <th className="pb-3 pr-4 font-semibold">Producido</th>
                    <th className="pb-3 pr-4 font-semibold">Estado</th>
                    <th className="pb-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diarioRangeList.map((b) => (
                    <tr key={b._id} className="text-slate-600 transition hover:bg-slate-50/60">
                      <td className="py-3 pr-4 font-semibold text-slate-800">{b.batchNumber}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{fmtDate(b)}</td>
                      <td className="py-3 pr-4">{b.product}</td>
                      <td className="py-3 pr-4">{b.color || "—"}</td>
                      <td className="py-3 pr-4">{b.productionLine || "—"}</td>
                      <td className="py-3 pr-4 tabular-nums">{(b.producedQuantity || 0).toLocaleString("es-SV")}</td>
                      <td className="py-3 pr-4"><StatusPill status={b.status} /></td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs font-semibold">
                          {b.lastReportedAt ? (
                            <button onClick={() => openUndoReport(b)} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700 hover:bg-emerald-100">
                              <IconCheck width={14} height={14} /> Reportado
                            </button>
                          ) : (
                            <button onClick={() => openReport(b)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Reportar</button>
                          )}
                          <button onClick={() => { setBatchModalVariant("diario"); openEdit(b); }} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                          <button onClick={() => handleDelete(b)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </SectionCard>
      ) : activeTab === "diario" ? (
        <SectionCard
          title="Lotes Diarios"
          action={
            <button onClick={openDailyCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <IconPlus width={16} height={16} /> Nuevo Lote Diario
            </button>
          }
        >
          <AsyncState loading={dailyLoading} error={dailyError} empty={!dailyLoading && dailyList.length === 0} emptyText="No hay lotes diarios.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">ID</th>
                    <th className="pb-3 pr-4 font-semibold">Fecha</th>
                    <th className="pb-3 pr-4 font-semibold">Producto</th>
                    <th className="pb-3 pr-4 font-semibold">Color</th>
                    <th className="pb-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyList.map((b) => (
                    <tr key={b._id} className="text-slate-600 transition hover:bg-slate-50/60">
                      <td className="py-3 pr-4 font-semibold text-slate-800">{b.dailyBatchNumber}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{fmtDailyDate(b)}</td>
                      <td className="py-3 pr-4">{b.product}</td>
                      <td className="py-3 pr-4">{b.color || "—"}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs font-semibold">
                          <button onClick={() => handleSchedule(b)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Programar</button>
                          <button onClick={() => openDailyEdit(b)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                          <button onClick={() => handleDailyDelete(b)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AsyncState>
        </SectionCard>
      ) : activeTab === "pedidos" ? (
        <SectionCard title="Por fabricar">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <FilterSelect
              value={manufacturingStatusFilter}
              onChange={(e) => setManufacturingStatusFilter(e.target.value)}
              className={selectFilterClass}
              options={[{ value: "", label: "Estado: Todos" }, ...MANUFACTURING_STATUS_FILTERS.map((key) => ({ value: key, label: MANUFACTURING_STATUS_LABELS[key] }))]}
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={manufacturingOnlyPending}
                onChange={(e) => setManufacturingOnlyPending(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              Solo con pendientes
            </label>
            {hasActiveManufacturingFilters ? (
              <button
                onClick={() => { setManufacturingStatusFilter(""); setManufacturingOnlyPending(false); }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>

          <AsyncState
            loading={ordersLoading}
            error={ordersError}
            empty={!ordersLoading && filteredManufacturingGroups.length === 0}
            emptyText={
              hasActiveManufacturingFilters && manufacturingGroups.length > 0
                ? "Ningún pedido coincide con los filtros."
                : "Aún no hay pedidos enviados a fabricación."
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Pedido</th>
                    <th className="pb-3 pr-4 font-semibold">Cliente</th>
                    <th className="pb-3 pr-4 font-semibold">Cantidad Productos</th>
                    <th className="pb-3 pr-4 font-semibold">Proceso</th>
                    <th className="pb-3 pr-4 font-semibold">Fecha Enviado</th>
                    <th className="pb-3 font-semibold text-right">Productos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredManufacturingGroups.map((group) => {
                    const { order, lines } = group;
                    const segments = manufacturingProgressSegments(group);
                    const caption = manufacturingProgressCaption(group);
                    const latestSentAt = lines.reduce(
                      (latest, l) => (new Date(l.item.sentToManufacturingAt) > new Date(latest) ? l.item.sentToManufacturingAt : latest),
                      lines[0].item.sentToManufacturingAt
                    );
                    return (
                      <tr key={order._id} className="text-slate-600 transition hover:bg-slate-50/60">
                        <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap">{order.orderNumber}</td>
                        <td className="py-3 pr-4">{order.customer?.name || "—"}</td>
                        <td className="py-3 pr-4 tabular-nums">{lines.length}</td>
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
                        <td className="py-3 pr-4 whitespace-nowrap">{fmtOrderDate(latestSentAt)}</td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2 text-xs font-semibold">
                            <button onClick={() => setManufacturingInfoOrderId(order._id)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Ver</button>
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
      ) : (
        <SectionCard title="Fabricación de pedidos">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <FilterSelect
              value={pedidoBatchStatusFilter}
              onChange={(e) => setPedidoBatchStatusFilter(e.target.value)}
              className={selectFilterClass}
              options={[{ value: "", label: "Estado: Todos" }, ...PEDIDO_BATCH_STATUS_FILTERS.map((key) => ({ value: key, label: PEDIDO_BATCH_STATUS_LABELS[key] }))]}
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={pedidoBatchOnlyPending}
                onChange={(e) => setPedidoBatchOnlyPending(e.target.checked)}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              Solo con pendientes
            </label>
            {hasActivePedidoBatchFilters ? (
              <button
                onClick={() => { setPedidoBatchStatusFilter(""); setPedidoBatchOnlyPending(false); }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>

          <AsyncState
            loading={loading}
            error={error}
            empty={!loading && filteredPedidoGroups.length === 0}
            emptyText={
              hasActivePedidoBatchFilters && pedidoGroups.length > 0
                ? "Ningún pedido coincide con los filtros."
                : "No hay pedidos enviados a fabricar en el rango seleccionado."
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Pedido</th>
                    <th className="pb-3 pr-4 font-semibold">Cliente</th>
                    <th className="pb-3 pr-4 font-semibold">Cantidad Productos</th>
                    <th className="pb-3 pr-4 font-semibold">Proceso</th>
                    <th className="pb-3 font-semibold text-right">Productos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPedidoGroups.map((group) => {
                    const { order, batches } = group;
                    const segments = pedidoBatchProgressSegments(group);
                    const caption = pedidoBatchProgressCaption(group);
                    return (
                      <tr key={order._id} className="text-slate-600 transition hover:bg-slate-50/60">
                        <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap">{order.orderNumber}</td>
                        <td className="py-3 pr-4">{order.customer?.name || "—"}</td>
                        <td className="py-3 pr-4 tabular-nums">{batches.length}</td>
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
                            <p className="mt-1 text-[11px] leading-tight text-slate-500">{caption || "Sin lotes"}</p>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex justify-end gap-2 text-xs font-semibold">
                            <button onClick={() => setPedidoBatchInfoOrderId(order._id)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Ver</button>
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

      <BatchFormModal
        open={modalOpen && batchModalVariant === "diario"}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        form={form}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        saving={saving}
        operators={operators}
      />

      <PedidoBatchFormModal
        open={modalOpen && batchModalVariant === "pedido"}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        form={form}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        saving={saving}
        operators={operators}
      />

      <ReportBatchModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        target={reportTarget}
        form={reportForm}
        handleChange={handleReportChange}
        handleSubmit={submitReport}
        saving={reporting}
        warehouses={warehouses}
      />

      <UndoReportModal
        open={undoReportModalOpen}
        onClose={() => setUndoReportModalOpen(false)}
        target={undoReportTarget}
        handleConfirm={confirmUndoReport}
        undoing={undoingReport}
      />

      <DailyBatchFormModal
        open={dailyModalOpen}
        onClose={() => setDailyModalOpen(false)}
        editingId={dailyEditingId}
        form={dailyForm}
        handleChange={handleDailyChange}
        handleSubmit={handleDailySubmit}
        saving={dailySaving}
      />

      <Modal
        open={!!manufacturingInfoGroup}
        onClose={() => setManufacturingInfoOrderId(null)}
        title={`Productos enviados a fabricar · ${manufacturingInfoGroup?.order?.orderNumber || ""}`}
        size="lg"
        footer={
          <button onClick={() => setManufacturingInfoOrderId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button>
        }
      >
        {manufacturingInfoGroup?.lines?.length ? (
          <div className="space-y-2">
            {manufacturingInfoGroup.lines.map(({ item, index }) => {
              const order = manufacturingInfoGroup.order;
              return (
                <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800">{item.product}{item.color ? ` · ${item.color}` : ""}</p>
                    <p className="text-xs text-slate-500">{item.quantity} unidades · Enviado {fmtOrderDate(item.sentToManufacturingAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    {item.manufacturingBatch ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
                        <IconCheck width={14} height={14} /> Fabricado{item.manufacturingBatch.batchNumber ? ` · ${item.manufacturingBatch.batchNumber}` : ""}
                      </span>
                    ) : (
                      <button onClick={() => handleManufacture({ order, item, index })} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Fabricar</button>
                    )}
                    <button onClick={() => handleRemoveManufacturingLine({ order, item, index })} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Este pedido no tiene productos enviados a fabricar.</p>
        )}
      </Modal>

      <Modal
        open={!!pedidoBatchInfoGroup}
        onClose={() => setPedidoBatchInfoOrderId(null)}
        title={`Lotes del pedido ${pedidoBatchInfoGroup?.order?.orderNumber || ""}`}
        size="lg"
        footer={
          <button onClick={() => setPedidoBatchInfoOrderId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button>
        }
      >
        {pedidoBatchInfoGroup?.batches?.length ? (
          <div className="space-y-2">
            {pedidoBatchInfoGroup.batches.map(({ batch: b, item, index }) => {
              const pedidoLine = item ? { order: pedidoBatchInfoGroup.order, item, index } : null;
              return (
                <div key={b._id} className="space-y-3 rounded-xl bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{b.batchNumber}</p>
                      <p className="text-xs text-slate-500">{b.product} · {b.color || "—"} · {b.productionLine || "—"}</p>
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Meta {b.targetQuantity ?? pedidoLine?.item?.quantity ?? "—"} · Producido {(b.producedQuantity || 0).toLocaleString("es-SV")} · {fmtDate(b)}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {!pedidoLine ? (
                        <span className="text-slate-400">Sin pedido vinculado</span>
                      ) : pedidoLine.item.packed ? (
                        <StatusPill status="Empacado" />
                      ) : b.status === "Completado" ? (
                        <button onClick={() => handlePackManufactured(pedidoLine)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Empacar</button>
                      ) : (
                        <span className="text-slate-400">Editar lote para avanzar</span>
                      )}
                      <button
                        onClick={() => {
                          setPedidoBatchInfoOrderId(null);
                          setBatchModalVariant("pedido");
                          // Mismo fallback que la Meta mostrada arriba: si el lote no
                          // trae targetQuantity propio (lotes creados antes de este
                          // campo), se usa la cantidad del pedido vinculado.
                          openEdit({ ...b, targetQuantity: b.targetQuantity ?? pedidoLine?.item?.quantity });
                        }}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200"
                      >
                        Editar
                      </button>
                      <button onClick={() => handleDelete(b)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Este pedido no tiene lotes.</p>
        )}
      </Modal>

      <ConfirmModal {...pageConfirmProps} />
      <ConfirmModal {...batchConfirmProps} />
      <ConfirmModal {...dailyConfirmProps} />
    </div>
  );
}

export default Fabricacion;
