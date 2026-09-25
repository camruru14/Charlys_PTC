import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useDateRange, rangeLabel } from "../context/dateRange";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import TransactionToolbar from "../components/transactions/TransactionToolbar";
import TransactionTable from "../components/transactions/TransactionTable";
import { defaultTransactionFilters, filterTransactions } from "../lib/transactionFilters";
import PageHeader from "../components/ui/PageHeader";
import DateRangePicker from "../components/ui/DateRangePicker";
import { getPageMeta } from "../lib/nav";

function HistorialTransacciones() {
  const navigate = useNavigate();
  const range = useDateRange();
  const { data, loading, error } = useFetch("/transactions");
  const [filters, setFilters] = useState(defaultTransactionFilters);

  const all = Array.isArray(data) ? data : [];
  const filtered = useMemo(() => filterTransactions(all, filters, range), [all, filters, range]);

  const stats = useMemo(() => {
    const income = filtered.filter((t) => t.type === "Ingreso").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "Gasto").reduce((s, t) => s + t.amount, 0);
    return { count: filtered.length, income, expense, net: income - expense };
  }, [filtered]);

  const fmt = (v) => `$${v.toLocaleString("es-SV", { maximumFractionDigits: 0 })}`;

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
        <div className="rounded-[14px] border border-line bg-surface px-[18px] py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">Transacciones</p>
          <p className="t-kpi mt-2">{stats.count}</p>
        </div>
        <div className="rounded-[14px] border border-line bg-surface px-[18px] py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">Ingresos</p>
          <p className="t-kpi mt-2 !text-tone-green-text">{fmt(stats.income)}</p>
        </div>
        <div className="rounded-[14px] border border-line bg-surface px-[18px] py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">Gastos</p>
          <p className="t-kpi mt-2">{fmt(stats.expense)}</p>
        </div>
        <div className="rounded-[14px] border border-line bg-surface px-[18px] py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-subtle">Neto</p>
          <p className={`t-kpi mt-2 ${stats.net >= 0 ? "!text-tone-green-text" : "!text-tone-rose-text"}`}>{fmt(stats.net)}</p>
        </div>
      </div>

      <SectionCard title="Todas las transacciones">
        <TransactionToolbar list={all} filters={filters} setFilters={setFilters} />
        <AsyncState loading={loading} error={error}>
          <TransactionTable transactions={filtered} />
        </AsyncState>
      </SectionCard>
    </div>
  );
}

export default HistorialTransacciones;
