import { useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "../components/ui/PageHeader";
import Tabs from "../components/ui/Tabs";
import KpiInline from "../components/ui/KpiInline";
import KpiCard from "../components/ui/KpiCard";
import StatTile from "../components/ui/StatTile";
import StatusPill from "../components/ui/StatusPill";
import FilterChips from "../components/ui/FilterChips";
import SearchInput from "../components/ui/SearchInput";
import { MasterDetail, ListPanel, DetailPanel, ListRow } from "../components/ui/MasterDetail";
import Stepper from "../components/ui/Stepper";
import MiniStepper from "../components/ui/MiniStepper";
import InlineResolveBox from "../components/ui/InlineResolveBox";
import PillSelector from "../components/ui/PillSelector";
import RadioCardList from "../components/ui/RadioCardList";
import DisclosureChevron from "../components/ui/DisclosureChevron";
import StockMeter from "../components/ui/StockMeter";
import ProgressBar from "../components/ui/ProgressBar";
import BulkBar from "../components/ui/BulkBar";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import DataTable from "../components/ui/DataTable";
import Button from "../components/ui/Button";
import { SectionCard } from "../components/ui/SectionCard";
import DateRangePicker from "../components/ui/DateRangePicker";
import BarChart from "../components/ui/BarChart";
import DonutChart from "../components/ui/DonutChart";
import { STATUS_DOMAINS } from "../lib/statusDomains";
import { CHART_COLORS } from "../lib/tones";
import { toastUndo } from "../lib/toastUndo";
import { fmtNumber, fmtMoney, fmtDate, fmtDateTime, fmtTime, fmtRelativeDay } from "../lib/format";
import { useUrlState } from "../hooks/useUrlState";
import { IconPlus, IconBox } from "../lib/icons";

/*
  Página de muestra del sistema visual (/dev/ui). Solo se registra en
  desarrollo (import.meta.env.DEV, ver App.jsx).
*/

// Ejemplos extra de estados dinámicos que no son claves fijas del mapa.
const EXTRA_SAMPLES = { despacho: ["Faltan 1 de 3"] };

const ROWS = [
  { _id: "1", batch: "LOT-0416", product: "Pajilla · Rojo", qty: 12500, status: "En proceso" },
  { _id: "2", batch: "LOT-0417", product: "Pelota · Azul", qty: 800, status: "Detenido" },
  { _id: "3", batch: "LOT-0418", product: "Pajilla · Verde", qty: 5000, status: "Completado" },
];

function Section({ title, children }) {
  return (
    <SectionCard title={title}>
      <div className="flex flex-col gap-4">{children}</div>
    </SectionCard>
  );
}

function DevUI() {
  const [tab, setTab] = useUrlState("tab", "componentes");
  const [selected, setSelected] = useUrlState("id", "1");
  const [chip, setChip] = useState("all");
  const [search, setSearch] = useState("");
  const [driver, setDriver] = useState("ana");
  const [option, setOption] = useState("stock");
  const [openRow, setOpenRow] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [{ now, yesterday }] = useState(() => {
    const today = new Date();
    return { now: today, yesterday: new Date(today.getTime() - 86400000) };
  });

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Sistema visual"
        subtitle="Muestra de componentes y estados (solo en desarrollo)"
        actions={
          <>
            <DateRangePicker />
            <Button variant="secondary">Secundario</Button>
            <Button icon={IconPlus}>Principal</Button>
          </>
        }
      />

      <Tabs
        tabs={[
          { key: "componentes", label: "Componentes" },
          { key: "estados", label: "Estados" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "estados" ? (
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {Object.entries(STATUS_DOMAINS).map(([domain, map]) => {
            const statuses = [...Object.keys(map), ...(EXTRA_SAMPLES[domain] || [])];
            return (
              <Section key={domain} title={domain}>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((s) => (
                    <StatusPill key={s} status={s} domain={domain} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((s) => (
                    <StatusPill key={s} status={s} domain={domain} size="lg" />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  {statuses.map((s) => (
                    <StatusPill key={s} status={s} domain={domain} variant="dot" />
                  ))}
                </div>
              </Section>
            );
          })}
        </div>
      ) : (
        <>
          <Section title="Tipografía y formato">
            <div className="flex flex-col gap-1.5">
              <p className="t-page-title">Título de página 26/700</p>
              <p className="t-page-sub">Subtítulo de página 13px muted</p>
              <p className="t-card-title">Título de tarjeta 15/700</p>
              <p className="t-detail-title">LOT-0416 · Ruta 4 · Zona Norte</p>
              <p className="t-label">Etiqueta de sección</p>
              <p className="t-row-name">Nombre principal de fila</p>
              <p className="t-row">Texto de fila 13px</p>
              <p className="t-aux">Texto auxiliar 11.5px</p>
            </div>
            <p className="t-row tabular-nums">
              {fmtNumber(1234567)} · {fmtMoney(1234.5)} · {fmtDate(now)} · {fmtDateTime(now)} · {fmtTime(now)} ·{" "}
              {fmtRelativeDay(now)} · {fmtRelativeDay(yesterday)}
            </p>
          </Section>

          <Section title="Botones">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="header">Principal 38</Button>
              <Button size="detail">Detalle 34</Button>
              <Button size="modal">Modal 36</Button>
              <Button size="row">Fila 29</Button>
              <Button variant="soft" size="row">Suave</Button>
              <Button variant="secondary" size="row">Secundario</Button>
              <Button variant="danger" size="row">Eliminar</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="start" size="row">Iniciar</Button>
              <Button variant="stop" size="row">Detener</Button>
              <Button variant="resume" size="row">Reanudar</Button>
              <Button variant="pack" size="row" icon={IconBox}>Empacar</Button>
            </div>
          </Section>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            <KpiCard label="Producción" value={fmtNumber(48250)} note="unidades en el rango" />
            <KpiCard label="Ingresos" value={fmtMoney(12840)} trend={{ tone: "green", label: "en el rango" }} />
            <KpiCard label="Detenidos" value="1" trend={{ tone: "red", label: "Alerta" }} />
          </div>

          <Section title="Indicadores">
            <KpiInline
              items={[
                { label: "Programados", value: 4, tone: "amber" },
                { label: "En proceso", value: 6, tone: "blue" },
                { label: "Detenidos", value: 1, tone: "rose" },
                { label: "Completados", value: 12, tone: "green" },
              ]}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Meta" value={fmtNumber(15000)} note="unidades" />
              <StatTile label="Producido" value={fmtNumber(12500)} note="83 %" />
              <StatTile label="Operario" value="Ana P." />
              <StatTile label="Inicio" value={fmtDate(now)} note={fmtTime(now)} />
            </div>
          </Section>

          <Section title="Filtros y búsqueda">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar lote, producto…" className="max-w-sm" />
            <FilterChips
              value={chip}
              onChange={setChip}
              options={[
                { key: "all", label: "Todos", count: 23 },
                { key: "proceso", label: "En proceso", count: 6, tone: "blue" },
                { key: "detenidos", label: "Detenidos", count: 1, tone: "rose" },
                { key: "enviar", label: "Por enviar", count: 2, tone: "amber" },
                { key: "oculto", label: "Oculto (0)", count: 0, tone: "green" },
              ]}
            />
            <PillSelector
              value={driver}
              onChange={setDriver}
              options={[
                { value: "ana", label: "Ana Pérez" },
                { value: "luis", label: "Luis Gómez" },
                { value: "marta", label: "Marta Ruiz", busy: true },
              ]}
            />
          </Section>

          <Section title="Progreso">
            <Stepper
              steps={[
                { label: "Creado", date: fmtDateTime(yesterday), state: "done" },
                { label: "Verificado", date: fmtDateTime(now), state: "done" },
                { label: "Fabricación", state: "skipped" },
                { label: "Empacado", state: "current", date: "en curso" },
                { label: "Entregado", state: "pending" },
              ]}
            />
            <MiniStepper segments={[{ tone: "green" }, { tone: "green" }, { tone: "blue" }, { tone: "amber" }, {}]} />
            <ProgressBar value={62} tone="blue" />
            <div className="flex flex-col gap-2">
              <StockMeter percent={10} tone="rose" label="Bajo mínimo" />
              <StockMeter percent={45} tone="blue" label="Estable" />
              <StockMeter percent={100} tone="green" label="Suficiente" />
            </div>
          </Section>

          <Section title="Opciones y resolución en línea">
            <RadioCardList
              name="demo-option"
              value={option}
              onChange={setOption}
              options={[
                { value: "stock", title: "Tomar de Bodega Central", detail: "Hay 1,200 unidades disponibles", tag: "Sugerida" },
                { value: "split", title: "Dividir la línea", detail: "Tomar 800 y fabricar 400" },
                { value: "fab", title: "Enviar a fabricación", detail: "Crea un lote con meta 1,200" },
              ]}
            />
            <InlineResolveBox title="Verificar Pajilla · Rojo · 1,200">
              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" size="row">Cancelar</Button>
                <Button size="row">Confirmar</Button>
              </div>
            </InlineResolveBox>
            <Button variant="secondary" size="row" onClick={() => toastUndo("Línea empacada", () => toast("Deshecho"))}>
              Probar toast con Deshacer
            </Button>
          </Section>

          <SectionCard title="Tabla y filas desplegables">
            <div className="-mx-5 -mb-5">
              <DataTable
                rows={ROWS}
                onRowClick={(r) => setOpenRow(openRow === r._id ? null : r._id)}
                columns={[
                  { key: "batch", label: "Lote", render: (r) => <span className="t-row-name">{r.batch}</span> },
                  { key: "product", label: "Producto" },
                  { key: "qty", label: "Cantidad", align: "right", render: (r) => fmtNumber(r.qty) },
                  { key: "status", label: "Estado", render: (r) => <StatusPill status={r.status} domain="lote" /> },
                  { key: "chev", label: "", width: 18, render: (r) => <DisclosureChevron open={openRow === r._id} /> },
                ]}
              />
            </div>
          </SectionCard>

          <BulkBar count={3} onClear={() => {}}>
            <Button variant="secondary" size="row">Empacar en bloque</Button>
          </BulkBar>

          <MasterDetail listWidth={320} className="lg:!h-[440px] !min-h-0">
            <ListPanel header={<SearchInput value={search} onChange={setSearch} />}>
              {ROWS.map((r) => (
                <ListRow key={r._id} selected={selected === r._id} onClick={() => setSelected(r._id)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-row-name">{r.batch}</span>
                    <StatusPill status={r.status} domain="lote" variant="dot" />
                  </div>
                  <p className="t-aux mt-0.5">{r.product}</p>
                </ListRow>
              ))}
            </ListPanel>
            <DetailPanel
              header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="t-detail-title">{ROWS.find((r) => r._id === selected)?.batch || "—"}</h2>
                    <StatusPill status={ROWS.find((r) => r._id === selected)?.status} domain="lote" size="lg" />
                  </div>
                  <Button size="detail" onClick={() => setModalOpen(true)}>
                    Abrir modal
                  </Button>
                </div>
              }
            >
              <EmptyState icon={IconBox} title="Sin movimientos" description="Este lote todavía no tiene registros." />
            </DetailPanel>
          </MasterDetail>

          <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
            <SectionCard title="Gráfico de barras">
              <BarChart
                data={[
                  { label: "Jul", values: [12000, 8000] },
                  { label: "Ago", values: [15000, 9000] },
                  { label: "Sep", values: [11000, 7000] },
                ]}
                series={[
                  { name: "Ingresos", color: CHART_COLORS[0] },
                  { name: "Gastos", color: CHART_COLORS[1] },
                ]}
              />
            </SectionCard>
            <SectionCard title="Dona">
              <DonutChart
                data={["Pajilla", "Pelota", "Jumbo", "Smoothie", "Otro"].map((label, i) => ({
                  label,
                  value: 5 - i,
                  color: CHART_COLORS[i],
                }))}
                centerLabel="100%"
              />
            </SectionCard>
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Detener lote"
        subtitle="LOT-0416 · Pajilla · Rojo"
        footer={
          <>
            <Button variant="secondary" size="modal" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="modal" onClick={() => setModalOpen(false)}>
              Confirmar
            </Button>
          </>
        }
      >
        <p className="t-row text-ink-2">Contenido del modal de 470px.</p>
      </Modal>
    </div>
  );
}

export default DevUI;
