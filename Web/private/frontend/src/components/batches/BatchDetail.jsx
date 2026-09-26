import { useState } from "react";
import Button from "../ui/Button";
import StatusPill from "../ui/StatusPill";
import StatTile from "../ui/StatTile";
import ActionsMenu from "../ui/ActionsMenu";
import ColorSwatch from "../ui/ColorSwatch";
import EmptyState from "../ui/EmptyState";
import InlineResolveBox from "../ui/InlineResolveBox";
import { DetailPanel } from "../ui/MasterDetail";
import { Field, SelectField } from "../ui/Field";
import { blockNegativeKey } from "../../lib/numberInput";
import { IconWarehouse } from "../../lib/icons";
import { fmtNumber, fmtDate, fmtDay2, fmtTime, fmtDateTime, fmtRelativeDay } from "../../lib/format";
import {
  batchState,
  batchHeaderState,
  productLabel,
  batchStart,
  batchEnd,
  lineStats,
} from "../../lib/batchFlow";

const MINUS = "−";
const signed = (n) => (n < 0 ? `${MINUS}${fmtNumber(Math.abs(n))}` : `+${fmtNumber(n)}`);
const pctOf = (value, total) => (total ? Math.round((value / total) * 100) : null);
const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString();

function SectionLabel({ children, aside }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <p className="t-label">{children}</p>
      {aside ? <p className="t-aux tabular-nums">{aside}</p> : null}
    </div>
  );
}

// Texto bajo el número del lote: «Pajilla Verde · Línea 3 · terminó hoy 14:10».
function headerCaption(b) {
  const parts = [productLabel(b) || "—", b.productionLine || "Sin línea"];
  const start = batchStart(b);
  const end = batchEnd(b);
  if (b.status === "Completado" && end) {
    parts.push(end.withTime ? `terminó ${fmtRelativeDay(end.date)} ${fmtTime(end.date)}` : `terminó ${fmtDate(end.date)}`);
  } else if (b.status === "En Proceso" && start) {
    parts.push(start.withTime ? `inició ${fmtTime(start.date)}` : `inició ${fmtDate(start.date)}`);
  } else if (b.status === "Detenido" && b.stoppedAt) {
    parts.push(`detenido ${fmtTime(b.stoppedAt)}${b.stopReason ? ` · ${b.stopReason}` : ""}`);
  } else if (b.status === "Programado" && start) {
    parts.push(`programado ${fmtDate(start.date)}`);
  }
  return parts.join(" · ");
}

function Progress({ batch }) {
  const target = batch.targetQuantity;
  const produced = batch.producedQuantity || 0;
  const start = batchStart(batch);

  if (batch.status !== "Completado") {
    const meta = `meta ${target != null ? fmtNumber(target) : "—"}`;
    let text = `Programado · ${meta}`;
    if (batch.status === "En Proceso") {
      text = start?.withTime ? `En proceso desde ${fmtTime(start.date)} · ${meta}` : `En proceso · ${meta}`;
    } else if (batch.status === "Detenido") {
      text = batch.stoppedAt ? `Detenido desde ${fmtTime(batch.stoppedAt)} · ${meta}` : `Detenido · ${meta}`;
    }
    return <p className="text-[13px] tabular-nums text-ink-2">{text}</p>;
  }

  const pct = pctOf(produced, target);
  return (
    <div>
      <p className="text-[13px] tabular-nums text-ink-2">
        <span className="font-semibold text-ink">{fmtNumber(produced)}</span> de {target != null ? fmtNumber(target) : "—"} unidades
        {pct != null ? ` · ${pct} %` : ""}
      </p>
      {pct != null ? (
        <div className="mt-2 h-[10px] overflow-hidden rounded-[5px] bg-line-soft">
          <div
            className={`h-full rounded-[5px] ${pct >= 100 ? "bg-tone-green-dot" : "bg-primary"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function Tiles({ batch, previous, average, historyCount }) {
  const target = batch.targetQuantity;
  const done = batch.status === "Completado";
  const produced = batch.producedQuantity || 0;
  const pct = done ? pctOf(produced, target) : null;

  let vs = { value: "—", note: previous ? null : "sin lote anterior en la línea", tone: "text-ink" };
  if (done && previous && previous.producedQuantity) {
    const diff = produced - previous.producedQuantity;
    const diffPct = Math.round((diff / previous.producedQuantity) * 100);
    vs = {
      value: diffPct === 0 ? "0 %" : `${diffPct < 0 ? MINUS : "+"}${Math.abs(diffPct)} %`,
      note: `${signed(diff)} u. vs. ${previous.batchNumber}`,
      tone: diff < 0 ? "text-tone-amber-text" : diff > 0 ? "text-tone-green-text" : "text-ink",
    };
  }

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatTile label="Meta" value={target != null ? fmtNumber(target) : "—"} note="unidades del lote" />
      <StatTile
        label="Producido"
        value={done ? fmtNumber(produced) : "—"}
        note={pct != null ? `${pct} % de la meta` : done ? "sin meta" : "aún no se completa"}
        noteClassName={pct != null ? (pct >= 100 ? "!text-tone-green-text" : "!text-tone-amber-text") : ""}
      />
      <StatTile label="vs. lote anterior" value={vs.value} note={vs.note} valueClassName={vs.tone} />
      <StatTile
        label="Promedio de la línea"
        value={average != null ? fmtNumber(average) : "—"}
        note={batch.productionLine ? `últimos ${historyCount} ${historyCount === 1 ? "lote" : "lotes"} · ${batch.productionLine}` : "sin línea"}
      />
    </div>
  );
}

const CHART_HEIGHT = 150;
// Alto útil de las barras (deja espacio arriba para el valor de la más alta).
const BAR_AREA = CHART_HEIGHT - 18;

// Últimos lotes completados de la línea, con la meta del lote actual.
function LineChart({ batch, history }) {
  if (!history.length) {
    return <EmptyState title="Sin lotes completados en esta línea." />;
  }
  const target = batch.targetQuantity || 0;
  const scale = Math.max(target, ...history.map((b) => b.producedQuantity || 0), 1);
  const metaBottom = (target / scale) * BAR_AREA;

  return (
    <div className="pt-5">
      <div className="relative flex items-end gap-2 border-b border-line" style={{ height: CHART_HEIGHT }}>
        {target > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-chart-ref" style={{ bottom: metaBottom }}>
            <span className="absolute -top-[13px] right-0 bg-surface pl-1 text-[9.5px] text-subtle">Meta</span>
          </div>
        ) : null}
        {history.map((b) => {
          const current = b._id === batch._id;
          const value = b.producedQuantity || 0;
          return (
            <div key={b._id} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className={`mb-1 text-[10.5px] tabular-nums ${current ? "font-bold text-ink" : "text-subtle"}`}>{fmtNumber(value)}</span>
              <div
                className={`w-full max-w-[44px] rounded-[4px_4px_0_0] ${current ? "bg-chart-1" : "bg-chart-history"}`}
                style={{ height: `${(value / scale) * BAR_AREA}px` }}
                title={b.batchNumber}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {history.map((b) => {
          const current = b._id === batch._id;
          const end = batchEnd(b)?.date || batchStart(b)?.date;
          return (
            <span key={b._id} className={`min-w-0 flex-1 truncate text-center text-[10.5px] tabular-nums ${current ? "font-bold text-ink" : "text-subtle"}`}>
              {current && isToday(end) ? "Hoy" : fmtDay2(end)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function when(point) {
  if (!point) return "—";
  return point.withTime ? fmtDateTime(point.date) : fmtDate(point.date);
}

function Sheet({ batch }) {
  const rows = [
    ["Producto", batch.product || "—"],
    [
      "Color",
      batch.color ? (
        <span className="inline-flex items-center gap-1.5">
          <ColorSwatch color={batch.color} />
          {batch.color}
        </span>
      ) : (
        "—"
      ),
    ],
    ["Línea", batch.productionLine || "—"],
    ["Operario", batch.operator?.name ? `${batch.operator.name} ${batch.operator.lastName || ""}`.trim() : "—"],
    ["Inicio", when(batchStart(batch))],
    ["Fin", when(batchEnd(batch))],
  ];
  return (
    <div className="overflow-hidden rounded-[12px] border border-line">
      {rows.map(([label, value], i) => (
        <div key={label} className={`flex h-9 items-center justify-between gap-3 px-3.5 ${i % 2 ? "bg-surface-2" : "bg-surface"}`}>
          <span className="text-[12.5px] text-muted">{label}</span>
          <span className="min-w-0 truncate text-[12.5px] font-semibold tabular-nums text-ink">{value}</span>
        </div>
      ))}
    </div>
  );
}

// Cuadros en línea de Iniciar (faltan línea u operario), Detener y Completar.
function ActionBox({ kind, batch, operators, lines, busy, onCancel, actions }) {
  const [line, setLine] = useState(batch.productionLine || "");
  const [operator, setOperator] = useState(batch.operator?._id || batch.operator || "");
  const [reason, setReason] = useState("");
  const [produced, setProduced] = useState(batch.targetQuantity != null ? String(batch.targetQuantity) : "");

  const cancel = (
    <Button variant="secondary" size="row" onClick={onCancel}>
      Cancelar
    </Button>
  );

  if (kind === "start") {
    const needsOperator = operators.length > 0;
    return (
      <InlineResolveBox title={`Elige la línea${needsOperator ? " y el operario" : ""} para iniciar`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField label="Línea" name="productionLine" size="sm" value={line} onChange={(e) => setLine(e.target.value)} options={lines} />
          <SelectField
            label="Operario"
            name="operator"
            size="sm"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder={needsOperator ? "Selecciona…" : "Sin operarios en Fabricación"}
            options={operators.map((o) => ({ value: o._id, label: `${o.name} ${o.lastName}` }))}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-end gap-2">
          {cancel}
          <Button
            variant="start"
            size="row"
            disabled={busy || !line || (needsOperator && !operator)}
            onClick={() => actions.start(batch, { productionLine: line, operator: operator || undefined })}
          >
            Iniciar
          </Button>
        </div>
      </InlineResolveBox>
    );
  }

  if (kind === "stop") {
    return (
      <InlineResolveBox>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            actions.stop(batch, reason);
          }}
        >
          <div className="min-w-[220px] flex-1">
            <Field label="Motivo (opcional)" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </div>
          <div className="flex items-center gap-2 pb-[3px]">
            {cancel}
            <Button type="submit" variant="stop" size="row" disabled={busy}>
              Detener
            </Button>
          </div>
        </form>
      </InlineResolveBox>
    );
  }

  // complete
  return (
    <InlineResolveBox>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          actions.complete(batch, Number(produced));
        }}
      >
        <div className="w-[160px]">
          <Field
            label="Producidas"
            name="producedQuantity"
            type="number"
            min="0"
            step="1"
            required
            onKeyDown={blockNegativeKey}
            value={produced}
            onChange={(e) => setProduced(e.target.value)}
            autoFocus
          />
        </div>
        <span className="t-aux pb-2.5 tabular-nums">meta {batch.targetQuantity != null ? fmtNumber(batch.targetQuantity) : "—"}</span>
        <div className="ml-auto flex items-center gap-2 pb-[3px]">
          <Button type="submit" size="row" disabled={busy || produced === ""}>
            Confirmar
          </Button>
          {cancel}
        </div>
      </form>
    </InlineResolveBox>
  );
}

/*
  Detalle de un lote de Lotes de fabricación: encabezado con la acción según
  el estado, avance, tiles, gráfica de la línea y ficha del lote.
*/
function BatchDetail({ batch, batches, operators, lines, busy, openBox, setOpenBox, actions }) {
  const state = batchState(batch);
  const { history, previous, average } = lineStats(batch, batches);

  function primaryAction() {
    switch (state) {
      case "Programado":
        return (
          <Button
            variant="start"
            size="detail"
            disabled={busy}
            onClick={() => {
              const hasOperator = batch.operator || operators.length === 0;
              if (batch.productionLine && hasOperator) actions.start(batch, {});
              else setOpenBox("start");
            }}
          >
            Iniciar
          </Button>
        );
      case "En proceso":
        return (
          <>
            <Button variant="stop" size="detail" disabled={busy} onClick={() => setOpenBox(openBox === "stop" ? null : "stop")}>
              Detener
            </Button>
            <Button variant="pack" size="detail" disabled={busy} onClick={() => setOpenBox(openBox === "complete" ? null : "complete")}>
              Completar
            </Button>
          </>
        );
      case "Detenido":
        return (
          <Button variant="resume" size="detail" disabled={busy} onClick={() => actions.resume(batch)}>
            Reanudar
          </Button>
        );
      case "Por enviar":
        return (
          <Button size="detail" icon={IconWarehouse} disabled={busy} onClick={() => actions.openSend(batch)}>
            Enviar a bodega
          </Button>
        );
      case "En bodega":
        return (
          <span className="text-[12.5px] font-semibold text-ink-2">
            En {batch.destinationWarehouse || "bodega"} · {fmtDate(batch.sentToWarehouseAt)}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <DetailPanel
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h2 className="text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-ink">{batch.batchNumber}</h2>
            <StatusPill status={batchHeaderState(batch)} domain="lote" size="lg" />
            <span className="text-[12.5px] tabular-nums text-muted">{headerCaption(batch)}</span>
          </div>
          <div className="flex items-center gap-2">
            {primaryAction()}
            <ActionsMenu
              items={[
                { label: "Editar", onClick: () => actions.edit(batch) },
                { label: "Eliminar", onClick: () => actions.remove(batch), danger: true },
              ]}
            />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {openBox ? (
          <ActionBox
            key={`${batch._id}-${openBox}`}
            kind={openBox}
            batch={batch}
            operators={operators}
            lines={lines}
            busy={busy}
            onCancel={() => setOpenBox(null)}
            actions={actions}
          />
        ) : null}

        <section>
          <SectionLabel>Avance del lote</SectionLabel>
          <Progress batch={batch} />
        </section>

        <Tiles batch={batch} previous={previous} average={average} historyCount={history.length} />

        <div className="grid grid-cols-1 gap-[22px] xl:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <SectionLabel aside={batch.targetQuantity != null ? `Meta ${fmtNumber(batch.targetQuantity)} u. por lote` : null}>
              {batch.productionLine ? `Últimos lotes de ${batch.productionLine}` : "Últimos lotes de la línea"}
            </SectionLabel>
            {batch.productionLine ? <LineChart batch={batch} history={history} /> : <EmptyState title="Este lote no tiene línea asignada." />}
          </section>
          <section>
            <SectionLabel>Ficha del lote</SectionLabel>
            <Sheet batch={batch} />
          </section>
        </div>
      </div>
    </DetailPanel>
  );
}

export default BatchDetail;
