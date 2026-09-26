import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useUrlState } from "../hooks/useUrlState";
import PageHeader from "../components/ui/PageHeader";
import Tabs from "../components/ui/Tabs";
import Button from "../components/ui/Button";
import { toastUndo } from "../lib/toastUndo";
import { IconPlus } from "../lib/icons";
import { dispatchOrders } from "../lib/logistics";
import EnTransito from "./logistica/EnTransito";
import ParaDespacho from "./logistica/ParaDespacho";
import ModalNuevaRuta from "./logistica/ModalNuevaRuta";

const TABS = [
  { key: "transito", label: "En tránsito" },
  { key: "despacho", label: "Para despacho" },
];
const FILTERS = ["todos", "sin-ruta", "incompletos"];

const SUBTITLES = {
  transito: "Asignación de motoristas, vehículos y seguimiento de entregas",
  despacho: "Para despacho — una ruta, varios pedidos: primero se recoge, después se entrega",
};

/*
  Logística: rutas de hoy (En tránsito) y armado de rutas con los pedidos
  empacados (Para despacho). Usa la API de rutas (/routes).
  URL: ?tab= (transito | despacho), ?ruta= (ruta abierta), ?filtro= (lista de Para despacho).
*/
function Logistica() {
  const { data: routesData, loading: routesLoading, error: routesError, refetch: refetchRoutes } = useFetch("/routes");
  const { data: availability, refetch: refetchAvailability } = useFetch("/routes/availability");
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useFetch("/orders");
  const [, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useUrlState("tab", "transito", { allowed: TABS.map((t) => t.key) });
  const [routeId, setRouteId] = useUrlState("ruta");
  const [filter, setFilter] = useUrlState("filtro", "todos", { allowed: FILTERS });
  const [newRouteOpen, setNewRouteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const routes = useMemo(() => (Array.isArray(routesData) ? routesData : []), [routesData]);
  const orders = useMemo(() => dispatchOrders(Array.isArray(ordersData) ? ordersData : []), [ordersData]);
  const unassigned = orders.filter((o) => !o.delivery?.route).length;
  const nextNumber = routes.reduce((max, r) => Math.max(max, r.number || 0), 0) + 1;

  function refreshAll() {
    refetchRoutes();
    refetchAvailability();
    refetchOrders();
  }

  // Acción directa; si hay `undo`, el toast ofrece «Deshacer». Devuelve true si se aplicó.
  async function act(run, message, undo) {
    setBusy(true);
    try {
      await run();
      if (undo) {
        toastUndo(message, async () => {
          try {
            await undo();
            toast.success("Cambio deshecho");
          } catch (err) {
            toast.error(err.message, { duration: 6000 });
          } finally {
            refreshAll();
          }
        });
      } else {
        toast.success(message);
      }
      return true;
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
      return false;
    } finally {
      setBusy(false);
      refreshAll();
    }
  }

  // Cambia varios parámetros de la URL a la vez.
  function goTo(params) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(params).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)));
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Logística"
        subtitle={SUBTITLES[activeTab]}
        actions={
          <>
            <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} />
            <Button icon={IconPlus} onClick={() => setNewRouteOpen(true)}>
              Armar ruta
            </Button>
          </>
        }
      />

      {activeTab === "transito" ? (
        <EnTransito
          routes={routes}
          loading={routesLoading}
          error={routesError}
          selectedId={routeId}
          onSelect={setRouteId}
          unassignedCount={unassigned}
          onAssign={() => goTo({ tab: "despacho", filtro: "sin-ruta" })}
          availability={availability}
          busy={busy}
          act={act}
        />
      ) : (
        <ParaDespacho
          orders={orders}
          ordersLoading={ordersLoading}
          ordersError={ordersError}
          routes={routes}
          openRouteId={routeId}
          onOpenRoute={setRouteId}
          filter={filter}
          onFilter={setFilter}
          availability={availability}
          busy={busy}
          act={act}
          onNewRoute={() => setNewRouteOpen(true)}
        />
      )}

      {newRouteOpen ? (
        <ModalNuevaRuta
          nextNumber={nextNumber}
          availability={availability}
          onClose={() => setNewRouteOpen(false)}
          onCreated={(route) => {
            setNewRouteOpen(false);
            goTo({ tab: "despacho", ruta: route._id });
            refreshAll();
          }}
        />
      ) : null}
    </div>
  );
}

export default Logistica;
