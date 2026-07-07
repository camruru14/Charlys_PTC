import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useDateRange } from "../context/DateRangeContext";
import KpiCard from "../components/ui/KpiCard";
import BarChart from "../components/ui/BarChart";
import Modal from "../components/ui/Modal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import TransactionToolbar from "../components/transactions/TransactionToolbar";
import TransactionTable from "../components/transactions/TransactionTable";
import { defaultTransactionFilters, filterTransactions, txDate } from "../lib/transactionFilters";
import { IconFinance, IconPlus } from "../lib/icons";

const TYPES = ["Ingreso", "Gasto"];
const STATUSES = ["Pendiente", "Pagado", "Completado"];
const CATEGORIES = ["Ventas", "Materia Prima", "Planilla", "Servicios", "Otros"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const emptyForm = {
  reference: "", concept: "", type: "Ingreso", category: "Ventas",
  amount: "", status: "Completado", date: "",
};

// N° de transacción autogenerado (prefijo TRAN)
function newRef() {
  return "TRAN-" + String(Date.now()).slice(-5);
}

// Meses (año/mes) comprendidos en el rango seleccionado (máx. 12 columnas).
function monthsInRange(from, to) {
  const res = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (d <= end && res.length < 12) {
    res.push({ y: d.getFullYear(), m: d.getMonth() });
    d.setMonth(d.getMonth() + 1);
  }
  return res;
}

function Finanzas() {
  const navigate = useNavigate();
  const range = useDateRange();
  const { data, loading, error, refetch } = useFetch("/transactions");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(defaultTransactionFilters);

  const raw = Array.isArray(data) ? data : [];

  // Transacciones dentro del rango de fechas (para KPIs y gráfico)
  const rangeList = useMemo(
    () =>
      raw.filter((t) => {
        const d = new Date(txDate(t));
        if (Number.isNaN(d.getTime())) return true;
        return d >= range.from && d <= range.to;
      }),
    [raw, range],
  );

  // Rango + filtros de la barra de búsqueda (para la tabla)
  const tableList = useMemo(
    () => filterTransactions(raw, filters, range),
    [raw, filters, range],
  );

  const kpis = useMemo(() => {
    const income = rangeList.filter((t) => t.type === "Ingreso").reduce((s, t) => s + t.amount, 0);
    const expense = rangeList.filter((t) => t.type === "Gasto").reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense };
  }, [rangeList]);

  // Ingresos vs Gastos por mes, según el rango seleccionado
  const monthly = useMemo(() => {
    const buckets = monthsInRange(range.from, range.to);
    const spansYears = new Set(buckets.map((b) => b.y)).size > 1;
    return buckets.map((bucket) => {
      let income = 0;
      let expense = 0;
      for (const t of rangeList) {
        const d = new Date(txDate(t));
        if (d.getFullYear() === bucket.y && d.getMonth() === bucket.m) {
          if (t.type === "Ingreso") income += t.amount;
          else expense += t.amount;
        }
      }
      const label = spansYears ? `${MONTHS[bucket.m]} ${String(bucket.y).slice(-2)}` : MONTHS[bucket.m];
      return { label, values: [income, expense] };
    });
  }, [rangeList, range]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  function openCreate() {
    setForm({ ...emptyForm, reference: newRef() });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, amount: Number(form.amount) || 0, date: form.date || undefined };
    try {
      await api.post("/transactions", payload);
      toast.success("Transacción registrada");
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t) {
    if (!window.confirm(`¿Eliminar la transacción ${t.reference}?`)) return;
    try {
      await api.del(`/transactions/${t._id}`);
      toast.success("Transacción eliminada");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const fmt = (v) => `$${v.toLocaleString("es-SV", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ingresos" value={fmt(kpis.income)} icon={IconFinance} trend={{ tone: "green", label: "en el rango" }} />
        <KpiCard label="Gastos" value={fmt(kpis.expense)} icon={IconFinance} trend={{ tone: "yellow", label: "en el rango" }} />
        <KpiCard label="Rentabilidad neta" value={fmt(kpis.net)} icon={IconFinance} trend={{ tone: kpis.net >= 0 ? "green" : "red", label: kpis.net >= 0 ? "Positiva" : "Negativa" }} />
        <KpiCard label="Flujo de caja" value={fmt(kpis.net)} icon={IconFinance} trend={{ tone: "blue", label: "neto" }} />
      </div>

      {/* Ingresos vs Gastos por mes (según el rango de fechas) */}
      <SectionCard title="Ingresos vs. Gastos por mes">
        <AsyncState loading={loading} error={error} empty={!loading && monthly.length === 0} emptyText="Sin movimientos en el rango.">
          <BarChart
            data={monthly}
            series={[{ name: "Ingresos", color: "#2563eb" }, { name: "Gastos", color: "#ef4444" }]}
            formatValue={fmt}
          />
        </AsyncState>
      </SectionCard>

      {/* Tabla de transacciones con búsqueda, filtros y "Ver todo" */}
      <SectionCard
        title="Transacciones"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/historial-transacciones")} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100">
              Ver todo
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <IconPlus width={16} height={16} /> Nueva
            </button>
          </div>
        }
      >
        <TransactionToolbar list={raw} filters={filters} setFilters={setFilters} compact />
        <AsyncState loading={loading} error={error}>
          <div className="max-h-96 overflow-y-auto">
            <TransactionTable transactions={tableList} onDelete={handleDelete} />
          </div>
        </AsyncState>
        <p className="mt-3 text-xs text-slate-400">{tableList.length} transacción(es) en el rango y filtros seleccionados.</p>
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva transacción"
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" form="trx-form" disabled={saving} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="trx-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* N° de transacción autogenerado (solo lectura) */}
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">N° de transacción</span>
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <span className="text-sm font-semibold text-slate-800">{form.reference}</span>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">autogenerado</span>
            </div>
          </div>
          <Field label="Concepto" name="concept" value={form.concept} onChange={handleChange} required />
          <SelectField label="Tipo" name="type" value={form.type} onChange={handleChange} options={TYPES} required />
          <SelectField label="Categoría" name="category" value={form.category} onChange={handleChange} options={CATEGORIES} />
          <Field label="Monto ($)" name="amount" type="number" step="0.01" value={form.amount} onChange={handleChange} required />
          <SelectField label="Estado" name="status" value={form.status} onChange={handleChange} options={STATUSES} />
          <Field label="Fecha" name="date" type="date" value={form.date} onChange={handleChange} />
        </form>
      </Modal>
    </div>
  );
}

export default Finanzas;
