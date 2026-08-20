import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { useDateRange, rangeLabel } from "../context/DateRangeContext";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import TransactionToolbar from "../components/transactions/TransactionToolbar";
import TransactionTable from "../components/transactions/TransactionTable";
import { defaultTransactionFilters, filterTransactions } from "../lib/transactionFilters";

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate("/finanzas")} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800">
          ← Volver a Finanzas
        </button>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Rango: {rangeLabel(range)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Transacciones</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{stats.count}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ingresos</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{fmt(stats.income)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Gastos</p>
          <p className="mt-1 text-3xl font-bold text-slate-800">{fmt(stats.expense)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Neto</p>
          <p className={`mt-1 text-3xl font-bold ${stats.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(stats.net)}</p>
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
