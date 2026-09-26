import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useDateRange } from "../context/dateRange";
import KpiCard from "../components/ui/KpiCard";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Button from "../components/ui/Button";
import SearchInput from "../components/ui/SearchInput";
import { Field, SelectField, FilterSelect, ReadonlyField } from "../components/ui/Field";
import { SectionCard, AsyncState } from "../components/ui/SectionCard";
import MonthlyChart from "../components/finance/MonthlyChart";
import TransactionTable from "../components/transactions/TransactionTable";
import { defaultTransactionFilters, filterTransactions, txDate, txDateParts } from "../lib/transactionFilters";
import { todayInput } from "../hooks/useBatchForm";
import { blockNegativeKey } from "../lib/numberInput";
import { IconPlus } from "../lib/icons";
import { buttonClass } from "../lib/buttonStyles";
import { fmtMoney, fmtMonth, fmtNumber } from "../lib/format";
import PageHeader from "../components/ui/PageHeader";
import { getPageMeta } from "../lib/nav";
import DateRangePicker from "../components/ui/DateRangePicker";

const TYPES = ["Ingreso", "Gasto"];
const STATUSES = ["Pendiente", "Completado"];
const CATEGORIES = ["Materia Prima", "Logística", "Mantenimiento", "Planilla", "Servicios", "Ventas", "Otros"];
const CHART_MONTHS = 6;

const filterSelectClass =
  "h-9 min-w-[124px] rounded-[10px] border border-line bg-surface px-3 text-[12.5px] font-semibold text-ink-2 hover:bg-surface-2";

const emptyForm = {
  reference: "", concept: "", type: "Ingreso", category: "Ventas",
  amount: "", status: "Completado", date: "",
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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

// Ingresos y gastos de los últimos seis meses calendario (el actual incluido),
// sin importar el rango elegido. txDateParts lee `date` en UTC (fecha sin hora).
function lastMonths(list) {
  const now = new Date();
  return Array.from({ length: CHART_MONTHS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (CHART_MONTHS - 1 - i), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    let income = 0;
    let expense = 0;
    for (const t of list) {
      const parts = txDateParts(t);
      if (!parts || parts.y !== y || parts.m !== m) continue;
      if (t.type === "Ingreso") income += Number(t.amount) || 0;
      else expense += Number(t.amount) || 0;
    }
    return {
      key: `${y}-${m}`,
      label: capitalize(fmtMonth(d).slice(0, 3)),
      title: `${capitalize(fmtMonth(d))} ${y}`,
      income,
      expense,
      current: i === CHART_MONTHS - 1,
    };
  });
}

function Finanzas() {
  const navigate = useNavigate();
  const { confirm, confirmProps } = useConfirm();
  const range = useDateRange();
  const { data, loading, error, refetch } = useFetch("/transactions");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(null);

  const raw = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Transacciones dentro del rango de fechas (KPIs); "Todo" = sin rango.
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

  // Rango + buscador + tipo (tabla)
  const tableList = useMemo(
    () => filterTransactions(raw, { ...defaultTransactionFilters, q: query.trim(), type }, range),
    [raw, query, type, range],
  );

  const kpis = useMemo(() => {
    const sum = (list) => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const income = sum(rangeList.filter((t) => t.type === "Ingreso"));
    const expense = sum(rangeList.filter((t) => t.type === "Gasto"));
    // Lo que todavía no se ha cobrado ni pagado (transacciones «Pendiente»).
    const pendingList = rangeList.filter((t) => t.status === "Pendiente");
    const pendingOrders = new Set(pendingList.map((t) => t.relatedOrder?._id || t.relatedOrder).filter(Boolean).map(String));
    return { income, expense, net: income - expense, pending: sum(pendingList), pendingOrders: pendingOrders.size };
  }, [rangeList]);

  const months = useMemo(() => lastMonths(raw), [raw]);

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

  const netPositive = kpis.net > 0;
  const netNegative = kpis.net < 0;

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        {...getPageMeta("/finanzas")}
        actions={
          <>
            <DateRangePicker />
            <Button icon={IconPlus} onClick={openCreate}>
              Nueva transacción
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Ingresos" value={fmtMoney(kpis.income, 0)} note="en el rango" />
        <KpiCard label="Gastos" value={fmtMoney(kpis.expense, 0)} note="en el rango" />
        <KpiCard
          label="Rentabilidad neta"
          value={`${netPositive ? "+" : netNegative ? "−" : ""}${fmtMoney(Math.abs(kpis.net), 0)}`}
          valueClassName={netPositive ? "!text-tone-green-text" : netNegative ? "!text-tone-rose-text" : ""}
          note={netPositive ? "positiva" : netNegative ? "negativa" : "en el rango"}
          noteTone={netPositive ? "green" : netNegative ? "rose" : undefined}
        />
        <KpiCard
          label="Por cobrar / pagar"
          value={fmtMoney(kpis.pending, 0)}
          valueClassName="!text-tone-amber-text"
          note={`${fmtNumber(kpis.pendingOrders)} ${kpis.pendingOrders === 1 ? "pedido" : "pedidos"}`}
          noteTone="amber"
        />
      </div>

      <AsyncState loading={loading} error={error}>
        <MonthlyChart months={months} selected={selectedMonth} onSelect={setSelectedMonth} />
      </AsyncState>

      <SectionCard
        title="Transacciones"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Concepto o referencia" className="w-[220px]" />
            <FilterSelect
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={filterSelectClass}
              options={[{ value: "", label: "Tipo: todos" }, ...TYPES.map((t) => ({ value: t, label: t }))]}
            />
            <Button variant="soft" size="detail" onClick={() => navigate("/historial-transacciones")}>
              Ver historial
            </Button>
          </div>
        }
      >
        <AsyncState loading={loading} error={error}>
          <div className="-mx-5 -mb-5 border-t border-line-soft">
            <TransactionTable transactions={tableList} onEdit={openEdit} onDelete={handleDelete} />
          </div>
        </AsyncState>
      </SectionCard>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar transacción" : "Nueva transacción"}
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className={buttonClass("secondary", "modal")}>Cancelar</button>
            <button type="submit" form="trx-form" disabled={saving} className={buttonClass("primary", "modal")}>{saving ? "Guardando…" : "Guardar"}</button>
          </>
        }
      >
        <form id="trx-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ReadonlyField label="N° de transacción" value={form.reference} />
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
