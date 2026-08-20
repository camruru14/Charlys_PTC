import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useDateRange } from "../context/DateRangeContext";
import KpiCard from "../components/ui/KpiCard";
import BarChart from "../components/ui/BarChart";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { Field, SelectField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import TransactionToolbar from "../components/transactions/TransactionToolbar";
import TransactionTable from "../components/transactions/TransactionTable";
import { defaultTransactionFilters, filterTransactions, txDate, txDateParts } from "../lib/transactionFilters";
import { todayInput } from "../hooks/useBatchForm";
import { blockNegativeKey } from "../lib/numberInput";
import { IconFinance, IconPlus } from "../lib/icons";

const TYPES = ["Ingreso", "Gasto"];
const STATUSES = ["Pendiente", "Completado"];
const CATEGORIES = ["Materia Prima", "Logística", "Mantenimiento", "Planilla", "Servicios", "Ventas", "Otros"];
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const emptyForm = {
  reference: "", concept: "", type: "Ingreso", category: "Ventas",
  amount: "", status: "Completado", date: "",
};

// Vista previa del próximo N° de transacción (el backend genera el definitivo al guardar)
function previewReference(list) {
  const prefix = `TRAN-${new Date().getFullYear()}-`;
  const lastNumber = list.reduce((max, t) => {
    if (!t.reference?.startsWith(prefix)) return max;
    const n = parseInt(t.reference.slice(prefix.length), 10);
    return Number.isNaN(n) ? max : Math.max(max, n);
  }, 0);
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

// Meses (año/mes) comprendidos en el rango seleccionado. Sin tope: si hay más de
// 12, la card los muestra igual y se navegan con scroll horizontal (ver BarChart).
function monthsInRange(from, to) {
  const res = [];
  const d = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (d <= end) {
    res.push({ y: d.getFullYear(), m: d.getMonth() });
    d.setMonth(d.getMonth() + 1);
  }
  return res;
}

// Días (año/mes/día) comprendidos en el rango seleccionado (máx. 31 columnas).
function daysInRange(from, to) {
  const res = [];
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (d <= end && res.length < 31) {
    res.push({ y: d.getFullYear(), m: d.getMonth(), day: d.getDate() });
    d.setDate(d.getDate() + 1);
  }
  return res;
}

// Umbral para decidir la granularidad de la gráfica. El preset "Últimos 7 días"
// abarca ~8 días (incluye hoy completo) y "Últimos 30 días" ~31 días, así que 10
// separa claramente ambos casos: 7 días se grafica día a día, 30 días por mes.
const DAILY_CHART_MAX_SPAN_DAYS = 10;

// Cantidad exacta de meses a graficar para los presets de meses fijos. Con
// rango en días (ej. daysAgo(365)) el rango toca 13 meses calendario (el mes de
// inicio y el de fin quedan parciales), así que para estos presets se ancla el
// rango a meses calendario completos y se fuerza a que la card muestre
// exactamente esa cantidad de columnas, sin scroll.
const PRESET_MONTHS = { "3m": 3, "6m": 6, "365d": 12 };

function Finanzas() {
  const navigate = useNavigate();
  const { confirm, confirmProps } = useConfirm();
  const range = useDateRange();
  const { data, loading, error, refetch } = useFetch("/transactions");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState(defaultTransactionFilters);

  const raw = Array.isArray(data) ? data : [];

  // Transacciones dentro del rango de fechas (para KPIs y gráfico)
  // ("Todo" = sin rango => incluye todas)
  const rangeList = useMemo(
    () =>
      raw.filter((t) => {
        if (!range.from || !range.to) return true;
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
    // Distinto de "Rentabilidad neta" (income - expense): esto es lo que
    // todavía no se ha cobrado ni pagado (transacciones "Pendiente"), sin
    // importar si son Ingreso o Gasto.
    const pending = rangeList.filter((t) => t.status === "Pendiente").reduce((s, t) => s + t.amount, 0);
    return { income, expense, net: income - expense, pending };
  }, [rangeList]);

  // Ingresos vs Gastos, según el rango seleccionado.
  // Rangos cortos (ej. "Últimos 7/30 días") se muestran día a día, con exactamente
  // esos días; rangos más largos (3/6/12 meses, personalizado largo o "Todo") se
  // agrupan por mes como antes.
  const chart = useMemo(() => {
    let effFrom = range.from;
    let effTo = range.to;
    if (!effFrom || !effTo) {
      // "Todo": se usa el rango completo de fechas con movimientos (no solo los
      // últimos 12 meses), para no ocultar transacciones más antiguas. Si son más
      // de 12 meses, la card los muestra igual con scroll horizontal.
      // Se usa txDateParts (no getFullYear/getMonth directo) para no correr la
      // fecha un día -y potencialmente de mes- en husos detrás de UTC.
      const parts = rangeList.map((t) => txDateParts(t)).filter(Boolean);
      if (parts.length === 0) return { data: [], isDaily: false };
      const latest = parts.reduce((a, b) => (b.time > a.time ? b : a));
      const earliest = parts.reduce((a, b) => (b.time < a.time ? b : a));
      effTo = new Date(latest.y, latest.m, latest.day, 23, 59, 59, 999);
      effFrom = new Date(earliest.y, earliest.m, 1);
    } else if (PRESET_MONTHS[range.preset]) {
      const n = PRESET_MONTHS[range.preset];
      const anchorY = effTo.getFullYear();
      const anchorM = effTo.getMonth();
      effTo = new Date(anchorY, anchorM, 1);
      effFrom = new Date(anchorY, anchorM - (n - 1), 1);
    }

    const spanDays = Math.round((effTo - effFrom) / 86400000);
    const isDaily = spanDays <= DAILY_CHART_MAX_SPAN_DAYS;

    if (isDaily) {
      const buckets = daysInRange(effFrom, effTo);
      const data = buckets.map((bucket) => {
        let income = 0;
        let expense = 0;
        for (const t of rangeList) {
          const parts = txDateParts(t);
          if (parts && parts.y === bucket.y && parts.m === bucket.m && parts.day === bucket.day) {
            if (t.type === "Ingreso") income += t.amount;
            else expense += t.amount;
          }
        }
        const label = `${String(bucket.day).padStart(2, "0")} ${MONTHS[bucket.m]}`;
        return { label, values: [income, expense] };
      });
      return { data, isDaily: true };
    }

    const buckets = monthsInRange(effFrom, effTo);
    const spansYears = new Set(buckets.map((b) => b.y)).size > 1;
    const data = buckets.map((bucket) => {
      let income = 0;
      let expense = 0;
      for (const t of rangeList) {
        const parts = txDateParts(t);
        if (parts && parts.y === bucket.y && parts.m === bucket.m) {
          if (t.type === "Ingreso") income += t.amount;
          else expense += t.amount;
        }
      }
      const label = spansYears ? `${MONTHS[bucket.m]} ${String(bucket.y).slice(-2)}` : MONTHS[bucket.m];
      return { label, values: [income, expense] };
    });
    return { data, isDaily: false };
  }, [rangeList, range]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, reference: previewReference(raw), date: todayInput() });
    setModalOpen(true);
  }

  function openEdit(t) {
    setEditingId(t._id);
    setForm({
      reference: t.reference || "",
      concept: t.concept || "",
      type: t.type || "Ingreso",
      category: t.category || "Ventas",
      amount: t.amount ?? "",
      status: t.status || "Completado",
      date: t.date ? new Date(t.date).toISOString().slice(0, 10) : "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, amount: Number(form.amount) || 0, date: form.date || undefined };
    try {
      if (editingId) {
        await api.put(`/transactions/${editingId}`, payload);
        toast.success("Transacción actualizada");
      } else {
        const res = await api.post("/transactions", payload);
        toast.success(res?.reference ? `Transacción ${res.reference} registrada` : "Transacción registrada");
      }
      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t) {
    if (!(await confirm(`¿Eliminar la transacción ${t.reference}?`, { danger: true }))) return;
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
        <KpiCard label="Pendiente por cobrar/pagar" value={fmt(kpis.pending)} icon={IconFinance} trend={{ tone: kpis.pending ? "yellow" : "green", label: kpis.pending ? "en el rango" : "Al día" }} />
      </div>

      {/* Ingresos vs Gastos, por día o por mes según el rango de fechas */}
      <SectionCard title={`Ingresos vs. Gastos por ${chart.isDaily ? "día" : "mes"}`}>
        <AsyncState loading={loading} error={error} empty={!loading && chart.data.length === 0} emptyText="Sin movimientos en el rango.">
          <BarChart
            data={chart.data}
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
            <TransactionTable transactions={tableList} onEdit={openEdit} onDelete={handleDelete} />
          </div>
        </AsyncState>
        <p className="mt-3 text-xs text-slate-400">{tableList.length} transacción(es) en el rango y filtros seleccionados.</p>
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar transacción" : "Nueva transacción"}
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
            </div>
          </div>
          <Field label="Concepto" name="concept" value={form.concept} onChange={handleChange} required />
          <SelectField label="Tipo" name="type" value={form.type} onChange={handleChange} options={TYPES} required />
          <SelectField label="Categoría" name="category" value={form.category} onChange={handleChange} options={CATEGORIES} />
          <Field label="Monto ($)" name="amount" type="number" step="0.01" min="0" onKeyDown={blockNegativeKey} value={form.amount} onChange={handleChange} required />
          <SelectField label="Estado" name="status" value={form.status} onChange={handleChange} options={STATUSES} />
          <Field label="Fecha" name="date" type="date" value={form.date} onChange={handleChange} />
        </form>
      </Modal>

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Finanzas;
