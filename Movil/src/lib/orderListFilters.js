// Filtro de búsqueda + Estado + Pago de PedidosScreen, portado de
// filteredList en Web/private/frontend/src/pages/Pedidos.jsx. Los KPIs se
// calculan sobre la lista completa sin filtrar, igual que en la web.
export function filterOrdersList(orders, { search, status, paymentStatus }) {
  const q = (search || "").trim().toLowerCase();
  return orders.filter((o) => {
    if (q) {
      const haystack = `${o.orderNumber || ""} ${o.customer?.name || ""} ${o.customer?.email || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (status && o.status !== status) return false;
    if (paymentStatus && o.paymentStatus !== paymentStatus) return false;
    return true;
  });
}
