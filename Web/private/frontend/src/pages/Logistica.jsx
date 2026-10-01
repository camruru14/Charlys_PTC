import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { useFetch, replaceById } from "../hooks/useFetch";
import { useUrlState } from "../hooks/useUrlState";
import { useConfirm } from "../hooks/useConfirm";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useDateRange } from "../context/dateRange";
import PageHeader from "../components/ui/PageHeader";
import Tabs from "../components/ui/Tabs";
import DateRangePicker from "../components/ui/DateRangePicker";
import Button from "../components/ui/Button";
import ConfirmModal from "../components/ui/ConfirmModal";
import { api } from "../lib/api";
import { toastUndo } from "../lib/toastUndo";
import { IconPlus } from "../lib/icons";
import { dayKey, dispatchOrders, routeRef } from "../lib/logistics";
import EnTransito from "./logistica/EnTransito";
import ParaDespacho from "./logistica/ParaDespacho";
import ModalNuevaRuta from "./logistica/ModalNuevaRuta";

const TABS = [
  { key: "transito", label: "En tránsito" },
  { key: "despacho", label: "Para despacho" },
];
const FILTERS = ["todos", "listos", "incompletos", "recoleccion"];
const ROUTE_FILTERS = ["todas", "pendiente", "transito", "completadas"];

// Refresco automático de los datos de Logística (cambios de otras pantallas, computadoras o la app móvil).
const REFRESH_MS = 15000;

const SUBTITLES = {
  transito: "Asignación de motoristas, vehículos y seguimiento de entregas",
  despacho: "Para despacho — una ruta, varios pedidos: primero se recoge, después se entrega",
};

/*
  Logística: rutas de hoy (En tránsito) y armado de rutas con los pedidos
  empacados (Para despacho). Usa la API de rutas (/routes).
  URL: ?tab= (transito | despacho), ?ruta= (ruta abierta), ?filtro= (lista de
  Para despacho), ?estado= (lista de rutas de En tránsito).
  Rutas: GET /routes?from=&to= devuelve TODAS las rutas sin completar (sin
  importar su fecha) y las completadas dentro del rango de fechas global (el
  mismo selector de Finanzas, solo en En tránsito; por defecto esta semana).
  Para despacho no se filtra por fecha.
  Tiempo real: no hay WebSocket ni SSE, así que los datos se vuelven a leer en
  silencio cada 15 s mientras la pestaña del navegador está visible (y al
  volver a ella); los grupos se recalculan solos con cada lectura.
*/
function Logistica() {
  const range = useDateRange();
  // Rango de las completadas. «Todo» (sin rango) parte de 1970; con un rango
  // relativo («Esta semana», «Últimos 7 días»…) el final es siempre hoy, aunque
  // pase la medianoche con la pantalla abierta. El refresco automático usa esta
  // misma ruta, así que respeta el rango elegido y no lo reinicia.
  const routesPath = `/routes?from=${range.from ? dayKey(range.from) : "1970-01-01"}&to=${range.preset || !range.to ? dayKey(new Date()) : dayKey(range.to)}`;
  const { data: routesData, loading: routesLoading, error: routesError, refetch: refetchRoutes, mutate: mutateRoutes } = useFetch(routesPath);
  const { data: availability, refetch: refetchAvailability } = useFetch("/routes/availability");
  const { data: ordersData, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useFetch("/orders");
  const [, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useUrlState("tab", "transito", { allowed: TABS.map((t) => t.key) });
  const [routeId, setRouteId] = useUrlState("ruta");
  const [filter, setFilter] = useUrlState("filtro", "todos", { allowed: FILTERS });
  const [routeFilter, setRouteFilter] = useUrlState("estado", "todas", { allowed: ROUTE_FILTERS });
  const [newRouteOpen, setNewRouteOpen] = useState(false);
  // Acciones en curso, por clave («order:<id>», «pickup:<ruta>:<lugar>»…): cada
  // botón solo se bloquea mientras corre SU acción, no todos a la vez.
  const [pending, setPending] = useState(() => new Set());
  const { confirm, confirmProps } = useConfirm();
  const isBusy = (key) => pending.has(key);

  const routes = useMemo(() => (Array.isArray(routesData) ? routesData : []), [routesData]);
  const orders = useMemo(() => dispatchOrders(Array.isArray(ordersData) ? ordersData : []), [ordersData]);
  const unassigned = orders.filter((o) => !o.delivery?.route).length;

  function refreshAll() {
    refetchRoutes();
    refetchAvailability();
    refetchOrders();
  }

  // Lectura en segundo plano: sin spinners, sin tocar errores y sin solaparse
  // con otra lectura ni con una acción en curso.
  function refreshQuietly() {
    if (pending.size > 0) return;
    refetchRoutes({ silent: true });
    refetchAvailability({ silent: true });
    refetchOrders({ silent: true });
  }
  useAutoRefresh(refreshQuietly, { interval: REFRESH_MS });

  // Toda acción de ruta responde la ruta actualizada (poblada): se reemplaza
  // en la lista sin volver a pedir /routes. Los pedidos sí se recargan (la
  // acción los cambia) y la disponibilidad solo si cambió el motorista, el
  // vehículo o el estado de la ruta (una ruta Completada libera ambos).
  function applyRoute(updated) {
    if (!updated?._id) return refreshAll();
    const previous = routes.find((r) => r._id === updated._id);
    mutateRoutes((list) => replaceById(list, updated));
    refetchOrders();
    const driverOf = (r) => String(r?.driver?._id || r?.driver || "");
    if (!previous || driverOf(previous) !== driverOf(updated) || previous.vehicle !== updated.vehicle || previous.status !== updated.status) {
      refetchAvailability();
    }
  }

  // Acción directa; si hay `undo`, el toast ofrece «Deshacer». `key` identifica
  // la fila o botón que la lanzó (ver isBusy). Devuelve true si se aplicó.
  async function act(run, message, undo, key = "global") {
    setPending((prev) => new Set(prev).add(key));
    try {
      applyRoute(await run());
      if (undo) {
        toastUndo(message, async () => {
          try {
            applyRoute(await undo());
            toast.success("Cambio deshecho");
          } catch (err) {
            toast.error(err.message, { duration: 6000 });
            refreshAll();
          }
        });
      } else {
        toast.success(message);
      }
      return true;
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
      // La ruta pudo cambiar en otra pantalla: se vuelve a leer todo.
      refreshAll();
      return false;
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  // Quitar un pedido de su ruta (solo antes de salir y de recoger su lugar;
  // la regla, canRemoveFromRoute, decide si se ofrece el botón). Pide
  // confirmación y el pedido vuelve a Para despacho.
  async function removeFromRoute(order, route) {
    const message = `¿Quitar ${order.orderNumber} de ${routeRef(route)}? El pedido volverá a Para despacho.`;
    if (!(await confirm(message, { confirmLabel: "Quitar" }))) return;
    const url = `/routes/${route._id}/orders`;
    act(
      () => api.del(`${url}/${order._id}`),
      `${order.orderNumber} quitado de ${routeRef(route)}`,
      () => api.post(url, { orderId: order._id }),
      `order:${order._id}`,
    );
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

  // Cambio de pestaña. ?ruta= se conserva (En tránsito sigue en la misma
  // ruta), salvo al ir a Para despacho con una ruta que ya salió: ahí se
  // quita a la vez que ?tab= para que Para despacho abra la ruta por salir
  // recordada (o la primera, o «Ninguna ruta abierta») en vez del aviso
  // «R-AAAA-NNNN ya salió». Ese aviso sigue apareciendo justo después de
  // «Salir a ruta», porque eso no cambia de pestaña.
  function changeTab(tab) {
    const open = routes.find((r) => r._id === routeId);
    if (tab === "despacho" && open?.departedAt) goTo({ tab, ruta: null });
    else setActiveTab(tab);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Logística"
        subtitle={SUBTITLES[activeTab]}
        actions={
          <>
            {activeTab === "transito" ? <DateRangePicker /> : null}
            <Tabs tabs={TABS} value={activeTab} onChange={changeTab} />
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
          onAssign={() => goTo({ tab: "despacho", filtro: null, ruta: null })}
          filter={routeFilter}
          onFilter={setRouteFilter}
          availability={availability}
          isBusy={isBusy}
          act={act}
          onRemove={removeFromRoute}
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
          isBusy={isBusy}
          act={act}
          onRemove={removeFromRoute}
          onNewRoute={() => setNewRouteOpen(true)}
        />
      )}

      <ConfirmModal {...confirmProps} />

      {newRouteOpen ? (
        <ModalNuevaRuta
          availability={availability}
          onClose={() => setNewRouteOpen(false)}
          onCreated={(route) => {
            setNewRouteOpen(false);
            // Se agrega ya a la lista (la recarga llega después) para que
            // Para despacho la encuentre al abrirse y no caiga en otra ruta.
            if (route?._id) mutateRoutes((list) => (Array.isArray(list) && !list.some((r) => r._id === route._id) ? [...list, route] : list));
            goTo({ tab: "despacho", ruta: route._id });
            refreshAll();
          }}
        />
      ) : null}
    </div>
  );
}

export default Logistica;
