import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useFillHeight } from "../hooks/useFillHeight";
import { useWideLayout } from "../hooks/useWideLayout";
import { useDateRange } from "../context/dateRange";
import ConfirmModal from "../components/ui/ConfirmModal";
import PageHeader from "../components/ui/PageHeader";
import DateRangePicker from "../components/ui/DateRangePicker";
import QuickEntry from "../components/finance/QuickEntry";
import CategoryPanel from "../components/finance/CategoryPanel";
import Ledger from "../components/finance/Ledger";
import TransactionModal from "../components/finance/TransactionModal";
import { categoryTone, useExpenseCategories } from "../lib/expenseCategories";
import { buildLedger, filterLedger, ledgerSummary, OTHER_INCOME, SALES_CATEGORY, transactionsCsv } from "../lib/finance";
import { dayKey, inRange, statusLabel } from "../lib/transactionFilters";
import { getPageMeta } from "../lib/nav";
import { useMarkSeen } from "../hooks/useActivity";

// Alto mínimo del bloque de abajo: más bajo que el predeterminado para que una ventana de
// 1366×768 siga sin scroll (el panel y el libro hacen scroll o paginan por dentro).
const MIN_HEIGHT = 380;

// Cuánto tiempo se resalta en verde el movimiento recién registrado.
const HIGHLIGHT_MS = 4000;

/*
  Finanzas: registro rápido arriba; abajo, a la izquierda, los gastos por
  categoría contra el presupuesto y, a la derecha, el libro de movimientos por
  día. Las ventas de la tienda entran solas y no se editan ni se borran; todo
  lo demás se anota a mano. Las categorías vienen de /expense-categories
  (Configuración › Categorías de gasto).
*/
function Finanzas() {
  // Novedades: abrir el módulo marca su burbuja como vista (y lo que llegue mientras sigue abierto).
  useMarkSeen("finanzas");
  const range = useDateRange();
  const { confirm, confirmProps } = useConfirm();
  const { data, loading, error, refetch } = useFetch("/transactions");
  const { categories, loading: categoriesLoading, error: categoriesError } = useExpenseCategories();

  const [tab, setTab] = useState("todos");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const gridRef = useRef(null);
  const wide = useWideLayout();
  const gridHeight = useFillHeight(gridRef, wide, MIN_HEIGHT);
  const timer = useRef(null);
  const now = new Date();

  useEffect(() => () => clearTimeout(timer.current), []);

  const raw = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const categoryByName = useMemo(() => new Map(categories.map((c) => [c.name, c])), [categories]);

  // Lo que se ve en el libro: rango + pestaña + categoría + búsqueda.
  const list = useMemo(() => filterLedger(raw, { range, tab, category, query }), [raw, range, tab, category, query]);
  const ledger = useMemo(() => buildLedger(list), [list]);
  const summary = useMemo(() => ledgerSummary(raw, range), [raw, range]);
  const pendingCount = useMemo(() => raw.filter((t) => t.status === "Pendiente" && inRange(t, range)).length, [raw, range]);

  // «Todas las categorías» + las de gasto (con su color) + las de ingreso que ya tienen movimientos.
  const categoryOptions = useMemo(() => {
    const used = new Set(raw.map((t) => t.category));
    const options = [{ value: "", label: "Todas las categorías" }];
    for (const c of categories) {
      if (c.archived && !used.has(c.name)) continue;
      options.push({ value: c.name, label: c.archived ? `${c.name} (archivada)` : c.name, dot: categoryTone(c.color).dot });
    }
    options.push({ value: OTHER_INCOME, label: OTHER_INCOME, dot: categoryTone("green").dot });
    if (used.has(SALES_CATEGORY)) options.push({ value: SALES_CATEGORY, label: SALES_CATEGORY, dot: categoryTone("green").dot });
    return options;
  }, [categories, raw]);

  function handleSaved(id) {
    refetch();
    if (!id) return;
    setHighlightId(id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
  }

  async function handlePay(t) {
    try {
      await api.patch(`/transactions/${t._id}/pay`);
      toast.success(`${t.reference} marcado como pagado`);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(t) {
    if (!(await confirm(`¿Eliminar «${t.concept}» (${t.reference})? Si tiene factura adjunta, también se borra.`, { danger: true }))) return;
    try {
      await api.del(`/transactions/${t._id}`);
      toast.success("Movimiento eliminado");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function handleExport() {
    if (!list.length) return toast.error("No hay movimientos para exportar");
    const blob = new Blob([transactionsCsv(list, (t) => statusLabel(t, now))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimientos-${dayKey(now)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // «Ver octubre»: el mes en curso completo, para ver los presupuestos.
  function seeCurrentMonth() {
    range.setMonths(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader {...getPageMeta("/finanzas")} actions={<DateRangePicker />} />

      <QuickEntry categories={categories} onSaved={handleSaved} />

      <div
        ref={gridRef}
        style={{ height: wide ? (gridHeight ?? undefined) : undefined }}
        className="grid min-h-0 grid-cols-1 gap-3.5 xl:grid-cols-[350px_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]"
      >
        <CategoryPanel
          transactions={raw}
          categories={categories}
          range={range}
          selected={category}
          onSelect={setCategory}
          onSeeMonth={seeCurrentMonth}
          loading={loading || categoriesLoading}
          error={error || categoriesError}
          now={now}
        />
        <Ledger
          rows={ledger.rows}
          days={ledger.days}
          summary={summary}
          categoryByName={categoryByName}
          categoryOptions={categoryOptions}
          tab={tab}
          onTab={setTab}
          pendingCount={pendingCount}
          category={category}
          onCategory={setCategory}
          query={query}
          onQuery={setQuery}
          onExport={handleExport}
          highlightId={highlightId}
          fill={wide}
          onEdit={setEditing}
          onPay={handlePay}
          onDelete={handleDelete}
          resetKey={`${tab}|${category}|${query}|${range.from}|${range.to}`}
          loading={loading}
          error={error}
          now={now}
        />
      </div>

      {editing ? <TransactionModal transaction={editing} categories={categories} onClose={() => setEditing(null)} onSaved={refetch} /> : null}
      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Finanzas;
