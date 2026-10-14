/*
  Generador pseudoaleatorio con semilla fija (mulberry32). Misma semilla = mismos datos, así la
  simulación (--dry-run) y la ejecución real (--apply) generan exactamente lo mismo.
  Las contraseñas NO salen de aquí: usan crypto.randomInt (ver generate.js), para que no se puedan
  deducir de la semilla.
*/
export function createRng(seed = 2026) {
  let a = (Number(seed) >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    float: next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), // ambos incluidos
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    // weights: números (mismo largo que list) o función item => peso.
    weighted(list, weights) {
      const w = typeof weights === "function" ? list.map(weights) : weights;
      const total = w.reduce((s, x) => s + x, 0);
      let r = next() * total;
      for (let i = 0; i < list.length; i += 1) {
        r -= w[i];
        if (r < 0) return list[i];
      }
      return list[list.length - 1];
    },
    shuffle(list) {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    normal(mean = 0, sd = 1) {
      const u = Math.max(next(), 1e-12);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    // Poisson (Knuth; para lambdas grandes, aproximación normal).
    poisson(lambda) {
      if (lambda > 30) return Math.max(0, Math.round(rng.normal(lambda, Math.sqrt(lambda))));
      const limit = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k += 1;
        p *= next();
      } while (p > limit);
      return k - 1;
    },
  };
  return rng;
}
