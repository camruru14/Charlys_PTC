import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useBatchForm } from "../hooks/useBatchForm";
import { useDailyBatchForm } from "../hooks/useDailyBatchForm";
import { useUrlState } from "../hooks/useUrlState";
import { isStockBatch } from "../lib/batchFlow";
import { buildGroups } from "../lib/orderManufacturing";
import { IconPlus } from "../lib/icons";
import { getPageMeta } from "../lib/nav";
import { useProductionLines } from "../hooks/useProductionLines";
import PageHeader from "../components/ui/PageHeader";
import Tabs from "../components/ui/Tabs";
import Button from "../components/ui/Button";
import DateRangePicker from "../components/ui/DateRangePicker";
import ConfirmModal from "../components/ui/ConfirmModal";
import BatchFormModal from "../components/batches/BatchFormModal";
import DailyBatchFormModal from "../components/batches/DailyBatchFormModal";
import LotesFabricacion from "./fabricacion/LotesFabricacion";
import ProduccionDiaria from "./fabricacion/ProduccionDiaria";
import PedidosFabricacion from "./fabricacion/PedidosFabricacion";
import { useActivity, useMarkSeen } from "../hooks/useActivity";
import { tabKey } from "../lib/activityKeys";

const TABS = [
  { key: "lotes", label: "Lotes de fabricación" },
  { key: "diaria", label: "Producción diaria" },
  { key: "pedidos", label: "Pedidos" },
];

function Fabricacion() {
  const { data: batches, loading, error, refetch, mutate: mutateBatches } = useFetch("/productionBatches");
  const { data: dailyBatches, loading: dailyLoading, error: dailyError, refetch: refetchDaily } = useFetch("/dailyBatches");
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchOrders, mutate: mutateOrders } = useFetch("/orders");
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab] = useUrlState("tab", "lotes", { allowed: TABS.map((t) => t.key) });
  // Novedades: abrir una pestaña la marca vista y las demás muestran su burbuja.
  const { counts } = useActivity();
  useMarkSeen(tabKey("fabricacion", activeTab));
  const tabs = TABS.map((t) => ({ ...t, badge: counts[`fabricacion.${t.key}`] }));
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
  // Lotes de stock sin filtrar por fecha: la pestaña Lotes agrupa por estado y
  // el rango solo afecta a «En bodega» (ver groupBatches).
  const stockList = useMemo(() => list.filter(isStockBatch), [list]);
  const dailyList = useMemo(() => (Array.isArray(dailyBatches) ? dailyBatches : []), [dailyBatches]);
  const orders = useMemo(() => (Array.isArray(ordersData) ? ordersData : []), [ordersData]);
  // Pedidos con lotes de fabricación (para la pestaña Pedidos y sus KPIs).
  const orderGroups = useMemo(() => buildGroups(orders, list), [orders, list]);
  // Líneas activas de Configuración > Líneas de producción (para iniciar lotes de pedido).
  const { options: lines } = useProductionLines();

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
        // En las tres pestañas, todo va en una sola fila: el rango de fechas,
        // «Nuevo lote» (no en Pedidos: sus lotes llegan solos desde Inventario) y
        // las pestañas, así el contenido de cada una arranca a la misma altura.
        actions={
          <>
            <DateRangePicker />
            {activeTab === "pedidos" ? null : (
              <Button icon={IconPlus} onClick={newBatch}>
                Nuevo lote
              </Button>
            )}
            <Tabs tabs={tabs} value={activeTab} onChange={changeTab} />
          </>
        }
      />

      {activeTab === "lotes" ? (
        <LotesFabricacion
          batches={list}
          list={stockList}
          loading={loading}
          error={error}
          // Los lotes de stock no afectan a los pedidos: basta con los lotes.
          refetch={refetch}
          mutateBatches={mutateBatches}
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
          groups={orderGroups}
          loading={ordersLoading || loading}
          error={ordersError || error}
          refetchAll={refetchBatchesAndOrders}
          refetchOrders={refetchOrders}
          refetchBatches={refetch}
          mutateOrders={mutateOrders}
          mutateBatches={mutateBatches}
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
