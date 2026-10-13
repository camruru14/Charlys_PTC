/*
  Utilidades de las gráficas SVG (sin React): escala «bonita» del eje, formato compacto de números
  y posición de los casilleros. Las usan LineChart, ColumnChart, Sparkline y Donut.
*/

// Escala del eje vertical: de 0 a un máximo redondo, con ~`target` marcas (0, 5k, 10k…).
export function niceScale(maxValue, target = 4) {
  const max = Number(maxValue) > 0 ? Number(maxValue) : 0;
  if (max === 0) return { max: 1, ticks: [0, 1] };
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max: top, ticks };
}

// 1234 -> "1.2k", 21000 -> "21k", 1500000 -> "1.5M" (ejes y metas de unidades).
export function compactNumber(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const short = (v, unit) => `${n < 0 ? "-" : ""}${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`;
  if (abs >= 1e6) return short(Math.round((abs / 1e6) * 10) / 10, "M");
  if (abs >= 1e3) return short(Math.round((abs / 1e3) * 10) / 10, "k");
  return String(Math.round(n));
}

// Cada cuántos casilleros se rotula el eje x para que los textos no se encimen.
export function labelStep(count, plotWidth, minLabelWidth = 40) {
  if (!count || !plotWidth) return 1;
  return Math.max(1, Math.ceil(minLabelWidth / (plotWidth / count)));
}

// Casillero (0..count-1) bajo una posición x dentro del área de dibujo.
export function bandIndexAt(x, left, plotWidth, count) {
  if (!count || plotWidth <= 0) return -1;
  const index = Math.floor(((x - left) / plotWidth) * count);
  return index < 0 || index >= count ? -1 : index;
}
