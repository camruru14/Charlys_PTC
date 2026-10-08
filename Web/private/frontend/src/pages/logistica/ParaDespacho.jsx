import { Fragment, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import { useRememberedSelection } from "../../hooks/useRememberedSelection";
import { useMovedIds } from "../../hooks/useMovedIds";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import EmptyState from "../../components/ui/EmptyState";
import FilterChips from "../../components/ui/FilterChips";
import SearchInput from "../../components/ui/SearchInput";
import PillSelector from "../../components/ui/PillSelector";
import Avatar from "../../components/ui/Avatar";
import Modal from "../../components/ui/Modal";
import VehiclePhoto from "../../components/ui/VehiclePhoto";
import ActionsMenu from "../../components/ui/ActionsMenu";
import ConfirmModal from "../../components/ui/ConfirmModal";
import ListGroupHeader from "../../components/ui/ListGroupHeader";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import { buttonClass } from "../../lib/buttonStyles";
import { toastUndo } from "../../lib/toastUndo";
import { TONE_SOFT } from "../../lib/tones";
import { fmtNumber, fmtDate, fmtTime } from "../../lib/format";
import { IconCheck, IconEdit, IconFactory, IconWarehouse, IconOrders, IconPlus } from "../../lib/icons";
import {
  DISPATCH_GROUPS,
  dispatchCounts,
  dispatchGroup,
  dispatchInfo,
  groupDispatchOrders,
  missingBreakdown,
  pickupNote,
  canRemoveFromRoute,
  matchesQuery,
  routeLabel,
  routeRef,
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
  vehicleLabel,
} from "../../lib/logistics";

// Chips: «Todos» más uno por grupo de la jerarquía (lib/logistics.js).
const CHIPS = [{ key: "todos", label: "Todos", tone: "gray" }, ...DISPATCH_GROUPS.map((g) => ({ key: g.key, label: g.chip, tone: g.tone }))];
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

function OrderRow({ order, group, route, moved, openRoute, busy, onAdd, onRemove, onOpenRoute, onNewRoute }) {
  const info = dispatchInfo(order);
  const assigned = order.delivery?.route;
  const note = lotNote(order);
  const missing = group === "incompletos" ? missingBreakdown(order) : [];
  const pickup = group === "recoleccion" ? pickupNote(order, route) : null;

  let action;
  if (assigned?.code || assigned?.number != null) {
    const isOpen = openRoute && routeIdOf(order) === String(openRoute._id);
    const label = isOpen ? routeLabel(assigned) : `${routeLabel(assigned)}${order.delivery?.driver ? ` · ${shortName(order.delivery.driver)}` : ""}`;
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
        {routeLabel(openRoute)}
      </Button>
    );
  } else {
    action = (
      <Button variant="soft" size="row" onClick={onNewRoute} className="!h-6 !px-2 !text-[11.5px]">
        Armar ruta
      </Button>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 border-b border-line-soft px-3.5 py-3 ${moved ? "row-moved" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[13.5px] font-bold tabular-nums text-ink">{order.orderNumber}</span>
          {isPartialReturn(order) ? (
            <StatusPill status="Entrega parcial" domain="despacho" />
          ) : null}
        </span>
        <StatusPill status={info.status} domain="despacho" variant="dot" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[12.5px] text-ink-2">{order.customer?.name || "—"}</span>
        <span className="shrink-0 text-[11px] text-subtle">{assigned?.zone || "—"}</span>
      </div>
      {missing.length ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-muted">Falta:</span>
          {missing.map((m) => (
            <span key={m.label} className={`inline-flex h-5 items-center rounded-[6px] px-1.5 text-[11px] font-semibold ${TONE_SOFT[m.tone]}`}>
              {m.label}
            </span>
          ))}
        </div>
      ) : null}
      {pickup ? (
        <div className="flex items-center justify-between gap-3">
          <p className="t-aux min-w-0">
            {assigned?.code || assigned?.number != null ? `${routeLabel(assigned)} · ${assigned.zone} · ` : ""}
            {pickup}
          </p>
          {canRemoveFromRoute(order, route) ? (
            <Button variant="secondary" size="row" disabled={busy} onClick={() => onRemove(order, route)} className="!h-6 shrink-0 !px-2 !text-[11.5px]">
              Quitar de la ruta
            </Button>
          ) : null}
        </div>
      ) : null}
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

/*
  Ficha de la unidad de la ruta: foto, modelo y placa del vehículo, y el
  motorista. «Cambiar» (o «Asignar», si falta alguno) abre el modal con los
  selectores. Los datos del vehículo salen de availability por la placa; si la
  placa ya no existe en Configuración, solo se muestra la placa.
*/
function CrewCard({ route, unit, onEdit }) {
  const plate = route.vehicle || "";
  const driver = route.driver?.name ? route.driver : null;
  const incomplete = !plate || !driver;

  return (
    <div className="relative rounded-[12px] border border-line-soft bg-surface-2 p-3.5">
      <Button variant="secondary" size="row" icon={IconEdit} onClick={onEdit} className="absolute right-3 top-3 z-10">
        {incomplete ? "Asignar" : "Cambiar"}
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        {plate ? (
          <VehiclePhoto url={unit?.imageUrl} className="aspect-[176/108] w-full max-w-[360px] rounded-[10px] sm:h-[108px] sm:w-[176px]" iconSize={44} />
        ) : (
          <div className="flex aspect-[176/108] w-full max-w-[360px] items-center justify-center rounded-[10px] border border-dashed border-line px-3 text-center text-[12.5px] text-muted sm:h-[108px] sm:w-[176px] sm:shrink-0">
            Sin vehículo asignado
          </div>
        )}

        {plate ? (
          <div className="min-w-0 sm:pr-5">
            <p className="t-label">Vehículo</p>
            {unit?.model ? <p className="mt-1 truncate text-[17px] font-bold leading-snug text-ink">{unit.model}</p> : null}
            <span className="mt-1.5 inline-block rounded-[8px] border border-line bg-surface px-2.5 py-1 text-[13px] font-bold tabular-nums text-ink">{plate}</span>
          </div>
        ) : null}

        <span className="h-px w-full bg-line sm:h-[72px] sm:w-px sm:shrink-0" aria-hidden="true" />

        <div className="min-w-0 sm:flex-1">
          <p className="t-label">Motorista</p>
          {driver ? (
            <div className="mt-2 flex items-center gap-2.5">
              <Avatar person={driver} size={40} tone="color" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-ink">{personName(driver)}</p>
                {driver.phone ? <p className="t-aux tabular-nums">{driver.phone}</p> : null}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-muted">Sin motorista asignado</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RoutePanel({ route, ordersById, availability, isBusy, act, onRemove, onDeleted }) {
  const { confirm, confirmProps } = useConfirm();
  // Pedidos incompletos que se llevan como están («Llevar lo que hay»).
  const [takeAsIs, setTakeAsIs] = useState(() => new Set());
  // Modal «Motorista y vehículo».
  const [crewOpen, setCrewOpen] = useState(false);
  const orders = (route.orders || []).map((o) => ordersById.get(String(o._id)) || o);
  const pickups = requiredPickups(orders);
  const blocker = departBlocker(route, orders);
  const routeUrl = `/routes/${route._id}`;
  const driverId = String(route.driver?._id || route.driver || "");
  const unit = (availability?.vehicles || []).find((v) => v.plate === route.vehicle);
  const empty = !route.orders?.length && !route.deliveries?.length;

  const driverOptions = (availability?.drivers || []).map((d) => ({
    value: String(d._id),
    label: personName(d),
    busy: d.busy && String(d.route?._id) !== String(route._id),
  }));
  const vehicleOptions = (availability?.vehicles || []).map((v) => ({
    value: v.plate,
    label: vehicleLabel(v),
    busy: v.busy && String(v.route?._id) !== String(route._id),
  }));

  function change(field, value, previous, label) {
    if (value === previous) return;
    act(
      () => api.patch(routeUrl, { [field]: value }),
      `${label} de ${routeRef(route)} actualizado`,
      () => api.patch(routeUrl, { [field]: previous || null }),
      `crew:${route._id}`,
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
    if (!(await confirm(`¿Eliminar ${routeRef(route)} · ${route.zone}?`, { danger: true, confirmLabel: "Eliminar" }))) return;
    try {
      await api.del(routeUrl);
      toast.success(`${routeLabel(route)} eliminada`);
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
                {routeLabel(route)} · {route.zone}
              </h2>
              <StatusPill status={route.status} domain="ruta" size="lg" />
            </div>
            <p className="t-aux tabular-nums">{summary}</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-end gap-1">
              <Button
                size="detail"
                disabled={isBusy(`depart:${route._id}`) || Boolean(blocker)}
                className="disabled:!bg-primary-disabled disabled:!opacity-100"
                onClick={() => act(() => api.patch(`${routeUrl}/depart`), `${routeLabel(route)} salió`, undefined, `depart:${route._id}`)}
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
        <CrewCard route={route} unit={unit} onEdit={() => setCrewOpen(true)} />

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
                      disabled={isBusy(`pickup:${route._id}:${location}`) || route.status !== "Recolectando"}
                      onClick={() =>
                        act(() => api.patch(`${routeUrl}/pickup`, { location }), `Recogida en ${location} confirmada`, undefined, `pickup:${route._id}:${location}`)
                      }
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
                  disabled={isBusy(`order:${o._id}`)}
                  onClick={() => onRemove(o, route)}
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
              {canRemoveFromRoute(o, route) ? (
                <button
                  type="button"
                  title="Quitar de la ruta"
                  aria-label={`Quitar ${o.orderNumber} de la ruta`}
                  disabled={isBusy(`order:${o._id}`)}
                  onClick={() => onRemove(o, route)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[15px] leading-none text-muted transition hover:bg-tone-rose hover:text-tone-rose-text disabled:opacity-50"
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <Modal
        open={crewOpen}
        onClose={() => setCrewOpen(false)}
        title={`Motorista y vehículo · ${routeLabel(route)}`}
        subtitle="Cada cambio se guarda al momento."
        size="lg"
        footer={
          <button type="button" onClick={() => setCrewOpen(false)} className={buttonClass("primary", "modal")}>
            Listo
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Motorista</span>
            {driverOptions.length ? (
              <PillSelector options={driverOptions} value={driverId} onChange={(v) => change("driver", v, driverId, "Motorista")} />
            ) : (
              <p className="t-aux">No hay empleados activos del área Logística.</p>
            )}
          </div>
          <div>
            <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Vehículo</span>
            {vehicleOptions.length ? (
              <PillSelector options={vehicleOptions} value={route.vehicle || ""} onChange={(v) => change("vehicle", v, route.vehicle, "Vehículo")} />
            ) : (
              <p className="t-aux">No hay vehículos en Configuración.</p>
            )}
          </div>
        </div>
      </Modal>
      <ConfirmModal {...confirmProps} />
    </DetailPanel>
  );
}

/*
  Logística > Para despacho: pedidos con algo empacado que todavía no salen
  (maestro) y la ruta abierta que se está armando (panel derecho).
*/
function ParaDespacho({ orders, ordersLoading, ordersError, routes, openRouteId, onOpenRoute, filter, onFilter, availability, isBusy, act, onRemove, onNewRoute }) {
  const ordersById = useMemo(() => new Map(orders.map((o) => [String(o._id), o])), [orders]);
  const pendingRoutes = routes.filter((r) => !r.departedAt);
  const openRoute = routes.find((r) => r._id === openRouteId) || null;
  const buildingRoute = openRoute && !openRoute.departedAt ? openRoute : null;
  // Aquí «la lista» del detalle son las rutas por salir (el selector de arriba).
  useRememberedSelection("logistica/despacho", { selectedId: openRouteId, setSelectedId: onOpenRoute, ids: pendingRoutes.map((r) => r._id) });

  // Todo se recalcula con cada lectura de datos: grupos, orden, chips y conteos.
  const [query, setQuery] = useState("");
  // La búsqueda mira el pedido, el cliente y la ruta (por código, completo o parcial).
  const found = useMemo(
    () =>
      orders.filter((o) =>
        matchesQuery([o.orderNumber, o.customer?.name, o.delivery?.route ? `${routeLabel(o.delivery.route)} ${o.delivery.route.zone || ""}` : ""].filter(Boolean).join(" ").toLowerCase(), query),
      ),
    [orders, query],
  );
  const counts = useMemo(() => dispatchCounts(found), [found]);
  const groups = useMemo(() => groupDispatchOrders(found, filter), [found, filter]);
  const moved = useMovedIds(orders, dispatchGroup);
  const routesById = useMemo(() => new Map(routes.map((r) => [String(r._id), r])), [routes]);

  function add(order) {
    const url = `/routes/${buildingRoute._id}/orders`;
    act(
      () => api.post(url, { orderId: order._id }),
      `${order.orderNumber} agregado a ${routeRef(buildingRoute)}`,
      () => api.del(`${url}/${order._id}`),
      `order:${order._id}`,
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
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar por pedido, cliente o ruta" />
            <FilterChips compact value={filter} onChange={onFilter} showEmpty options={CHIPS.map((c) => ({ ...c, count: counts[c.key] }))} />
          </>
        }
      >
        {ordersLoading && !orders.length ? (
          <EmptyState title="Cargando pedidos…" />
        ) : ordersError ? (
          <EmptyState title="No se pudieron cargar los pedidos" description={ordersError} />
        ) : groups.length === 0 ? (
          <EmptyState title={orders.length ? "Ningún pedido coincide con el filtro o la búsqueda." : "No hay pedidos empacados por despachar."} />
        ) : (
          groups.map((g) => (
            <Fragment key={g.key}>
              <ListGroupHeader label={g.label} count={g.items.length} />
              {g.items.map((o) => (
                <OrderRow
                  key={o._id}
                  order={o}
                  group={g.key}
                  route={routesById.get(routeIdOf(o))}
                  moved={moved.has(String(o._id))}
                  openRoute={buildingRoute}
                  busy={isBusy(`order:${o._id}`)}
                  onAdd={add}
                  onRemove={onRemove}
                  onOpenRoute={onOpenRoute}
                  onNewRoute={onNewRoute}
                />
              ))}
            </Fragment>
          ))
        )}
      </ListPanel>

      <div className="flex min-h-0 flex-col gap-3">
        {pendingRoutes.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-label">Rutas por salir</span>
            <PillSelector
              options={pendingRoutes.map((r) => ({ value: r._id, label: `${routeLabel(r)} · ${r.zone}` }))}
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
              isBusy={isBusy}
              act={act}
              onRemove={onRemove}
              onDeleted={() => onOpenRoute(null)}
            />
          ) : (
            <DetailPanel>
              <EmptyState
                icon={IconOrders}
                title={openRoute ? `${routeLabel(openRoute)} ya salió` : "Ninguna ruta abierta"}
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
