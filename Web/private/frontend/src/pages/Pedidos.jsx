import { lineLabel } from "../lib/lineLabel";
import { routeLabel } from "../lib/logistics";
import { Fragment, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useAuth } from "../hooks/useAuth";
import { useUrlState } from "../hooks/useUrlState";
import { useRememberedSelection } from "../hooks/useRememberedSelection";
import { useDateRange, rangeLabel } from "../context/dateRange";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import StatusPill from "../components/ui/StatusPill";
import SearchInput from "../components/ui/SearchInput";
import ListGroupHeader from "../components/ui/ListGroupHeader";
import DateRangePicker from "../components/ui/DateRangePicker";
import { FilterSelect } from "../components/ui/Field";
import Stepper from "../components/ui/Stepper";
import StatTile from "../components/ui/StatTile";
import EmptyState from "../components/ui/EmptyState";
import { MasterDetail, ListPanel, DetailPanel, ListRow } from "../components/ui/MasterDetail";
import ConfirmModal from "../components/ui/ConfirmModal";
import { fmtMoney, fmtNumber, fmtDate, fmtDateYear } from "../lib/format";
import { orderJourneySteps, lastStatusEntry } from "../lib/orderJourney";
import ColorSwatch from "../components/ui/ColorSwatch";
import { IconClock, IconOrders, IconTrash } from "../lib/icons";
import { statusTone } from "../lib/statusDomains";
import { TONE_DOT, NOTE_TEXT } from "../lib/tones";
import { filterSelectClass } from "../lib/filterStyles";
import { PEDIDO_GROUPS, groupOrders, matchesOrderSearch, orderTimeNote } from "../lib/orderList";
import MarkAllSeen from "../components/ui/MarkAllSeen";
import { useUnseen } from "../hooks/useActivity";

// Valores de ?estado=: «todos» o la clave de un grupo de PEDIDO_GROUPS.
const STATE_KEYS = ["todos", ...PEDIDO_GROUPS.map((g) => g.key)];

// Los pedidos llegan de la tienda en línea (ya pagados): el panel no los crea ni
// los edita. Lo único que modifica es eliminar los ya entregados para que no se
// acumulen; devuelve por qué no se puede, o null si sí (el backend lo vuelve a
// validar).
function deleteBlocker(order) {
  if (order.status !== "Entregado") return "Solo se pueden eliminar pedidos entregados";
  const route = order.delivery?.route;
  if (route && route.status !== "Completada") return "El pedido está en una ruta activa";
  return null;
}

function OrderRow({ order, selected, unseen, onSelect }) {
  const note = orderTimeNote(order);
  return (
    <ListRow selected={selected} unseen={unseen} onClick={onSelect}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-[13.5px] font-bold tabular-nums text-ink">{order.orderNumber}</span>
          {note ? (
            <span
              className={`inline-flex min-w-0 items-center gap-1 text-[11.5px] tabular-nums ${note.bold ? "font-bold" : ""} ${NOTE_TEXT[note.tone] || "text-muted"}`}
            >
              <IconClock width={11} height={11} className="shrink-0" />
              <span className="truncate">{note.text}</span>
            </span>
          ) : null}
        </span>
        <StatusPill status={order.status} domain="pedido" variant="dot" />
      </div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="truncate text-[12.5px] text-ink-2">{order.customer?.name || "—"}</span>
        <span className="shrink-0 text-[12.5px] tabular-nums text-ink-2">{fmtMoney(order.total)}</span>
      </div>
    </ListRow>
  );
}

function OrderDetail({ order, canDelete, onDelete }) {
  const steps = orderJourneySteps(order);
  const last = lastStatusEntry(order);
  const items = order.items || [];
  const units = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const address = order.delivery?.address || order.customer?.address;
  const blocker = deleteBlocker(order);

  return (
    <DetailPanel
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-1 text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-ink">{order.orderNumber}</h2>
            <StatusPill status={order.status} domain="pedido" size="lg" />
            {order.sentToInventoryAt ? (
              <span className="inline-flex h-[22px] items-center rounded-[7px] bg-primary-soft px-2 text-[11px] font-semibold text-primary-soft-text">
                Pasó solo a Inventario
              </span>
            ) : null}
            {order.paymentDemo ? (
              <span className="inline-flex h-[22px] items-center rounded-[7px] bg-surface-2 px-2 text-[11px] font-semibold text-muted">Pago de prueba</span>
            ) : null}
          </div>
          {canDelete ? (
            // El span lleva el motivo: un botón deshabilitado no muestra su title en todos los navegadores.
            <span title={blocker || undefined}>
              <Button variant="danger" size="detail" icon={IconTrash} disabled={Boolean(blocker)} onClick={onDelete}>
                Eliminar
              </Button>
            </span>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <p className="t-label">Recorrido del pedido</p>
          <div className="overflow-x-auto pb-1">
            <div className="min-w-[540px]">
              <Stepper steps={steps} />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatTile label="Cliente">
            <p className="text-[14px] font-bold text-ink">{order.customer?.name || "—"}</p>
            <p className="mt-0.5 break-words text-[12.5px] text-ink-2">{order.customer?.email || "—"}</p>
            <p className="text-[12.5px] tabular-nums text-ink-2">{order.customer?.phone || "—"}</p>
          </StatTile>
          <StatTile label="Entrega">
            <p className="break-words text-[13px] text-ink">{address || "—"}</p>
            <p className="t-aux mt-0.5 tabular-nums">
              {order.delivery?.route?.code || order.delivery?.route?.number != null ? `${order.delivery.route.zone} · ${routeLabel(order.delivery.route)}` : "sin asignar"}
            </p>
          </StatTile>
          <StatTile label="Fechas">
            <p className="text-[12.5px] tabular-nums text-ink-2">
              <span className="text-muted">Solicitado · </span>
              {fmtDateYear(order.createdAt)}
            </p>
            <p className="mt-0.5 text-[12.5px] tabular-nums text-ink-2">
              <span className="text-muted">Última acción · </span>
              {last ? `${fmtDate(last.at)} · ${last.status.toLowerCase()}` : "—"}
            </p>
          </StatTile>
        </div>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="t-label">Productos del pedido</p>
            <p className="t-aux tabular-nums">
              {fmtNumber(items.length)} {items.length === 1 ? "línea" : "líneas"} · {fmtNumber(units)}{" "}
              {units === 1 ? "unidad" : "unidades"}
            </p>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-line">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="h-8 bg-band text-[10.5px] font-bold uppercase tracking-[0.1em] text-band-text">
                    <th className="px-4 font-bold">Producto</th>
                    <th className="px-3 font-bold">Color</th>
                    <th className="px-3 text-right font-bold">Cant.</th>
                    <th className="px-3 text-right font-bold">Unitario</th>
                    <th className="px-4 text-right font-bold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="t-aux px-4 py-4 text-center">
                        Este pedido no tiene productos.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr key={idx} className="h-11 border-b border-line-soft last:border-0">
                        <td className="px-4">
                          <span className="flex items-center gap-2 t-row-name">
                            <ColorSwatch color={it.color} />
                            {lineLabel(it)}
                          </span>
                        </td>
                        <td className="t-row px-3">{it.color || "—"}</td>
                        <td className="t-row px-3 text-right tabular-nums">{fmtNumber(it.quantity)}</td>
                        <td className="t-row px-3 text-right tabular-nums">{fmtMoney(it.unitPrice)}</td>
                        <td className="t-row px-4 text-right tabular-nums">{fmtMoney(it.subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line-soft bg-surface-2 px-4 py-3">
              <span className="text-[13px] font-semibold text-ink-2">Total del pedido</span>
              <span className="text-[16px] font-bold tabular-nums text-ink">{fmtMoney(order.total)}</span>
            </div>
          </div>
        </section>
      </div>
    </DetailPanel>
  );
}

function Pedidos() {
  // Novedades: los pedidos nuevos o que cambiaron se marcan hasta que se abren.
  const { confirm, confirmProps } = useConfirm();
  const { user } = useAuth();
  const { data, loading, error, refetch } = useFetch("/orders");
  const [selectedId, setSelectedId] = useUrlState("id");
  // El pedido abierto en el detalle no se marca como nuevo y, si algo lo vuelve a marcar, se ve solo.
  const { isUnseen, markSeen } = useUnseen("pedidos", { openId: selectedId });
  const [search, setSearch] = useState("");
  const range = useDateRange();
  const [estado, setEstado] = useUrlState("estado", "todos", { allowed: STATE_KEYS });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const activeCount = useMemo(() => list.filter((o) => o.status !== "Entregado").length, [list]);

  // Grupos con la búsqueda (N° de pedido, cliente o correo) y el rango (los
  // conteos del combobox salen de aquí). El rango solo filtra «Entregado»; no
  // se muestran los grupos vacíos ni los que no son el estado elegido.
  const found = useMemo(() => list.filter((o) => matchesOrderSearch(o, search)), [list, search]);
  const allGroups = useMemo(() => groupOrders(found, range), [found, range]);
  const sections = useMemo(() => allGroups.filter((g) => g.items.length > 0 && (estado === "todos" || g.key === estado)), [allGroups, estado]);
  const filteredList = useMemo(() => sections.flatMap((g) => g.items), [sections]);
  const stateOptions = useMemo(
    () => [
      { value: "todos", label: "Todos", meta: fmtNumber(allGroups.reduce((n, g) => n + g.items.length, 0)) },
      ...allGroups.map((g) => ({
        value: g.key,
        label: g.status,
        dot: TONE_DOT[statusTone(g.status, "pedido")],
        meta: fmtNumber(g.items.length),
        muted: g.items.length === 0,
      })),
    ],
    [allGroups],
  );
  const estadoGroup = PEDIDO_GROUPS.find((g) => g.key === estado);

  const selected = useMemo(() => list.find((o) => o._id === selectedId) || null, [list, selectedId]);
  useRememberedSelection("pedidos", { selectedId, setSelectedId, ids: filteredList.map((o) => o._id), ready: !loading });

  async function handleDelete(o) {
    const message = `¿Eliminar el pedido ${o.orderNumber}? Esta acción no se puede deshacer. La venta se conserva en Finanzas y el cliente lo sigue viendo en su historial de la tienda.`;
    if (!(await confirm(message, { danger: true, title: "Eliminar pedido" }))) return;
    try {
      await api.del(`/orders/${o._id}`);
      toast.success("Pedido eliminado");
      if (selectedId === o._id) setSelectedId(null);
      refetch();
    } catch (err) {
      // El backend explica por qué no se pudo (no entregado, ruta activa, sin permiso).
      toast.error(err.message, { duration: 6000 });
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Pedidos"
        subtitle={`${fmtNumber(activeCount)} activos · los pedidos llegan desde la tienda en línea`}
        actions={<DateRangePicker />}
      />

      <MasterDetail listWidth={452}>
        <ListPanel
          header={
            <>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-[15px] font-bold text-ink">Pedidos</h2>
                  <span className="flex items-baseline gap-3">
                    <MarkAllSeen activityKey="pedidos" />
                    <span className="t-aux tabular-nums">
                      {fmtNumber(filteredList.length)} {filteredList.length === 1 ? "pedido" : "pedidos"}
                    </span>
                  </span>
                </div>
                <p className="t-aux tabular-nums">{rangeLabel(range)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar pedido, cliente o correo" className="min-w-0 flex-1" />
                <FilterSelect
                  label="Estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  options={stateOptions}
                  panelMinWidth={208}
                  className={`${filterSelectClass} w-[140px] !min-w-0 !gap-1 !px-2`}
                />
              </div>
            </>
          }
        >
          {loading && !data ? (
            <EmptyState title="Cargando pedidos…" />
          ) : error ? (
            <EmptyState title="No se pudieron cargar los pedidos" description={error} />
          ) : sections.length === 0 ? (
            estadoGroup ? (
              <EmptyState title={`No hay pedidos «${estadoGroup.status}» ${estadoGroup.ranged ? "en este rango" : "con estos filtros"}.`} />
            ) : search.trim() ? (
              <EmptyState title="No hay pedidos con estos filtros." />
            ) : (
              <EmptyState title="No hay pedidos." description="Los pedidos llegan desde la tienda en línea." />
            )
          ) : (
            sections.map((g) => (
              <Fragment key={g.key}>
                <ListGroupHeader label={g.label} note={g.note} count={g.items.length} />
                {g.items.map((o) => (
                  <OrderRow
                    key={o._id}
                    order={o}
                    selected={o._id === selectedId}
                    unseen={isUnseen(o._id)}
                    onSelect={() => {
                      setSelectedId(o._id);
                      markSeen(o._id);
                    }}
                  />
                ))}
              </Fragment>
            ))
          )}
        </ListPanel>

        {selected ? (
          <OrderDetail order={selected} canDelete={Boolean(user?.isAdmin)} onDelete={() => handleDelete(selected)} />
        ) : (
          <DetailPanel>
            <EmptyState
              icon={IconOrders}
              title={selectedId && !loading ? "Este pedido ya no existe" : "Selecciona un pedido"}
              description="Su ficha completa aparece aquí: recorrido, cliente, entrega y productos."
            />
          </DetailPanel>
        )}
      </MasterDetail>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Pedidos;
