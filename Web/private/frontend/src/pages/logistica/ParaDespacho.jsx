import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import EmptyState from "../../components/ui/EmptyState";
import FilterChips from "../../components/ui/FilterChips";
import PillSelector from "../../components/ui/PillSelector";
import ActionsMenu from "../../components/ui/ActionsMenu";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import { toastUndo } from "../../lib/toastUndo";
import { fmtNumber, fmtDate, fmtTime } from "../../lib/format";
import { IconCheck, IconFactory, IconWarehouse, IconOrders, IconPlus } from "../../lib/icons";
import {
  dispatchInfo,
  incompleteText,
  lotNote,
  isPartialReturn,
  orderPickups,
  requiredPickups,
  pickupDetail,
  isConfirmed,
  pickupAt,
  departBlocker,
  personName,
  shortName,
} from "../../lib/logistics";

const CHIPS = [
  { key: "todos", label: "Todos", tone: "gray" },
  { key: "sin-ruta", label: "Sin ruta", tone: "blue" },
  { key: "incompletos", label: "Incompletos", tone: "amber" },
];
const FILTER_TEST = {
  todos: () => true,
  "sin-ruta": (o) => !o.delivery?.route,
  incompletos: (o) => !dispatchInfo(o).ready,
};
const LOCATION_ICON = { "Almacén": IconWarehouse, "Fabricación": IconFactory };
const routeIdOf = (order) => String(order.delivery?.route?._id || order.delivery?.route || "");

function PickupChip({ location }) {
  const Icon = LOCATION_ICON[location];
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-[6px] bg-canvas px-1.5 text-[11px] font-semibold text-ink-2">
      <Icon width={12} height={12} className="text-subtle" />
      {location}
    </span>
  );
}

function OrderRow({ order, openRoute, busy, onAdd, onOpenRoute, onNewRoute }) {
  const info = dispatchInfo(order);
  const assigned = order.delivery?.route;
  const note = lotNote(order);

  let action;
  if (assigned?.number) {
    const isOpen = openRoute && routeIdOf(order) === String(openRoute._id);
    const label = isOpen ? `Ruta ${assigned.number}` : `Ruta ${assigned.number}${order.delivery?.driver ? ` · ${shortName(order.delivery.driver)}` : ""}`;
    action = (
      <button type="button" onClick={() => onOpenRoute(routeIdOf(order))} className="shrink-0 text-[11.5px] font-semibold tabular-nums text-primary hover:underline">
        {label}
      </button>
    );
  } else if (note) {
    action = <span className="shrink-0 text-[11px] italic text-muted">{note}</span>;
  } else if (openRoute) {
    action = (
      <Button variant="soft" size="row" icon={IconPlus} disabled={busy} onClick={() => onAdd(order)} className="!h-6 !px-2 !text-[11.5px]">
        Ruta {openRoute.number}
      </Button>
    );
  } else {
    action = (
      <Button variant="soft" size="row" disabled={busy} onClick={onNewRoute} className="!h-6 !px-2 !text-[11.5px]">
        Armar ruta
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 border-b border-line-soft px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[13.5px] font-bold tabular-nums text-ink">{order.orderNumber}</span>
          {isPartialReturn(order) ? (
            <span className="rounded-[6px] bg-tone-amber px-1.5 py-px text-[10.5px] font-bold text-tone-amber-text">Entrega parcial</span>
          ) : null}
        </span>
        <StatusPill status={info.status} domain="despacho" variant="dot" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[12.5px] text-ink-2">{order.customer?.name || "—"}</span>
        <span className="shrink-0 text-[11px] text-subtle">{assigned?.zone || "—"}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap gap-1">
          {orderPickups(order).map((l) => (
            <PickupChip key={l} location={l} />
          ))}
        </span>
        {action}
      </div>
    </div>
  );
}

// Círculo de 28px de la línea de tiempo.
function TimelineDot({ done, children }) {
  return (
    <span
      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums ${
        done ? "bg-tone-green-dot text-white" : "border-2 border-line bg-surface text-muted"
      }`}
    >
      {done ? <IconCheck width={14} height={14} strokeWidth={2.6} /> : children}
    </span>
  );
}

function RoutePanel({ route, ordersById, availability, busy, act, onDeleted }) {
  const { confirm, confirmProps } = useConfirm();
  // Pedidos incompletos que se llevan como están («Llevar lo que hay»).
  const [takeAsIs, setTakeAsIs] = useState(() => new Set());
  const orders = (route.orders || []).map((o) => ordersById.get(String(o._id)) || o);
  const pickups = requiredPickups(orders);
  const blocker = departBlocker(route, orders);
  const routeUrl = `/routes/${route._id}`;
  const driverId = String(route.driver?._id || route.driver || "");
  const empty = !route.orders?.length && !route.deliveries?.length;

  const driverOptions = (availability?.drivers || []).map((d) => ({
    value: String(d._id),
    label: personName(d),
    busy: d.busy && String(d.route?._id) !== String(route._id),
  }));
  const vehicleOptions = (availability?.vehicles || []).map((v) => ({
    value: v.plate,
    label: v.plate,
    busy: v.busy && String(v.route?._id) !== String(route._id),
  }));

  function change(field, value, previous, label) {
    if (value === previous) return;
    act(() => api.patch(routeUrl, { [field]: value }), `${label} de la Ruta ${route.number} actualizado`, () =>
      api.patch(routeUrl, { [field]: previous || null }),
    );
  }

  function setTaken(id, on) {
    setTakeAsIs((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function removeRoute() {
    if (!(await confirm(`¿Eliminar la Ruta ${route.number} · ${route.zone}?`, { danger: true, confirmLabel: "Eliminar" }))) return;
    try {
      await api.del(routeUrl);
      toast.success(`Ruta ${route.number} eliminada`);
      onDeleted();
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    }
  }

  const incomplete = orders.filter((o) => !dispatchInfo(o).ready && !takeAsIs.has(String(o._id)));
  const summary = [
    `${fmtNumber(orders.length)} ${orders.length === 1 ? "pedido" : "pedidos"}`,
    `${fmtNumber(pickups.length)} ${pickups.length === 1 ? "recogida" : "recogidas"}`,
    `${fmtNumber(orders.length)} ${orders.length === 1 ? "entrega" : "entregas"}`,
  ].join(" · ");

  return (
    <DetailPanel
      header={
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">
                Ruta {route.number} · {route.zone}
              </h2>
              <StatusPill status={route.status} domain="ruta" size="lg" />
            </div>
            <p className="t-aux tabular-nums">{summary}</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-end gap-1">
              <Button
                size="detail"
                disabled={busy || Boolean(blocker)}
                className="disabled:!bg-primary-disabled disabled:!opacity-100"
                onClick={() => act(() => api.patch(`${routeUrl}/depart`), `Ruta ${route.number} salió`)}
              >
                Salir a ruta
              </Button>
              {blocker ? <span className="text-[10px] font-semibold text-muted">{blocker}</span> : null}
            </div>
            {empty ? <ActionsMenu items={[{ label: "Eliminar ruta", onClick: removeRoute, danger: true }]} /> : null}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5 rounded-[12px] border border-line-soft bg-surface-2 px-3.5 py-3">
          <div className="flex items-start gap-3">
            <span className="t-label w-[72px] shrink-0 pt-1.5">Motorista</span>
            {driverOptions.length ? (
              <PillSelector options={driverOptions} value={driverId} onChange={(v) => change("driver", v, driverId, "Motorista")} />
            ) : (
              <span className="t-aux pt-1">No hay empleados activos del área Logística.</span>
            )}
          </div>
          <div className="flex items-start gap-3">
            <span className="t-label w-[72px] shrink-0 pt-1.5">Vehículo</span>
            {vehicleOptions.length ? (
              <PillSelector options={vehicleOptions} value={route.vehicle || ""} onChange={(v) => change("vehicle", v, route.vehicle, "Vehículo")} />
            ) : (
              <span className="t-aux pt-1">No hay vehículos en Configuración.</span>
            )}
          </div>
        </div>

        <div className="relative flex flex-col gap-4">
          <span className="absolute bottom-3 left-[13px] top-3 w-[2px] bg-line" aria-hidden="true" />

          <p className="t-label pl-[42px]">1 · Recoger</p>
          {pickups.length === 0 ? (
            <p className="t-aux pl-[42px]">{orders.length ? "Nada que recoger." : "Agrega pedidos desde la lista."}</p>
          ) : (
            pickups.map((location) => {
              const done = isConfirmed(route, location);
              const Icon = LOCATION_ICON[location];
              return (
                <div key={location} className="flex items-center gap-3.5">
                  <TimelineDot done={done}>
                    <Icon width={14} height={14} />
                  </TimelineDot>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-ink">{location}</p>
                    <p className="t-aux truncate tabular-nums">{pickupDetail(orders, location)}</p>
                  </div>
                  {done ? (
                    <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold tabular-nums text-tone-green-text">
                      <IconCheck width={14} height={14} /> Recogido {fmtTime(pickupAt(route, location))}
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="row"
                      disabled={busy || route.status !== "Recolectando"}
                      onClick={() => act(() => api.patch(`${routeUrl}/pickup`, { location }), `Recogida en ${location} confirmada`)}
                    >
                      Confirmar recogido
                    </Button>
                  )}
                </div>
              );
            })
          )}

          {incomplete.map((o) => (
            <div key={o._id} className="ml-[42px] flex flex-col gap-2.5 rounded-[12px] border border-tone-amber-line bg-tone-amber px-3.5 py-3">
              <p className="text-[12.5px] text-tone-amber-strong">{incompleteText(o)}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="warning"
                  size="row"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () => api.del(`${routeUrl}/orders/${o._id}`),
                      `${o.orderNumber} quitado de la Ruta ${route.number}`,
                      () => api.post(`${routeUrl}/orders`, { orderId: o._id }),
                    )
                  }
                >
                  Quitar de la ruta
                </Button>
                <Button
                  variant="secondary"
                  size="row"
                  onClick={() => {
                    const id = String(o._id);
                    setTaken(id, true);
                    toastUndo(`${o.orderNumber} sale con lo que hay`, () => setTaken(id, false));
                  }}
                >
                  Llevar lo que hay
                </Button>
              </div>
            </div>
          ))}

          <p className="t-label pl-[42px] pt-1">2 · Entregar</p>
          {orders.length === 0 ? <p className="t-aux pl-[42px]">Sin paradas todavía.</p> : null}
          {orders.map((o, i) => (
            <div key={o._id} className="flex items-center gap-3.5">
              <TimelineDot>{i + 1}</TimelineDot>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink">{o.customer?.name || "—"}</p>
                <p className="t-aux truncate tabular-nums">
                  {o.orderNumber} · {o.delivery?.address || o.customer?.address || "—"}
                </p>
              </div>
              <StatusPill status={dispatchInfo(o).ready ? "Listo" : "Incompleto"} domain="parada" />
            </div>
          ))}
        </div>
      </div>
      <ConfirmModal {...confirmProps} />
    </DetailPanel>
  );
}

/*
  Logística > Para despacho: pedidos con algo empacado que todavía no salen
  (maestro) y la ruta abierta que se está armando (panel derecho).
*/
function ParaDespacho({ orders, ordersLoading, ordersError, routes, openRouteId, onOpenRoute, filter, onFilter, availability, busy, act, onNewRoute }) {
  const ordersById = useMemo(() => new Map(orders.map((o) => [String(o._id), o])), [orders]);
  const pendingRoutes = routes.filter((r) => !r.departedAt);
  const openRoute = routes.find((r) => r._id === openRouteId) || null;
  const buildingRoute = openRoute && !openRoute.departedAt ? openRoute : null;

  const counts = useMemo(() => Object.fromEntries(CHIPS.map((c) => [c.key, orders.filter(FILTER_TEST[c.key]).length])), [orders]);
  const visible = orders.filter(FILTER_TEST[filter] || FILTER_TEST.todos);

  function add(order) {
    const url = `/routes/${buildingRoute._id}/orders`;
    act(
      () => api.post(url, { orderId: order._id }),
      `${order.orderNumber} agregado a la Ruta ${buildingRoute.number}`,
      () => api.del(`${url}/${order._id}`),
    );
  }

  return (
    <MasterDetail listWidth={392}>
      <ListPanel
        header={
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold text-ink">Pedidos para despacho</h2>
              <span className="t-aux tabular-nums">
                {fmtDate(new Date())} · {fmtNumber(orders.length)} {orders.length === 1 ? "pedido" : "pedidos"}
              </span>
            </div>
            <FilterChips value={filter} onChange={onFilter} options={CHIPS.map((c) => ({ ...c, count: counts[c.key] }))} />
          </>
        }
      >
        {ordersLoading && !orders.length ? (
          <EmptyState title="Cargando pedidos…" />
        ) : ordersError ? (
          <EmptyState title="No se pudieron cargar los pedidos" description={ordersError} />
        ) : visible.length === 0 ? (
          <EmptyState title={orders.length ? "Ningún pedido coincide con el filtro." : "No hay pedidos empacados por despachar."} />
        ) : (
          visible.map((o) => (
            <OrderRow key={o._id} order={o} openRoute={buildingRoute} busy={busy} onAdd={add} onOpenRoute={onOpenRoute} onNewRoute={onNewRoute} />
          ))
        )}
      </ListPanel>

      <div className="flex min-h-0 flex-col gap-3">
        {pendingRoutes.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-label">Rutas por salir</span>
            <PillSelector
              options={pendingRoutes.map((r) => ({ value: r._id, label: `Ruta ${r.number} · ${r.zone}` }))}
              value={buildingRoute?._id || ""}
              onChange={onOpenRoute}
            />
          </div>
        ) : null}
        <div className="grid min-h-0 flex-1">
          {buildingRoute ? (
            <RoutePanel
              key={buildingRoute._id}
              route={buildingRoute}
              ordersById={ordersById}
              availability={availability}
              busy={busy}
              act={act}
              onDeleted={() => onOpenRoute(null)}
            />
          ) : (
            <DetailPanel>
              <EmptyState
                icon={IconOrders}
                title={openRoute ? `La Ruta ${openRoute.number} ya salió` : "Ninguna ruta abierta"}
                description={openRoute ? "Síguela en En tránsito." : "Abre una ruta por salir o arma una nueva para agregarle pedidos."}
                action={
                  openRoute ? null : (
                    <Button size="detail" icon={IconPlus} onClick={onNewRoute}>
                      Armar ruta
                    </Button>
                  )
                }
              />
            </DetailPanel>
          )}
        </div>
      </div>
    </MasterDetail>
  );
}

export default ParaDespacho;
