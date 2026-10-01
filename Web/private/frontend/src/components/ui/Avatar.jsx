import { TONE_SOFT } from "../../lib/tones";

/*
  Avatar con las iniciales de una persona.
    size: 26 (filas) | 32 (listas maestro) | 40 (tarjetas) | 48 (fichas)
    tone: "soft" (primary-soft) | "solid" (primary, texto blanco) |
          "color" (fondo suave de un tono fijo por persona)
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
  if (size >= 48) return 16;
  if (size >= 40) return 14;
  if (size >= 32) return 12;
  return 10.5;
}

function Avatar({ person, size = 26, tone = "soft" }) {
  const toneClass =
    tone === "solid" ? "bg-primary text-white" : tone === "color" ? personTone(person) : "bg-primary-soft text-primary-soft-text";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${toneClass}`}
      style={{ width: size, height: size, fontSize: fontSize(size) }}
      aria-hidden="true"
    >
      {initials(person)}
    </span>
  );
}

export default Avatar;
