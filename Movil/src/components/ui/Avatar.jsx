import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { getTone } from "../../lib/theme";
import { fonts } from "../../lib/typography";

// "Ana María López" -> "AL"; "ana" -> "A".
export function initials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const PERSON_TONES = ["blue", "green", "amber", "purple", "teal", "rose"];

// Mismo tono para la misma persona en cualquier pantalla (personTone del
// Avatar de la web: hash del _id, o del nombre si no hay).
export function personTone(person) {
  const key = String(person?._id || `${person?.name || ""}${person?.lastName || ""}`);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PERSON_TONES[hash % PERSON_TONES.length];
}

// Foto de perfil de una persona: person.photo.url (lo que devuelve /employees y
// las rutas) o person.photoUrl (la sesión y /auth/me); null si no tiene.
export function photoOf(person) {
  return person?.photo?.url || person?.photoUrl || null;
}

// Círculo con la foto de perfil si hay (`photoUrl`) y, si no, o si la imagen no
// carga, con las iniciales sobre el fondo y el texto del tono.
export default function Avatar({ name, photoUrl, tone = "blue", size = 36, style }) {
  const palette = getTone(tone);
  // Una foto que no carga se recuerda por su URL: al cambiarla se vuelve a intentar.
  const [failed, setFailed] = useState(null);

  if (photoUrl && failed !== photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        onError={() => setFailed(photoUrl)}
        accessibilityLabel={name}
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.bg }, style]}
      />
    );
  }

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.bg },
        style,
      ]}
      accessibilityLabel={name}
    >
      <Text style={[styles.text, { color: palette.text, fontSize: Math.round(size * 0.38) }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fonts.bold,
  },
});
