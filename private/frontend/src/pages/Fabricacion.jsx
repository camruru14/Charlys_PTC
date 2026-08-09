import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useBatchForm } from "../hooks/useBatchForm";
import { useDailyBatchForm } from "../hooks/useDailyBatchForm";
import { useDateRange } from "../context/DateRangeContext";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";
import KpiCard from "../components/ui/KpiCard";
import StatusPill from "../components/ui/StatusPill";
import BatchFormModal from "../components/batches/BatchFormModal";
import ReportBatchModal from "../components/batches/ReportBatchModal";
import UndoReportModal from "../components/batches/UndoReportModal";
import DailyBatchFormModal from "../components/batches/DailyBatchFormModal";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import { IconFactory, IconAlert, IconCheck, IconPlus } from "../lib/icons";

function Fabricacion() {
  const navigate = useNavigate();
  const range = useDateRange();
  const { data: batches, loading, error, refetch } = useFetch("/productionBatches");
  const { data: dailyBatches, loading: dailyLoading, error: dailyError, refetch: refetchDaily } = useFetch("/dailyBatches");
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchManufacturingOrders } = useFetch("/orders");
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("fabricacion");

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
  // disponible (botón "Enviar a fabricación"). Una fila por producto enviado.
  const manufacturingLines = useMemo(() => {
    const rows = [];
    orders.forEach((o) => {
      (o.items || []).forEach((item, index) => {
        if (item.sentToManufacturing) rows.push({ order: o, item, index });
      });
    });
    return rows.sort((a, b) => new Date(b.item.sentToManufacturingAt) - new Date(a.item.sentToManufacturingAt));
  }, [orders]);

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
  } = useBatchForm(list, refetch);

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
  } = useDailyBatchForm(dailyList, refetchDaily, () => {
    refetch();
    setActiveTab("fabricacion");
  });

  // Abrir el modal automáticamente si venimos de "+ Nuevo Lote" del Sidebar
  useEffect(() => {
    if (searchParams.get("new") === "1") {
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
    if (
      !window.confirm(
        `¿Fabricar ${row.item.quantity} ${row.item.product}${row.item.color ? ` (${row.item.color})` : ""} para el pedido ${row.order.orderNumber}? Se creará un lote en Lotes de fabricación.`
      )
    )
      return;
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
    if (!window.confirm(`¿Marcar ${item.product} como empacado? Quedará listo para que Logística lo recoja en Fabricación.`)) return;
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
    if (!window.confirm(msg)) return;
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

      {/* Selector de tabla: Lotes de fabricación / Lotes Diarios */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setActiveTab("fabricacion")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "fabricacion" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Lotes de fabricación
        </button>
        <button
          onClick={() => setActiveTab("diario")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "diario" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Lotes Diarios
        </button>
        <button
          onClick={() => setActiveTab("pedidos")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "pedidos" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Por fabricar
        </button>
        <button
          onClick={() => setActiveTab("fabricacionPedidos")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "fabricacionPedidos" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Fabricación de pedidos
        </button>
      </div>

      {activeTab === "fabricacion" ? (
        <SectionCard
          title="Lotes de fabricación"
          action={
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/fabricacion/historial")} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100">
                Ver todo
              </button>
              <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
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
                          <button onClick={() => openEdit(b)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
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
          <AsyncState
            loading={ordersLoading}
            error={ordersError}
            empty={!ordersLoading && manufacturingLines.length === 0}
            emptyText="Aún no hay pedidos enviados a fabricación."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-3 pr-4 font-semibold">Pedido</th>
                    <th className="pb-3 pr-4 font-semibold">Cliente</th>
                    <th className="pb-3 pr-4 font-semibold">Producto</th>
                    <th className="pb-3 pr-4 font-semibold">Color</th>
                    <th className="pb-3 pr-4 font-semibold">Unidades</th>
                    <th className="pb-3 pr-4 font-semibold">Fecha Enviado</th>
                    <th className="pb-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {manufacturingLines.map(({ order, item, index }) => (
                    <tr key={`${order._id}-${index}`} className="text-slate-600 transition hover:bg-slate-50/60">
                      <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap">{order.orderNumber}</td>
                      <td className="py-3 pr-4">{order.customer?.name || "—"}</td>
                      <td className="py-3 pr-4 font-semibold text-slate-800">{item.product}</td>
                      <td className="py-3 pr-4">{item.color || "—"}</td>
                      <td className="py-3 pr-4 tabular-nums">{item.quantity}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">{fmtOrderDate(item.sentToManufacturingAt)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2 text-xs font-semibold">
                          {item.manufacturingBatch ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
                              <IconCheck width={14} height={14} /> Fabricado{item.manufacturingBatch.batchNumber ? ` (${item.manufacturingBatch.batchNumber})` : ""}
                            </span>
                          ) : (
                            <button onClick={() => handleManufacture({ order, item, index })} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Fabricar</button>
                          )}
                          <button onClick={() => handleRemoveManufacturingLine({ order, item, index })} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
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
        <SectionCard title="Fabricación de pedidos">
          <AsyncState
            loading={loading}
            error={error}
            empty={!loading && pedidoRangeList.length === 0}
            emptyText="No hay pedidos enviados a fabricar en el rango seleccionado."
          >
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
                  {pedidoRangeList.map((b) => {
                    const pedidoLine = pedidoLineByBatchId.get(String(b._id));
                    return (
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
                            {!pedidoLine ? (
                              <span className="text-slate-400">Sin pedido vinculado</span>
                            ) : pedidoLine.item.packed ? (
                              <StatusPill status="Empacado" />
                            ) : b.status === "Completado" ? (
                              <button onClick={() => handlePackManufactured(pedidoLine)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-brand-700 hover:bg-brand-100">Empacar</button>
                            ) : (
                              <span className="text-slate-400">Editar lote para avanzar</span>
                            )}
                            <button onClick={() => openEdit(b)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">Editar</button>
                            <button onClick={() => handleDelete(b)} className="rounded-lg bg-red-50 px-2.5 py-1 text-red-600 hover:bg-red-100">Eliminar</button>
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
        open={modalOpen}
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
    </div>
  );
}

export default Fabricacion;
