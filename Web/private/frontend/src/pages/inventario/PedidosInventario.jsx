import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useConfirm } from "../../hooks/useConfirm";
import StatusPill from "../../components/ui/StatusPill";
import Modal from "../../components/ui/Modal";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { FilterSelect } from "../../components/ui/Field";
import { SectionCard, AsyncState } from "../../components/ui/SectionCard";
import { IconCheck } from "../../lib/icons";
import { macroStatus, getItemStatusCounts, progressSegments, progressCaption, MACRO_STATUS_LABELS } from "../../lib/orderProgress";
import { buttonClass } from "../../lib/buttonStyles";
import { fmtDateYear } from "../../lib/format";

/*
  Inventario > Pedidos: pedidos que pasaron a Inventario, con verificación
  de stock por línea, empaque y envío a fabricación. Se rediseña en la
  Fase 4; aquí solo se separó de Inventario.jsx sin cambiar su comportamiento.
*/

// Estado de una línea de pedido (Info pedido) -> etiqueta del dominio
// linea-inventario de StatusPill. "Entregado" es del pedido completo.
const LINE_STATUS_LABEL = {
  "Sin Verificar": "Por verificar",
  "En Fabricación": "En fabricación",
  Verificado: "Verificado",
  Empacado: "Empacado",
};

// Opciones del filtro de estado (valor -> macroStatus).
const PEDIDOS_STATUS_FILTERS = ["sinVerificar", "verificado", "enviado", "empacado", "parcial", "entregado"];

const selectFilterClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 outline-none focus:border-brand-400";

function PedidosInventario({ orders, ordersLoading, ordersError, refetchOrders, finishedItems, refetchInventory }) {
  const navigate = useNavigate();
  const { confirm, confirmProps } = useConfirm();
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyWarehouse, setVerifyWarehouse] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sendingToManufacturing, setSendingToManufacturing] = useState(false);
  // Id del pedido cuyos productos se muestran en el modal "Info Pedido" (se
  // guarda el id, no el objeto, para que el modal siempre refleje el estado
  // más reciente tras verificar/empacar/enviar).
  const [pedidoInfoOrderId, setPedidoInfoOrderId] = useState(null);
  // Filtros: por estado macro (barra de Progreso) y "solo con pendientes"
  // (algún producto todavía sin verificar).
  const [pedidosStatusFilter, setPedidosStatusFilter] = useState("");
  const [pedidosOnlyPending, setPedidosOnlyPending] = useState(false);

  // Pedidos que pasaron a Inventario (sentToInventoryAt). Solo informativo:
  // no reserva ni descuenta stock.
  const requestedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.sentToInventoryAt)
        .sort((a, b) => new Date(b.sentToInventoryAt) - new Date(a.sentToInventoryAt)),
    [orders]
  );

  const filteredRequestedOrders = useMemo(() => {
    return requestedOrders.filter((o) => {
      if (pedidosStatusFilter && macroStatus(o) !== pedidosStatusFilter) return false;
      if (pedidosOnlyPending && getItemStatusCounts(o).sinVerificar === 0) return false;
      return true;
    });
  }, [requestedOrders, pedidosStatusFilter, pedidosOnlyPending]);

  const hasActivePedidosFilters = Boolean(pedidosStatusFilter || pedidosOnlyPending);

  const pedidoInfoOrder = useMemo(
    () => requestedOrders.find((o) => o._id === pedidoInfoOrderId) || null,
    [requestedOrders, pedidoInfoOrderId]
  );

  // Bodegas donde ya hay stock del producto/color que se está verificando.
  const verifyMatches = useMemo(() => {
    if (!verifyTarget) return [];
    return finishedItems.filter(
      (i) => i.name === verifyTarget.item.product && (i.color || "") === (verifyTarget.item.color || "")
    );
  }, [finishedItems, verifyTarget]);

  const verifySelectedMatch = verifyMatches.find((m) => m.location === verifyWarehouse);
  const verifyInsufficientSelected = Boolean(
    verifySelectedMatch && (verifySelectedMatch.stock || 0) < (verifyTarget?.item.quantity || 0)
  );
  // Ninguna bodega tiene suficiente existencia: se ofrece "Enviar a
  // fabricación" como alternativa a esperar stock.
  const verifyHasSufficientStock = useMemo(() => {
    if (!verifyTarget) return true;
    return verifyMatches.some((m) => (m.stock || 0) >= (verifyTarget.item.quantity || 0));
  }, [verifyMatches, verifyTarget]);

  // Elimina un pedido de esta pestaña por completo: si algún producto ya
  // estaba verificado, le devuelve las unidades al stock de esa bodega y
  // desmarca verified/packed de todos los productos (el backend se encarga).
  async function handleCancelRequest(o) {
    if (!(await confirm(`¿Eliminar ${o.orderNumber} de Pedidos? Se borra todo su rastro de verificación aquí.`, { danger: true }))) return;
    try {
      await api.del(`/orders/${o._id}/request-inventory`);
      toast.success("Pedido eliminado de la lista");
      refetchOrders();
      refetchInventory();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Se abre desde el modal "Info Pedido": cierra ese modal para dar paso al
  // de verificación (así no quedan dos modales encimados).
  function openVerify(row) {
    setPedidoInfoOrderId(null);
    setVerifyTarget(row);
    setVerifyWarehouse("");
    setVerifyModalOpen(true);
  }

  // Confirma la bodega elegida: resta la cantidad pedida del stock de ese
  // producto/color en esa bodega y marca la línea como verificada.
  async function confirmVerify() {
    if (!verifyTarget || !verifyWarehouse) return;
    setVerifying(true);
    try {
      await api.patch(`/orders/${verifyTarget.order._id}/items/${verifyTarget.index}/verify`, {
        warehouse: verifyWarehouse,
      });
      toast.success(`${verifyTarget.item.product} verificado`);
      setVerifyModalOpen(false);
      refetchOrders();
      refetchInventory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  }

  // Envía la línea a Fabricación cuando no hay stock suficiente en ninguna
  // bodega: no toca inventario, solo marca la línea como enviada.
  async function sendToManufacturing() {
    if (!verifyTarget) return;
    setSendingToManufacturing(true);
    try {
      await api.patch(`/orders/${verifyTarget.order._id}/items/${verifyTarget.index}/send-manufacturing`);
      toast.success(`${verifyTarget.item.product} enviado a fabricación`);
      setVerifyModalOpen(false);
      refetchOrders();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingToManufacturing(false);
    }
  }

  // Empaca un producto ya verificado.
  async function handlePack(row) {
    const ok = await confirm(
      `¿Marcar ${row.item.product} como empacado? El pedido ${row.order.orderNumber} pasará a "Empacado".`,
      { confirmLabel: "Empacar" }
    );
    if (!ok) return;
    try {
      await api.patch(`/orders/${row.order._id}/items/${row.index}/pack`);
      toast.success(`${row.item.product} empacado`);
      refetchOrders();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <SectionCard
        title="Pedidos"
        action={
          <button onClick={() => navigate("/pedidos")} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100">
            Ir a Pedidos
          </button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FilterSelect
            value={pedidosStatusFilter}
            onChange={(e) => setPedidosStatusFilter(e.target.value)}
            className={selectFilterClass}
            options={[{ value: "", label: "Estado: Todos" }, ...PEDIDOS_STATUS_FILTERS.map((key) => ({ value: key, label: MACRO_STATUS_LABELS[key] }))]}
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={pedidosOnlyPending}
              onChange={(e) => setPedidosOnlyPending(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-400"
            />
            Solo con pendientes
          </label>
          {hasActivePedidosFilters ? (
            <button
              onClick={() => { setPedidosStatusFilter(""); setPedidosOnlyPending(false); }}
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>

        <AsyncState
          loading={ordersLoading}
          error={ordersError}
          empty={!ordersLoading && filteredRequestedOrders.length === 0}
          emptyText={
            hasActivePedidosFilters && requestedOrders.length > 0
              ? "Ningún pedido coincide con los filtros."
              : "Aún no hay pedidos en inventario."
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Pedido</th>
                  <th className="pb-3 pr-4 font-semibold">Cliente</th>
                  <th className="pb-3 pr-4 font-semibold">Info Pedido</th>
                  <th className="pb-3 pr-4 font-semibold">Progreso</th>
                  <th className="pb-3 pr-4 font-semibold">Fecha Solicitado</th>
                  <th className="pb-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequestedOrders.map((order) => {
                  const segments = progressSegments(order);
                  const caption = progressCaption(order);
                  return (
                    <tr key={order._id} className="text-slate-600 transition hover:bg-slate-50/60">
                      <td className="py-3 pr-4 font-semibold text-slate-800 whitespace-nowrap">{order.orderNumber}</td>
                      <td className="py-3 pr-4">{order.customer?.name || "—"}</td>
                      <td className="py-3 pr-4">
                        <button onClick={() => setPedidoInfoOrderId(order._id)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">Ver</button>
                      </td>
                      <td className="py-3 pr-4 min-w-[200px]">
                        <div>
                          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            {segments.map((seg) => (
                              <div
                                key={seg.key}
                                className={seg.colorClass}
                                style={{ width: `${seg.pct}%` }}
                                title={`${seg.count} ${seg.label}`}
                              />
                            ))}
                          </div>
                          <p className="mt-1 text-[11px] leading-tight text-slate-500">{caption || "Sin productos"}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">{fmtDateYear(order.sentToInventoryAt)}</td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5 text-xs font-semibold">
                          <button onClick={() => handleCancelRequest(order)} className="rounded-lg bg-tone-rose px-2.5 py-1 text-tone-rose-text hover:brightness-95">Eliminar</button>
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

      <Modal
        open={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        title="Verificar producto en inventario"
        footer={
          <>
            <button onClick={() => setVerifyModalOpen(false)} className={buttonClass("secondary", "modal")}>Cancelar</button>
            {!verifyHasSufficientStock ? (
              <button
                onClick={sendToManufacturing}
                disabled={sendingToManufacturing}
                className={buttonClass("warning", "modal")}
              >
                {sendingToManufacturing ? "Enviando…" : "Enviar a fabricación"}
              </button>
            ) : null}
            <button
              onClick={confirmVerify}
              disabled={verifying || !verifyWarehouse || verifyInsufficientSelected}
              className={buttonClass("primary", "modal")}
            >
              {verifying ? "Verificando…" : "Confirmar"}
            </button>
          </>
        }
      >
        {verifyTarget ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Buscando <strong>{verifyTarget.item.quantity} {verifyTarget.item.product}</strong>
              {verifyTarget.item.color ? ` (${verifyTarget.item.color})` : ""} para el pedido{" "}
              <strong>{verifyTarget.order.orderNumber}</strong> en las bodegas disponibles.
            </p>
            {verifyMatches.length === 0 ? (
              <p className="rounded-xl bg-tone-amber px-3.5 py-2.5 text-sm text-tone-amber-text">
                No se encontró este producto en ninguna bodega de Artículos en almacén.
              </p>
            ) : (
              <div className="space-y-2">
                {verifyMatches.map((m) => {
                  const insufficient = (m.stock || 0) < verifyTarget.item.quantity;
                  return (
                    <label
                      key={m._id}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition ${
                        verifyWarehouse === m.location ? "border-brand-400 bg-brand-50" : "border-slate-200"
                      } ${insufficient ? "opacity-60" : "cursor-pointer hover:border-brand-300"}`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="verify-warehouse"
                          value={m.location}
                          checked={verifyWarehouse === m.location}
                          disabled={insufficient}
                          onChange={(e) => setVerifyWarehouse(e.target.value)}
                        />
                        <span className="font-semibold text-slate-800">{m.location || "—"}</span>
                      </span>
                      <span className={insufficient ? "font-semibold text-tone-rose-text" : "text-slate-500"}>
                        {(m.stock || 0).toLocaleString("es-SV")} {m.unit} disponibles
                        {insufficient ? " · insuficiente" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!pedidoInfoOrder}
        onClose={() => setPedidoInfoOrderId(null)}
        title={`Productos del pedido ${pedidoInfoOrder?.orderNumber || ""}`}
        size="lg"
        footer={
          <button onClick={() => setPedidoInfoOrderId(null)} className={buttonClass("secondary", "modal")}>Cerrar</button>
        }
      >
        {pedidoInfoOrder?.items?.length ? (
          <div className="space-y-2">
            {pedidoInfoOrder.items.map((it, idx) => {
              const row = { order: pedidoInfoOrder, item: it, index: idx };
              // Mismo orden de prioridad que en todos lados (empacado > verificado
              // > enviado a fabricación > sin verificar), "Entregado" aparte
              // porque es del pedido completo, no de la línea.
              const itemStatus = pedidoInfoOrder.delivery?.driver
                ? "Entregado"
                : it.packed
                ? "Empacado"
                : it.verified
                ? "Verificado"
                : it.sentToManufacturing
                ? "En Fabricación"
                : "Sin Verificar";
              return (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-800">{it.product}{it.color ? ` · ${it.color}` : ""}</p>
                    <p className="text-xs text-slate-500">{it.quantity} unidades</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {itemStatus === "Empacado" || itemStatus === "Entregado" ? (
                      <IconCheck width={14} height={14} className="text-tone-green-dot" />
                    ) : null}
                    {itemStatus === "Entregado" ? (
                      <StatusPill status="Entregado" domain="pedido" />
                    ) : (
                      <StatusPill status={LINE_STATUS_LABEL[itemStatus]} domain="linea-inventario" />
                    )}
                    {itemStatus === "Sin Verificar" ? (
                      <button onClick={() => openVerify(row)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">Verificar</button>
                    ) : itemStatus === "En Fabricación" ? (
                      <span className="text-xs text-slate-400">esperando lote</span>
                    ) : itemStatus === "Verificado" ? (
                      <button onClick={() => handlePack(row)} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">Empacar</button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Este pedido no tiene productos.</p>
        )}
      </Modal>

      <ConfirmModal {...confirmProps} />
    </>
  );
}

export default PedidosInventario;
