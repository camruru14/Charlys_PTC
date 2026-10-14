import { useState } from "react";
import { TONE_SOFT } from "../../lib/tones";

/*
  Avatar de una persona: su foto de perfil si tiene (person.photo.url del backend o
  person.photoUrl de la sesión) y, si no, o si la imagen no carga, sus iniciales.
    size: 26 (filas) | 32 (listas maestro) | 40 (tarjetas) | 48 (fichas)
    tone: "soft" (primary-soft) | "solid" (primary, texto blanco) |
          "color" (fondo suave de un tono fijo por persona) |
          "rail" (sobre el menú lateral oscuro)
*/
function initials(person) {
  if (!person) return "—";
  const parts = [person.name, person.lastName].filter(Boolean).map((s) => s.trim()[0]);
  return parts.length ? parts.join("").toUpperCase() : "—";
}

const PERSON_TONES = ["blue", "green", "amber", "purple", "teal", "rose"];

// Mismo tono para la misma persona en cualquier pantalla.
function personTone(person) {
  const key = String(person?._id || `${person?.name || ""}${person?.lastName || ""}`);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return TONE_SOFT[PERSON_TONES[hash % PERSON_TONES.length]];
}

function fontSize(size) {
  if (size >= 64) return 22;
  if (size >= 48) return 16;
  if (size >= 40) return 14;
  if (size >= 32) return 12;
  return 10.5;
}

const TONES = { solid: "bg-primary text-white", rail: "bg-rail-active text-white" };

function Avatar({ person, size = 26, tone = "soft" }) {
  const toneClass = TONES[tone] || (tone === "color" ? personTone(person) : "bg-primary-soft text-primary-soft-text");
  const photo = person?.photo?.url || person?.photoUrl || null;
  // Una foto que no carga se recuerda por su URL: al cambiarla se vuelve a intentar.
  const [failed, setFailed] = useState(null);
  const showPhoto = Boolean(photo) && failed !== photo;
  const fullName = [person?.name, person?.lastName].filter(Boolean).join(" ");
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${showPhoto ? "bg-surface-2" : toneClass}`}
      style={{ width: size, height: size, fontSize: fontSize(size) }}
      aria-hidden={showPhoto ? undefined : "true"}
    >
      {showPhoto ? (
        <img src={photo} alt={fullName} className="h-full w-full rounded-full object-cover" onError={() => setFailed(photo)} />
      ) : (
        initials(person)
      )}
    </span>
  );
}

export default Avatar;
