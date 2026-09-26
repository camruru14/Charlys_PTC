/*
  Avatar con las iniciales de una persona.
    size: 26 (filas) | 40 (tarjetas)
    tone: "soft" (primary-soft) | "solid" (primary, texto blanco)
*/
function initials(person) {
  if (!person) return "—";
  const parts = [person.name, person.lastName].filter(Boolean).map((s) => s.trim()[0]);
  return parts.length ? parts.join("").toUpperCase() : "—";
}

function Avatar({ person, size = 26, tone = "soft" }) {
  const toneClass = tone === "solid" ? "bg-primary text-white" : "bg-primary-soft text-primary-soft-text";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${toneClass}`}
      style={{ width: size, height: size, fontSize: size >= 40 ? 14 : 10.5 }}
      aria-hidden="true"
    >
      {initials(person)}
    </span>
  );
}

export default Avatar;
