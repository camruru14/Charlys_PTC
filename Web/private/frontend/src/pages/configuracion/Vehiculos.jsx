import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import toast from "react-hot-toast";
import { api } from "../../lib/api";
import { replaceById } from "../../hooks/useFetch";
import { useConfirm } from "../../hooks/useConfirm";
import { useUrlState } from "../../hooks/useUrlState";
import { useRememberedSelection } from "../../hooks/useRememberedSelection";
import { useFitPageSize } from "../../hooks/useFitPageSize";
import Button from "../../components/ui/Button";
import ConfirmModal from "../../components/ui/ConfirmModal";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";
import SearchInput from "../../components/ui/SearchInput";
import StatusPill from "../../components/ui/StatusPill";
import VehiclePhoto from "../../components/ui/VehiclePhoto";
import { Field } from "../../components/ui/Field";
import { MasterDetail, ListPanel, DetailPanel, ListRow } from "../../components/ui/MasterDetail";
import { IconAlert, IconCheck, IconPlus, IconTrash, IconTruck, IconUpload } from "../../lib/icons";
import { fmtRelativeDay, fmtTime } from "../../lib/format";
import { routeLabel } from "../../lib/logistics";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_MODEL_LENGTH = 60;
// Alto de una fila de la lista (44 de contenido + 24 de relleno + 1 de borde):
// con él se calcula cuántas caben antes de paginar.
const ROW_HEIGHT = 69;

// Desde lg la lista y el detalle miden lo mismo (alto fijo) y la lista pagina;
// en pantallas chicas se apilan y la lista solo hace scroll.
const WIDE_QUERY = "(min-width: 1024px)";

function useIsWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
  );
}

const byPlate = (a, b) => a.plate.localeCompare(b.plate, "es", { numeric: true });

function VehicleRow({ vehicle, route, selected, onSelect }) {
  return (
    <ListRow selected={selected} onClick={onSelect}>
      <div className="flex h-11 items-center gap-3">
        <VehiclePhoto url={vehicle.image?.url} alt="" className="h-11 w-[72px] rounded-[8px]" iconSize={20} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13.5px] ${vehicle.model ? "font-bold text-ink" : "font-semibold text-muted"}`}>
            {vehicle.model || "Sin modelo"}
          </span>
          <span className="t-aux block truncate tabular-nums">{vehicle.plate}</span>
        </span>
        {route ? <StatusPill status="En ruta" domain="vehiculo" /> : null}
      </div>
    </ListRow>
  );
}

// Dato de la tarjeta «Uso actual»: etiqueta a la izquierda, valor a la derecha.
function UsageRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="t-aux shrink-0">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] font-semibold text-ink">{children}</dd>
    </div>
  );
}

/*
  Detalle de un vehículo (o, sin `vehicle`, el formulario de uno nuevo). Se
  monta con key = id, así cada vehículo arranca con su propio borrador.
  La foto de un vehículo existente se sube y se quita al momento; la de uno
  nuevo se guarda como vista previa y se sube justo después de crearlo.
*/
function VehicleDetail({ vehicle, route, confirm, onCreated, onUpdated, onDeleted, onDiscard }) {
  const isNew = !vehicle;
  const [model, setModel] = useState(vehicle?.model || "");
  const [plate, setPlate] = useState(vehicle?.plate || "");
  const [pending, setPending] = useState(null); // { file, url }: vista previa de un vehículo nuevo
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);

  const previewUrl = pending?.url;
  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const photoUrl = isNew ? previewUrl : vehicle.image?.url;
  const cleanModel = model.trim();
  const cleanPlate = plate.trim();
  const valid = Boolean(cleanModel) && Boolean(cleanPlate);
  const changed = isNew || cleanModel !== (vehicle.model || "") || cleanPlate !== vehicle.plate;
  const locked = Boolean(route);
  const routeName = route ? routeLabel(route) : "";

  async function uploadPhoto(id, file) {
    const formData = new FormData();
    formData.append("image", file);
    return api.post(`/vehicles/${id}/image`, formData);
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("La foto debe ser una imagen");
    if (file.size > MAX_PHOTO_BYTES) return toast.error("La imagen no puede pesar más de 5 MB");
    if (isNew) {
      setPending({ file, url: URL.createObjectURL(file) });
      return;
    }
    setPhotoBusy(true);
    try {
      onUpdated(await uploadPhoto(vehicle._id, file));
      toast.success("Foto actualizada");
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (isNew) return setPending(null);
    setPhotoBusy(true);
    try {
      onUpdated(await api.del(`/vehicles/${vehicle._id}/image`));
      toast.success("Foto quitada");
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setPhotoBusy(false);
    }
  }

  function handleInput(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    handleFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (!photoBusy) handleFile(e.dataTransfer.files?.[0]);
  }

  async function save(e) {
    e?.preventDefault();
    if (!valid || !changed || saving) return;
    setSaving(true);
    try {
      if (isNew) {
        // La respuesta trae además el message; el resto es el vehículo.
        const { message, ...created } = await api.post("/vehicles", { plate: cleanPlate, model: cleanModel });
        let saved = created;
        if (pending) {
          try {
            saved = await uploadPhoto(created._id, pending.file);
          } catch (err) {
            toast.error(`El vehículo se creó, pero no se pudo subir la foto: ${err.message}`, { duration: 6000 });
          }
        }
        toast.success("Vehículo agregado");
        onCreated(saved);
      } else {
        const body = {};
        if (cleanModel !== (vehicle.model || "")) body.model = cleanModel;
        if (cleanPlate !== vehicle.plate) body.plate = cleanPlate;
        onUpdated(await api.put(`/vehicles/${vehicle._id}`, body));
        toast.success("Vehículo actualizado");
      }
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!(await confirm(`¿Eliminar el vehículo «${vehicle.plate}»? Ya no se podrá elegir al armar rutas.`, { danger: true, title: "Eliminar vehículo" }))) return;
    try {
      await api.del(`/vehicles/${vehicle._id}`);
      toast.success("Vehículo eliminado");
      onDeleted(vehicle);
    } catch (err) {
      toast.error(err.message, { duration: 6000 });
    }
  }

  const title = isNew ? "Nuevo vehículo" : vehicle.model || "Sin modelo";
  const departed = route?.departedAt;

  return (
    <DetailPanel
      header={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <h2 className="t-detail-title truncate">{title}</h2>
            {!isNew ? (
              <StatusPill
                status={route ? "En ruta" : "Disponible"}
                domain="vehiculo"
                size="lg"
                label={route ? `En ruta · ${routeName}` : undefined}
              />
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isNew ? (
              <Button variant="secondary" size="detail" onClick={onDiscard} disabled={saving}>
                Descartar
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="detail"
                icon={IconTrash}
                disabled={locked || saving}
                title={locked ? `No se puede eliminar: el vehículo está en ${routeName}` : undefined}
                className="!text-tone-rose-text enabled:hover:!bg-tone-rose"
                onClick={remove}
              >
                Eliminar
              </Button>
            )}
            <Button size="detail" icon={IconCheck} disabled={!valid || !changed || saving} onClick={save}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={save} className="@container">
        <div className="grid grid-cols-1 gap-6 @lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <p className="t-label mb-2">Foto del vehículo</p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
              }}
              onDrop={handleDrop}
              className={`relative aspect-[16/10] w-full overflow-hidden rounded-[12px] border transition ${
                dragging ? "border-primary bg-primary-soft" : photoUrl ? "border-line-soft" : "border-dashed border-line"
              }`}
            >
              <VehiclePhoto url={photoUrl} className="h-full w-full" iconSize={72} />
              {photoBusy ? (
                <span className="absolute inset-0 flex items-center justify-center bg-surface/70 text-[13px] font-semibold text-ink-2">Subiendo…</span>
              ) : null}
              <div className="absolute bottom-3 right-3 flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleInput} />
                <Button variant="secondary" size="row" icon={IconUpload} disabled={photoBusy} className="shadow-sm" onClick={() => fileRef.current?.click()}>
                  Cambiar foto
                </Button>
                {photoUrl ? (
                  <Button variant="secondary" size="row" disabled={photoBusy} className="shadow-sm" onClick={removePhoto}>
                    Quitar
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="t-aux mt-2">JPG, PNG o WEBP · máximo 5 MB · también puedes arrastrar la imagen aquí</p>
          </div>

          <div className="flex flex-col gap-4">
            <Field
              label="Modelo"
              name="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Ej. Isuzu NPR 2019"
              maxLength={MAX_MODEL_LENGTH}
              autoComplete="off"
              required
            />
            <Field
              label="Placa"
              name="plate"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="Ej. P123-456"
              autoComplete="off"
              disabled={locked}
              {...(locked
                ? {
                    title: `No se puede cambiar la placa mientras esté en ${routeName}`,
                    className: "w-full cursor-not-allowed rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-muted outline-none",
                  }
                : {})}
              required
            />

            {!isNew ? (
              <div className="rounded-[12px] border border-line-soft bg-surface-2 px-3.5 py-3">
                <p className="t-label mb-2">Uso actual</p>
                {route ? (
                  <dl className="flex flex-col gap-1.5">
                    <UsageRow label="Ruta">
                      {routeName}
                      {route.zone ? ` · ${route.zone}` : ""}
                    </UsageRow>
                    <UsageRow label="Motorista">{route.driverName || "Sin motorista"}</UsageRow>
                    <UsageRow label="Salió">{departed ? `${fmtRelativeDay(departed)} · ${fmtTime(departed)}` : "Todavía no sale"}</UsageRow>
                  </dl>
                ) : (
                  <p className="text-[13px] text-ink-2">Disponible · no está en ninguna ruta activa</p>
                )}
              </div>
            ) : null}

            {locked ? (
              <p className="flex items-start gap-2 rounded-[10px] border border-tone-amber-line bg-tone-amber px-3 py-2.5 text-[12.5px] text-tone-amber-strong">
                <IconAlert width={15} height={15} className="mt-px shrink-0" />
                No se puede eliminar ni cambiar la placa mientras esté en una ruta activa. Queda libre al completar la ruta.
              </p>
            ) : null}
          </div>
        </div>
        {/* Enter dentro de un campo guarda, como en los demás formularios. */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </DetailPanel>
  );
}

/*
  Configuración > Vehículos: lista a la izquierda (foto, modelo, placa y si
  va en ruta) y detalle a la derecha, con la foto y los datos del vehículo.
  El vehículo seleccionado vive en la URL (?id=).
    vehicles / loading / error / mutate: de useFetch("/vehicles")
    availability: de /routes/availability (qué vehículo va en qué ruta)
*/
function Vehiculos({ vehicles, loading, error, mutate, availability, refetchAvailability }) {
  const { confirm, confirmProps } = useConfirm();
  const [selectedId, setSelectedId] = useUrlState("id");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [pageState, setPageState] = useState({ key: "", page: 0 });
  const listRef = useRef(null);
  const wide = useIsWide();
  const fitSize = useFitPageSize(listRef, ROW_HEIGHT);
  const size = wide ? fitSize : Infinity;

  const routes = useMemo(
    () => new Map((availability?.vehicles || []).filter((v) => v.busy).map((v) => [String(v._id), v.route])),
    [availability],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => `${v.plate} ${v.model || ""}`.toLowerCase().includes(q));
  }, [vehicles, search]);

  const total = filtered.length;
  const paged = Number.isFinite(size) && total > size;
  const pages = paged ? Math.ceil(total / size) : 1;
  const page = Math.min(pageState.key === search ? pageState.page : 0, pages - 1);
  const visible = paged ? filtered.slice(page * size, page * size + size) : filtered;

  const selected = useMemo(() => vehicles.find((v) => v._id === selectedId) || null, [vehicles, selectedId]);
  useRememberedSelection("configuracion/vehiculos", { selectedId, setSelectedId, ids: filtered.map((v) => v._id), ready: !loading });

  function select(id) {
    setCreating(false);
    setSelectedId(id);
  }

  function startCreating() {
    setSelectedId(null);
    setCreating(true);
  }

  // Pasa la lista a la página donde está el vehículo `id` (sin búsqueda activa).
  function showInList(list, id) {
    const index = list.findIndex((v) => v._id === id);
    if (index >= 0 && Number.isFinite(size)) setPageState({ key: "", page: Math.floor(index / size) });
  }

  function handleCreated(vehicle) {
    const next = [...vehicles, vehicle].sort(byPlate);
    mutate(next);
    refetchAvailability();
    setSearch("");
    showInList(next, vehicle._id);
    select(vehicle._id);
  }

  function handleUpdated(vehicle) {
    mutate((prev) => replaceById(prev, vehicle));
    refetchAvailability();
  }

  // Tras eliminar queda seleccionado el siguiente de la lista (o el anterior);
  // sin más vehículos, el estado vacío.
  function handleDeleted(vehicle) {
    const index = filtered.findIndex((v) => v._id === vehicle._id);
    const next = filtered[index + 1] || filtered[index - 1] || null;
    mutate((prev) => (Array.isArray(prev) ? prev.filter((v) => v._id !== vehicle._id) : prev));
    refetchAvailability();
    setSelectedId(next?._id ?? null);
    if (next && !search.trim()) showInList(vehicles.filter((v) => v._id !== vehicle._id), next._id);
  }

  function discardNew() {
    setCreating(false);
    setSelectedId(vehicles[0]?._id ?? null);
  }

  let body;
  if (loading && !vehicles.length) body = <EmptyState title="Cargando…" />;
  else if (error) body = <EmptyState title="No se pudo cargar la lista" description={error} />;
  else if (!vehicles.length) body = <EmptyState title="No hay vehículos registrados." />;
  else if (!total) body = <EmptyState title="Ningún vehículo coincide con la búsqueda." />;
  else {
    body = visible.map((v) => (
      <VehicleRow key={v._id} vehicle={v} route={routes.get(String(v._id))} selected={!creating && v._id === selectedId} onSelect={() => select(v._id)} />
    ));
  }

  return (
    <>
      <MasterDetail listWidth={340}>
        <ListPanel
          bodyRef={listRef}
          rawFooter
          footer={
            paged ? (
              <Pagination page={page} size={size} total={total} noun="vehículos" onChange={(p) => setPageState({ key: search, page: p })} />
            ) : null
          }
          header={
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold text-ink">Vehículos · {vehicles.length}</h2>
                <button
                  type="button"
                  onClick={startCreating}
                  aria-label="Nuevo vehículo"
                  title="Nuevo vehículo"
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] bg-primary-soft text-primary-soft-text transition hover:bg-select-bg"
                >
                  <IconPlus width={16} height={16} />
                </button>
              </div>
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar por placa o modelo" />
            </>
          }
        >
          {body}
        </ListPanel>

        {creating ? (
          <VehicleDetail key="new" confirm={confirm} onCreated={handleCreated} onDiscard={discardNew} />
        ) : selected ? (
          <VehicleDetail
            key={selected._id}
            vehicle={selected}
            route={routes.get(String(selected._id)) || null}
            confirm={confirm}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ) : (
          <DetailPanel>
            <EmptyState icon={IconTruck} title="Selecciona un vehículo" description="Su foto, su modelo y su uso actual aparecen aquí." />
          </DetailPanel>
        )}
      </MasterDetail>
      <ConfirmModal {...confirmProps} />
    </>
  );
}

export default Vehiculos;
