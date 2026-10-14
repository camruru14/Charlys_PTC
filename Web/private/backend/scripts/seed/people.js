import crypto from "node:crypto";
import * as D from "./data.js";
import * as T from "./time.js";

/*
  Empleados y clientes ficticios (nombres, DUI, teléfonos, correos, direcciones).
  Las contraseñas se generan con crypto.randomInt (NO con la semilla) y viajan en `_s.plain`:
  el generador las usa para los CSV y para encriptar/hashear; nunca se imprimen.
*/

const slug = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";

// Contraseña de 12 caracteres con mayúscula, minúscula y número (cumple checkPassword).
export function randomPassword(length = 12) {
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(ALPHABET));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// DUI de 9 dígitos con su dígito verificador (8 dígitos × 9..2, módulo 10).
function makeDui(rng) {
  const digits = Array.from({ length: 8 }, () => rng.int(0, 9));
  digits[0] = rng.int(0, 5);
  const sum = digits.reduce((s, d, i) => s + d * (9 - i), 0);
  const check = (10 - (sum % 10)) % 10;
  return digits.join("") + check;
}

const makePhone = (rng) => `${rng.pick([6, 7, 7, 7])}${rng.int(100, 999)}-${rng.int(1000, 9999)}`;

function makePerson(rng, female) {
  const name = rng.pick(female ? D.FIRST_NAMES_F : D.FIRST_NAMES_M);
  const lastName = `${rng.pick(D.LAST_NAMES)} ${rng.pick(D.LAST_NAMES)}`;
  return { name, lastName };
}

function makeAddress(rng, zone, tag) {
  const town = rng.pick(D.ZONES[zone].towns);
  const place = `${rng.pick(D.NEIGHBORHOODS)}, ${rng.pick(D.STREETS)} #${rng.int(1, 240)}`;
  return { text: `${tag ? `${tag}, ` : ""}${place}, ${town[0]}, ${town[1]}`, city: town[0] };
}

// Plantilla del personal (además de los administradores, que no se tocan).
const STAFF = [
  { department: "Fabricación", position: ["Jefe de producción", "Jefa de producción"], n: 1, rate: [4.4, 4.8] },
  { department: "Fabricación", position: ["Operario", "Operaria"], n: 10, rate: [2.2, 2.9] },
  { department: "Almacén", position: ["Encargado de bodega", "Encargada de bodega"], n: 1, rate: [3.3, 3.6] },
  { department: "Almacén", position: ["Auxiliar de bodega", "Auxiliar de bodega"], n: 4, rate: [2.3, 2.6] },
  { department: "Logística", position: ["Coordinador de logística", "Coordinadora de logística"], n: 1, rate: [3.9, 4.2] },
  { department: "Logística", position: ["Motorista", "Motorista"], n: 4, rate: [2.8, 3.3] },
  { department: "Finanzas", position: ["Contador", "Contadora"], n: 1, rate: [4.2, 4.5] },
  { department: "Administración", position: ["Vendedor", "Vendedora"], n: 1, rate: [3.0, 3.3] },
  { department: "Administración", position: ["Asistente administrativo", "Asistente administrativa"], n: 1, rate: [2.6, 2.9] },
];

export function makeEmployees({ rng, newId, startKey, todayKey, reservedEmails }) {
  const emails = new Set(reservedEmails);
  const out = [];
  for (const spec of STAFF) {
    for (let i = 0; i < spec.n; i += 1) {
      const female = rng.chance(0.5);
      const person = makePerson(rng, female);
      let email = `${slug(person.name)}.${slug(person.lastName.split(" ")[0])}@industriascharly.test`;
      for (let k = 2; emails.has(email); k += 1) email = `${slug(person.name)}.${slug(person.lastName.split(" ")[0])}${k}@industriascharly.test`;
      emails.add(email);
      out.push({
        _s: { plain: randomPassword(), hired2026: false, left: null },
        name: person.name,
        lastName: person.lastName,
        dui: makeDui(rng),
        phone: makePhone(rng),
        email,
        position: spec.position[female ? 1 : 0],
        department: spec.department,
        hourlyRate: Math.round(rng.range(spec.rate[0], spec.rate[1]) * 20) / 20,
        isActive: true,
        tokenVersion: 0,
        hireDate: null,
        attendance: [],
      });
    }
  }

  // Quiénes se contrataron durante el año y quiénes se dieron de baja a mitad de año.
  const byPos = (pos) => out.filter((e) => e.position === pos || e.position.startsWith(pos));
  const operarios = rng.shuffle(byPos("Operari"));
  const auxiliares = rng.shuffle(byPos("Auxiliar"));
  const motoristas = rng.shuffle(byPos("Motorista"));
  const hired = [operarios[0], operarios[1], operarios[2], auxiliares[0], motoristas[0]];
  const hiredDates = ["2026-02-16", "2026-03-09", "2026-05-18", "2026-04-13", "2026-03-23"].filter((d) => d <= todayKey);
  hired.forEach((e, i) => {
    if (!hiredDates[i]) return;
    e._s.hired2026 = true;
    e.hireDate = T.svTime(hiredDates[i], 7, 30);
  });
  if (operarios[3] && "2026-06-26" <= todayKey) {
    operarios[3]._s.left = "2026-06-26";
    operarios[3].isActive = false;
    operarios[3].tokenVersion = 1;
  }
  if (auxiliares[1] && "2026-07-31" <= todayKey) {
    auxiliares[1]._s.left = "2026-07-31";
    auxiliares[1].isActive = false;
    auxiliares[1].tokenVersion = 1;
  }
  for (const e of out) {
    if (!e.hireDate) {
      // Plantilla anterior al año: contratada entre 2021 y fines de 2025.
      const year = rng.int(2021, 2025);
      const key = `${year}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;
      e.hireDate = T.svTime(key, 7, 30);
    }
    e.createdAt = e.hireDate;
    e.updatedAt = e._s.left ? T.svTime(e._s.left, 16, 30) : e.hireDate;
    e._id = newId(e.hireDate);
  }
  out.sort((a, b) => a.hireDate - b.hireDate);
  return out;
}

// ¿Trabaja el empleado ese día? (contratado y sin baja)
export function employedOn(emp, key) {
  if (T.dayKeyOf(emp.hireDate) > key) return false;
  if (emp._s.left && emp._s.left < key) return false;
  return true;
}

// ---- Clientes de la tienda ------------------------------------------------------------------

export function makeCustomers({ rng, newId, count = 120, products }) {
  const pelotas = products.filter((p) => p.category === "Pelotas");
  const pajillas = products.filter((p) => p.category !== "Pelotas");
  const popularity = (p) => {
    const n = p.name;
    if (/recta/i.test(n)) return 1.5;
    if (/flexible/i.test(n)) return 1.1;
    if (/ancha/i.test(n)) return 0.8;
    if (/mezclad/i.test(n)) return 0.7;
    if (/inflable/i.test(n)) return 0.9;
    if (/celuloide/i.test(n)) return 0.8;
    return 1;
  };
  const emails = new Set();
  const zones = Object.keys(D.ZONES);
  const persons = Math.round(count * 0.1);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const isPerson = i >= count - persons;
    const female = rng.chance(0.5);
    const person = makePerson(rng, female);
    let kind;
    let tag;
    if (isPerson) {
      kind = { kind: "Persona", pelotas: 0.4, scales: ["small"] };
    } else {
      kind = rng.weighted(D.BUSINESS_KINDS, (k) => k.weight);
      tag = `${kind.kind} ${rng.pick(D.BUSINESS_TAGS)}`;
    }
    const zone = rng.weighted(zones, (z) => D.ZONES[z].weight);
    const address = makeAddress(rng, zone, tag);
    let email = `${slug(person.name)}.${slug(person.lastName.split(" ")[0])}@cliente.test`;
    for (let k = 2; emails.has(email); k += 1) email = `${slug(person.name)}.${slug(person.lastName.split(" ")[0])}${k}@cliente.test`;
    emails.add(email);
    const phone = makePhone(rng);

    // Productos de siempre del cliente (2 a 4), según lo que vende.
    const prefs = [];
    const wanted = rng.int(2, 4);
    for (let k = 0; k < 12 && prefs.length < wanted; k += 1) {
      const pool = rng.chance(kind.pelotas) && pelotas.length ? pelotas : pajillas.length ? pajillas : pelotas;
      const p = rng.weighted(pool, popularity);
      if (!prefs.includes(p.name)) prefs.push(p.name);
    }
    const scale = rng.pick(kind.scales);
    out.push({
      _s: { plain: randomPassword(), zone, scale, prefs, kind: kind.kind, weight: 1, regDay: null },
      _id: null,
      name: person.name,
      lastName: person.lastName,
      email,
      phone,
      addresses: [{ _id: null, label: tag || "Casa", address: address.text, city: address.city, phone, isDefault: true }],
      isActive: true,
      tokenVersion: 0,
    });
  }
  // Frecuencia de compra: pocos clientes frecuentes y muchos ocasionales.
  const order = rng.shuffle(out.map((_, i) => i));
  order.forEach((idx, rank) => {
    const c = out[idx];
    c._s.weight = rank < 10 ? rng.range(8, 12) : rank < 40 ? rng.range(2, 4) : rng.range(0.25, 1);
    c._s.rank = rank;
  });
  return out;
}
