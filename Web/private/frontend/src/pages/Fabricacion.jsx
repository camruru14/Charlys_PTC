import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useBatchForm } from "../hooks/useBatchForm";
import { useDailyBatchForm } from "../hooks/useDailyBatchForm";
import { useDateRange } from "../context/dateRange";
import { useUrlState } from "../hooks/useUrlState";
import { defaultBatchFilters, filterBatches } from "../lib/batchFilters";
import { fmtNumber, fromDateOnly } from "../lib/format";
import { IconPlus } from "../lib/icons";
import { getPageMeta } from "../lib/nav";
import { lineOptions } from "../lib/batchFlow";
import PageHeader from "../components/ui/PageHeader";
import Tabs from "../components/ui/Tabs";
import KpiInline from "../components/ui/KpiInline";
import Button from "../components/ui/Button";
import DateRangePicker from "../components/ui/DateRangePicker";
import ConfirmModal from "../components/ui/ConfirmModal";
import BatchFormModal from "../components/batches/BatchFormModal";
import DailyBatchFormModal from "../components/batches/DailyBatchFormModal";
import LotesFabricacion from "./fabricacion/LotesFabricacion";
import ProduccionDiaria from "./fabricacion/ProduccionDiaria";
import PedidosFabricacion from "./fabricacion/PedidosFabricacion";

const TABS = [
  { key: "lotes", label: "Lotes de fabricación" },
  { key: "diaria", label: "Producción diaria" },
  { key: "pedidos", label: "Pedidos" },
];

// Lunes de esta semana a las 00:00.
function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function Fabricacion() {
  const range = useDateRange();
  const { data: batches, loading, error, refetch } = useFetch("/productionBatches");
  const { data: dailyBatches, loading: dailyLoading, error: dailyError, refetch: refetchDaily } = useFetch("/dailyBatches");
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useFetch("/orders");
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab] = useUrlState("tab", "lotes", { allowed: TABS.map((t) => t.key) });
  const [schedulingId, setSchedulingId] = useState(null);

  // Cambiar de pestaña quita ?id= (en Lotes es un lote; en Pedidos, un pedido).
  function changeTab(tab) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("id");
        if (tab === "lotes") params.delete("tab");
        else params.set("tab", tab);
        return params;
      },
      { replace: true },
    );
  }

  const list = useMemo(() => (Array.isArray(batches) ? batches : []), [batches]);
  const rangeList = useMemo(() => filterBatches(list, defaultBatchFilters, range), [list, range]);
  const stockRangeList = useMemo(() => rangeList.filter((b) => b.category !== "Pedido"), [rangeList]);
  const dailyList = useMemo(() => (Array.isArray(dailyBatches) ? dailyBatches : []), [dailyBatches]);
  const orders = useMemo(() => (Array.isArray(ordersData) ? ordersData : []), [ordersData]);
  const lines = useMemo(() => lineOptions(list), [list]);

  // Cambiar un lote puede cambiar el progreso de los pedidos (Pedidos lee
  // item.manufacturingBatch poblado desde /orders): se recargan ambos.
  function refetchBatchesAndOrders() {
    refetch();
    refetchOrders();
  }

  const {
    modalOpen,
    setModalOpen,
    editingId,
    form,
    saving,
    operators,
    openCreate,
    openEdit,
    handleChange,
    handleSubmit,
    handleDelete,
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
  } = useDailyBatchForm(dailyList, refetchDaily, () => refetch());

  // /fabricacion?nuevo=1 abre el modal de nuevo lote; el parámetro se quita
  // para que recargar no lo vuelva a abrir.
  useEffect(() => {
    if (searchParams.get("nuevo") !== "1") return;
    openCreate();
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("nuevo");
        return params;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const kpiItems = useMemo(() => {
    if (activeTab === "diaria") {
      const today = new Date().toDateString();
      const weekStart = startOfWeek();
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const dates = dailyList.map((b) => fromDateOnly(b.date)).filter(Boolean);
      return [
        { label: "Lotes hoy", value: fmtNumber(dates.filter((d) => d.toDateString() === today).length), tone: "blue" },
        { label: "Esta semana", value: fmtNumber(dates.filter((d) => d >= weekStart && d < weekEnd).length), tone: "green" },
      ];
    }
    return [
      { label: "Producción", value: fmtNumber(rangeList.reduce((s, b) => s + (b.producedQuantity || 0), 0)), tone: "blue" },
      { label: "En proceso", value: fmtNumber(rangeList.filter((b) => b.status === "En Proceso").length), tone: "amber" },
      { label: "Detenidos", value: fmtNumber(rangeList.filter((b) => b.status === "Detenido").length), tone: "rose" },
    ];
  }, [activeTab, rangeList, dailyList]);

  function newBatch() {
    if (activeTab === "diaria") {
      openDailyCreate();
      return;
    }
    openCreate();
  }

  async function scheduleDaily(daily) {
    setSchedulingId(daily._id);
    await handleSchedule(daily);
    setSchedulingId(null);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        {...getPageMeta("/fabricacion")}
        subtitle={
          activeTab === "pedidos"
            ? "Pedidos — del lote programado al empaque, sin abrir formularios"
            : getPageMeta("/fabricacion").subtitle
        }
        actions={
          <>
            <DateRangePicker />
            <Button icon={IconPlus} onClick={newBatch}>
              Nuevo lote
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <KpiInline items={kpiItems} />
        <Tabs tabs={TABS} value={activeTab} onChange={changeTab} />
      </div>

      {activeTab === "lotes" ? (
        <LotesFabricacion
          batches={list}
          list={stockRangeList}
          loading={loading}
          error={error}
          refetch={refetchBatchesAndOrders}
          operators={operators}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      ) : activeTab === "diaria" ? (
        <ProduccionDiaria
          list={dailyList}
          loading={dailyLoading}
          error={dailyError}
          busyId={schedulingId}
          onSchedule={scheduleDaily}
          onEdit={openDailyEdit}
          onDelete={handleDailyDelete}
        />
      ) : (
        <PedidosFabricacion
          orders={orders}
          batches={list}
          loading={ordersLoading || loading}
          error={ordersError || error}
          refetchAll={refetchBatchesAndOrders}
          operators={operators}
          lines={lines}
        />
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

      <DailyBatchFormModal
        open={dailyModalOpen}
        onClose={() => setDailyModalOpen(false)}
        editingId={dailyEditingId}
        form={dailyForm}
        handleChange={handleDailyChange}
        handleSubmit={handleDailySubmit}
        saving={dailySaving}
      />

      <ConfirmModal {...batchConfirmProps} />
      <ConfirmModal {...dailyConfirmProps} />
    </div>
  );
}

export default Fabricacion;
