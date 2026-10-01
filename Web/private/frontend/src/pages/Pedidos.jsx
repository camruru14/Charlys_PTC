import { routeLabel } from "../lib/logistics";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useAuth } from "../hooks/useAuth";
import { useUrlState } from "../hooks/useUrlState";
import { useRememberedSelection } from "../hooks/useRememberedSelection";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import StatusPill from "../components/ui/StatusPill";
import SearchInput from "../components/ui/SearchInput";
import FilterChips from "../components/ui/FilterChips";
import Stepper from "../components/ui/Stepper";
import StatTile from "../components/ui/StatTile";
import EmptyState from "../components/ui/EmptyState";
import { MasterDetail, ListPanel, DetailPanel, ListRow } from "../components/ui/MasterDetail";
import ConfirmModal from "../components/ui/ConfirmModal";
import { fmtMoney, fmtNumber, fmtDate, fmtDateYear } from "../lib/format";
import { orderJourneySteps, lastStatusEntry } from "../lib/orderJourney";
import ColorSwatch from "../components/ui/ColorSwatch";
import { IconOrders, IconTrash } from "../lib/icons";
import { statusTone } from "../lib/statusDomains";

// Chips de la lista: key -> filtro sobre el pedido.
const CHIP_FILTERS = {
  all: () => true,
  pendientes: (o) => o.status === "Pendiente",
  enRuta: (o) => o.status === "En Tránsito",
};

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

function OrderRow({ order, selected, onSelect }) {
  return (
    <ListRow selected={selected} onClick={onSelect}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-bold tabular-nums text-ink">{order.orderNumber}</span>
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
                            {it.product}
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
  const { confirm, confirmProps } = useConfirm();
  const { user } = useAuth();
  const { data, loading, error, refetch } = useFetch("/orders");
  const [selectedId, setSelectedId] = useUrlState("id");
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const activeCount = useMemo(() => list.filter((o) => o.status !== "Entregado").length, [list]);

  const chipOptions = useMemo(
    () => [
      { key: "all", label: "Todos", count: list.length },
      { key: "pendientes", label: "Pendientes", count: list.filter(CHIP_FILTERS.pendientes).length, tone: statusTone("Pendiente", "pedido") },
      { key: "enRuta", label: "En ruta", count: list.filter(CHIP_FILTERS.enRuta).length, tone: statusTone("En Tránsito", "pedido") },
    ],
    [list],
  );

  // Búsqueda por N° de pedido, cliente o correo + chip activo.
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byChip = CHIP_FILTERS[chip] || CHIP_FILTERS.all;
    return list.filter((o) => {
      if (!byChip(o)) return false;
      if (!q) return true;
      const haystack = `${o.orderNumber || ""} ${o.customer?.name || ""} ${o.customer?.email || ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [list, search, chip]);

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
      />

      <MasterDetail listWidth={452}>
        <ListPanel
          header={
            <>
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar pedido" />
              <FilterChips options={chipOptions} value={chip} onChange={setChip} />
            </>
          }
        >
          {loading && !data ? (
            <EmptyState title="Cargando pedidos…" />
          ) : error ? (
            <EmptyState title="No se pudieron cargar los pedidos" description={error} />
          ) : filteredList.length === 0 ? (
            <EmptyState
              title={list.length === 0 ? "No hay pedidos." : "Ningún pedido coincide con la búsqueda."}
              description={list.length === 0 ? "Los pedidos llegan desde la tienda en línea." : undefined}
            />
          ) : (
            filteredList.map((o) => (
              <OrderRow key={o._id} order={o} selected={o._id === selectedId} onSelect={() => setSelectedId(o._id)} />
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
