import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useDateRange, rangeLabel } from "../context/dateRange";
import PagedSection from "../components/ui/PagedSection";
import TransactionToolbar from "../components/transactions/TransactionToolbar";
import TransactionTable from "../components/transactions/TransactionTable";
import { defaultTransactionFilters, filterTransactions } from "../lib/transactionFilters";
import PageHeader from "../components/ui/PageHeader";
import DateRangePicker from "../components/ui/DateRangePicker";
import KpiCard from "../components/ui/KpiCard";
import { getPageMeta } from "../lib/nav";
import { fmtMoney, fmtNumber } from "../lib/format";

function HistorialTransacciones() {
  const navigate = useNavigate();
  const range = useDateRange();
  const { data, loading, error } = useFetch("/transactions");
  const [filters, setFilters] = useState(defaultTransactionFilters);

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const filtered = useMemo(() => filterTransactions(all, filters, range), [all, filters, range]);

  const stats = useMemo(() => {
    const income = filtered.filter((t) => t.type === "Ingreso").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "Gasto").reduce((s, t) => s + t.amount, 0);
    return { count: filtered.length, income, expense, net: income - expense };
  }, [filtered]);

  const fmt = (v) => fmtMoney(v, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader {...getPageMeta("/historial-transacciones")} actions={<DateRangePicker />} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate("/finanzas")} className="flex items-center gap-1.5 text-[13px] font-semibold text-muted transition hover:text-ink">
          ← Volver a Finanzas
        </button>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-[12px] font-semibold text-primary-soft-text">
          Rango: {rangeLabel(range)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <KpiCard label="Transacciones" value={fmtNumber(stats.count)} />
        <KpiCard label="Ingresos" value={fmt(stats.income)} valueClassName="!text-tone-green-text" />
        <KpiCard label="Gastos" value={fmt(stats.expense)} />
        <KpiCard label="Neto" value={fmt(stats.net)} valueClassName={stats.net >= 0 ? "!text-tone-green-text" : "!text-tone-rose-text"} />
      </div>

      <PagedSection
        title="Todas las transacciones"
        toolbar={<TransactionToolbar list={all} filters={filters} setFilters={setFilters} />}
        items={filtered}
        rowHeight={42}
        resetKey={`${JSON.stringify(filters)}|${rangeLabel(range)}`}
        noun="transacciones"
        loading={loading}
        error={error}
      >
        {(rows) => <TransactionTable transactions={rows} />}
      </PagedSection>
    </div>
  );
}

export default HistorialTransacciones;
