import { useState } from "react";
import { api } from "../../lib/api";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import StatTile from "../../components/ui/StatTile";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import PillSelector from "../../components/ui/PillSelector";
import { MasterDetail, ListPanel, DetailPanel } from "../../components/ui/MasterDetail";
import { statusTone } from "../../lib/statusDomains";
import { TONE_DOT } from "../../lib/tones";
import { fmtNumber, fmtMoney, fmtDate, fmtTime, fmtElapsed } from "../../lib/format";
import { IconTruck } from "../../lib/icons";
import { routeProgress, progressNote, personName } from "../../lib/logistics";

const STOPS_GRID = "44px 128px minmax(0,1fr) 176px 92px 132px 120px";

function RouteListRow({ route, selected, onSelect }) {
  const { delivered, total } = routeProgress(route);
  const pct = total ? (delivered / total) * 100 : 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      className={`grid w-full grid-cols-[5px_1fr] border-b border-line-soft text-left transition ${selected ? "bg-select-bg" : "hover:bg-surface-2"}`}
    >
      <span className={selected ? "bg-select-bar" : ""} />
      <span className="flex min-w-0 flex-col gap-2 px-3.5 py-3">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-[14px] font-bold text-ink">
            Ruta {route.number} · {route.zone}
          </span>
          <StatusPill status={route.status} domain="ruta" variant="dot" />
        </span>
        <span className="flex items-center gap-2">
          <Avatar person={route.driver} />
          <span className={`min-w-0 flex-1 truncate text-[12.5px] ${route.driver ? "text-ink-2" : "text-muted"}`}>
            {personName(route.driver) || "Sin motorista asignado"}
          </span>
          <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-2">{route.vehicle || "—"}</span>
        </span>
        <span className="flex items-center gap-2.5">
          <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-line-soft">
            <span className={`block h-full rounded-full ${TONE_DOT[statusTone(route.status, "ruta")]}`} style={{ width: `${pct}%` }} />
          </span>
          <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-muted">
            {delivered}/{total}
          </span>
        </span>
      </span>
    </button>
  );
}

function StopNumber({ n, state }) {
  const cls =
    state === "done"
      ? "bg-tone-green text-tone-green-text"
      : state === "current"
        ? "bg-primary text-white"
        : "bg-tone-gray text-tone-gray-text";
  return <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${cls}`}>{n}</span>;
}

function RouteDetail({ route, availability, busy, act }) {
  const [reassign, setReassign] = useState(false);
  const { stops, delivered, total, current, deliveredValue, totalValue } = routeProgress(route);
  const departed = Boolean(route.departedAt);
  const routeUrl = `/routes/${route._id}`;
  const driverId = route.driver?._id || route.driver || "";

  const driverOptions = (availability?.drivers || []).map((d) => ({
    value: d._id,
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
    act(
      () => api.patch(routeUrl, { [field]: value }),
      `${label} de la Ruta ${route.number} actualizado`,
      () => api.patch(routeUrl, { [field]: previous || null }),
    );
  }

  return (
    <DetailPanel
      header={
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">
                Ruta {route.number} · {route.zone}
              </h2>
              <StatusPill status={route.status} domain="ruta" size="lg" />
            </div>
            {!departed ? (
              <Button variant="secondary" size="detail" onClick={() => setReassign((v) => !v)}>
                Reasignar
              </Button>
            ) : null}
          </div>
          {reassign && !departed ? (
            <div className="flex flex-col gap-2.5 rounded-[12px] border border-line-soft bg-surface px-3.5 py-3">
              <div className="flex items-start gap-3">
                <span className="t-label w-[72px] shrink-0 pt-1.5">Motorista</span>
                <PillSelector options={driverOptions} value={String(driverId)} onChange={(v) => change("driver", v, String(driverId), "Motorista")} />
              </div>
              <div className="flex items-start gap-3">
                <span className="t-label w-[72px] shrink-0 pt-1.5">Vehículo</span>
                <PillSelector options={vehicleOptions} value={route.vehicle || ""} onChange={(v) => change("vehicle", v, route.vehicle, "Vehículo")} />
              </div>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-[266px_repeat(3,minmax(0,1fr))]">
          <div className="flex items-center gap-3 rounded-[12px] border border-line-soft bg-surface-2 px-3.5 py-3">
            <Avatar person={route.driver} size={40} tone="solid" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-ink">{personName(route.driver) || "Sin motorista asignado"}</p>
              <p className="t-aux tabular-nums">Motorista · {route.driver?.phone || "—"}</p>
            </div>
          </div>
          <StatTile label="Paradas" value={`${fmtNumber(delivered)} / ${fmtNumber(total)}`} note={progressNote(delivered, total)} />
          <StatTile
            label="Entregado"
            value={fmtMoney(deliveredValue, 0)}
            valueClassName="text-tone-green-text"
            note={`de ${fmtMoney(totalValue, 0)} en el camión`}
          />
          <StatTile label="Salida" value={departed ? fmtTime(route.departedAt) : "—"} note={departed ? fmtElapsed(route.departedAt) : "todavía no sale"} />
        </div>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-label">Paradas de la ruta</p>
            <p className="t-aux tabular-nums">
              Vehículo {route.vehicle || "—"}
              {departed ? ` · salió ${fmtTime(route.departedAt)}` : ""}
            </p>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-line">
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                <div className="grid h-8 items-center bg-band" style={{ gridTemplateColumns: STOPS_GRID }}>
                  {["#", "Pedido", "Cliente", "Dirección", "Hora", "Estado", "Acción"].map((h, i) => (
                    <span key={h} className={`t-label !text-band-text ${i === 0 ? "text-center" : ""}`}>
                      {h}
                    </span>
                  ))}
                </div>
                {stops.length === 0 ? <EmptyState title="Esta ruta todavía no tiene pedidos." /> : null}
                {stops.map((stop, i) => {
                  const state = stop.delivered ? "done" : i === current ? "current" : "pending";
                  const order = stop.order;
                  return (
                    <div
                      key={`${order._id}-${i}`}
                      className={`grid h-11 items-center border-b border-line-soft last:border-0 ${state === "current" ? "bg-select-bg" : ""}`}
                      style={{ gridTemplateColumns: STOPS_GRID }}
                    >
                      <span className="flex justify-center">
                        <StopNumber n={i + 1} state={state} />
                      </span>
                      <span className="t-row-name tabular-nums">{order.orderNumber}</span>
                      <span className="truncate pr-3 text-[13px] text-ink">{order.customer?.name || "—"}</span>
                      <span className="truncate pr-3 text-[12.5px] text-ink-2">{order.delivery?.address || order.customer?.address || "—"}</span>
                      <span className="text-[12.5px] tabular-nums text-ink-2">{stop.deliveredAt ? fmtTime(stop.deliveredAt) : "—"}</span>
                      <span>
                        <StatusPill
                          status={stop.delivered ? "Entregado" : state === "current" ? "En tránsito" : "Pendiente"}
                          domain="parada"
                        />
                      </span>
                      <span className="pr-3">
                        {state === "current" ? (
                          <Button
                            variant="pack"
                            size="row"
                            disabled={busy}
                            onClick={() =>
                              act(
                                () => api.patch(`${routeUrl}/orders/${order._id}/deliver`),
                                `${order.orderNumber} entregado`,
                                () => api.patch(`${routeUrl}/orders/${order._id}/undeliver`),
                              )
                            }
                          >
                            Entregado
                          </Button>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </DetailPanel>
  );
}

/*
  Logística > En tránsito: rutas de hoy (maestro) y el seguimiento de la
  ruta abierta (detalle), parada por parada.
*/
function EnTransito({ routes, loading, error, selectedId, onSelect, unassignedCount, onAssign, availability, busy, act }) {
  const selected = routes.find((r) => r._id === selectedId) || null;
  return (
    <MasterDetail listWidth={392}>
      <ListPanel
        header={
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-bold text-ink">Rutas de hoy</h2>
            <span className="t-aux tabular-nums">
              {fmtDate(new Date())} · {fmtNumber(routes.length)} {routes.length === 1 ? "ruta" : "rutas"}
            </span>
          </div>
        }
        footer={
          <div className="-my-2.5 flex h-10 items-center justify-between gap-3">
            <span className="t-aux tabular-nums">
              {fmtNumber(unassignedCount)} {unassignedCount === 1 ? "pedido" : "pedidos"} sin ruta asignada
            </span>
            <button type="button" onClick={onAssign} className="text-[12.5px] font-semibold text-primary hover:underline">
              Asignar
            </button>
          </div>
        }
      >
        {loading && !routes.length ? (
          <EmptyState title="Cargando rutas…" />
        ) : error ? (
          <EmptyState title="No se pudieron cargar las rutas" description={error} />
        ) : routes.length === 0 ? (
          <EmptyState icon={IconTruck} title="Todavía no hay rutas hoy." description="Arma una con «Armar ruta»." />
        ) : (
          routes.map((r) => <RouteListRow key={r._id} route={r} selected={r._id === selectedId} onSelect={() => onSelect(r._id)} />)
        )}
      </ListPanel>

      {selected ? (
        <RouteDetail key={selected._id} route={selected} availability={availability} busy={busy} act={act} />
      ) : (
        <DetailPanel>
          <EmptyState icon={IconTruck} title={selectedId && !loading ? "Esta ruta no es de hoy o ya no existe" : "Selecciona una ruta"} description="Sigue sus paradas y marca cada entrega." />
        </DetailPanel>
      )}
    </MasterDetail>
  );
}

export default EnTransito;
