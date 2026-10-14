import { computeOrderStatus } from "../../src/lib/orderStatus.js";
import { isOrderDelivered } from "../../src/lib/routes.js";
import * as T from "./time.js";

/*
  Chequeos de coherencia. Funcionan igual sobre los datos en memoria (--dry-run) y sobre lo que se
  lee de la base después de --apply: reciben las colecciones como arreglos de documentos planos.
*/

const cents = (n) => Math.round((Number(n) || 0) * 100);
const MAX_EXAMPLES = 5;
const ORDER_STATUSES = ["Pendiente", "Procesando", "En Fabricación", "Empacado", "En Tránsito", "Entregado"];

function numberOf(code, prefix) {
  const m = new RegExp(`^${prefix}(\\d+)$`).exec(String(code || ""));
  return m ? Number(m[1]) : null;
}

export function runChecks({ docs, ctx, now, startKey, meta = {}, mode = "memoria" }) {
  const results = [];
  const check = (name, fn) => {
    const errors = [];
    const fail = (msg) => errors.push(msg);
    try {
      fn(fail);
    } catch (error) {
      errors.push(`el chequeo falló: ${error.message}`);
    }
    results.push({ name, errors });
  };

  const orders = docs.orders;
  const orderById = new Map(orders.map((o) => [String(o._id), o]));
  const startTs = T.svTime(startKey, 0).getTime();
  const nowTs = now.getTime();
  const todayKey = T.dayKeyOf(now);
  const productByName = new Map(ctx.products.map((p) => [p.name, p]));
  const warehouseNames = new Set(ctx.warehouses.map((w) => w.name));
  const lineNames = new Set(ctx.productionLines.map((l) => l.name));
  const plates = new Set(ctx.vehicles.map((v) => v.plate));
  const categoryNames = new Set(ctx.categories.map((c) => c.name));
  const employeeById = new Map(docs.employees.map((e) => [String(e._id), e]));
  const batchById = new Map(docs.productionbatches.map((b) => [String(b._id), b]));
  const sales = docs.transactions.filter((t) => t.category === "Ventas" && t.type === "Ingreso" && t.relatedOrder);

  check("Todo pedido tiene su venta, su CustomerOrder y su pago aprobado", (fail) => {
    const saleBy = new Map();
    for (const s of sales) saleBy.set(String(s.relatedOrder), (saleBy.get(String(s.relatedOrder)) || 0) + 1);
    const linkBy = new Map();
    for (const c of docs.customerorders) linkBy.set(String(c.order), (linkBy.get(String(c.order)) || 0) + 1);
    const payBy = new Map();
    for (const p of docs.paymenttransactions) if (p.esAprobada && p.status === "aprobado") payBy.set(String(p.order), (payBy.get(String(p.order)) || 0) + 1);
    const customers = new Set(docs.customers.map((c) => String(c._id)));
    for (const o of orders) {
      const id = String(o._id);
      if (saleBy.get(id) !== 1) fail(`${o.orderNumber}: ventas=${saleBy.get(id) || 0}`);
      if (linkBy.get(id) !== 1) fail(`${o.orderNumber}: CustomerOrder=${linkBy.get(id) || 0}`);
      if (payBy.get(id) !== 1) fail(`${o.orderNumber}: pagos aprobados=${payBy.get(id) || 0}`);
    }
    for (const c of docs.customerorders) {
      if (!orderById.has(String(c.order))) fail(`CustomerOrder huérfano ${c._id}`);
      if (!customers.has(String(c.customer))) fail(`CustomerOrder con cliente inexistente ${c._id}`);
    }
    for (const s of sales) if (!orderById.has(String(s.relatedOrder))) fail(`venta ${s.reference} sin pedido`);
  });

  check("La suma de las ventas = la suma de los totales de los pedidos", (fail) => {
    const a = orders.reduce((s, o) => s + cents(o.total), 0);
    const b = sales.reduce((s, t) => s + cents(t.amount), 0);
    if (a !== b) fail(`pedidos=${a / 100} ventas=${b / 100}`);
    for (const o of orders) {
      const sum = o.items.reduce((s, i) => s + cents(i.subtotal), 0);
      if (sum !== cents(o.total)) fail(`${o.orderNumber}: líneas=${sum / 100} total=${o.total}`);
      for (const i of o.items) if (cents(i.unitPrice * i.quantity) !== cents(i.subtotal)) fail(`${o.orderNumber}: subtotal de ${i.product}`);
    }
    for (const s of sales) {
      const o = orderById.get(String(s.relatedOrder));
      if (o && (cents(o.total) !== cents(s.amount) || s.orderNumber !== o.orderNumber)) fail(`${s.reference}: no coincide con ${o.orderNumber}`);
      if (s.paymentMethod !== "Wompi" || s.status !== "Completado" || s.concept !== `Venta pedido ${s.orderNumber}`) fail(`${s.reference}: forma distinta a la de salesTransaction.js`);
    }
  });

  check("Ningún stock negativo y el stock = inicial + enviado desde lotes − verificado", (fail) => {
    const finished = docs.inventoryitems.filter((i) => i.category === "Producto Terminado");
    const key = (n, c, w) => `${n}|${c || ""}|${w}`;
    const inbound = new Map();
    for (const b of docs.productionbatches) {
      if (b.sentToWarehouseAt) inbound.set(key(b.product, b.color, b.destinationWarehouse), (inbound.get(key(b.product, b.color, b.destinationWarehouse)) || 0) + (b.sentQuantity || 0));
    }
    const taken = new Map();
    for (const o of orders) {
      for (const i of o.items) {
        if (!i.verified || !i.verifiedWarehouse) continue;
        const k = key(i.product, i.color, i.verifiedWarehouse);
        taken.set(k, (taken.get(k) || 0) + (i.fromStockQty != null ? i.fromStockQty : i.quantity));
      }
    }
    const seen = new Set();
    for (const it of docs.inventoryitems) {
      if (!(it.stock >= 0)) fail(`${it.name} ${it.color || ""} ${it.location}: stock ${it.stock}`);
      if (!(it.minStock >= 0) || !(it.unitCost >= 0)) fail(`${it.name}: mínimo o costo negativo`);
    }
    for (const it of finished) {
      const k = key(it.name, it.color, it.location);
      if (seen.has(k)) fail(`artículo duplicado ${k}`);
      seen.add(k);
      const implied = it.stock - (inbound.get(k) || 0) + (taken.get(k) || 0);
      if (implied < 0) fail(`${k}: el stock implica un inicial negativo (${implied})`);
      if (meta.initialStock) {
        const initial = meta.initialStock.get(String(it._id)) || 0;
        if (implied !== initial) fail(`${k}: stock ${it.stock} ≠ inicial ${initial} + enviado ${inbound.get(k) || 0} − verificado ${taken.get(k) || 0}`);
      }
    }
    for (const k of [...inbound.keys(), ...taken.keys()]) if (!seen.has(k)) fail(`movimiento sin artículo de inventario: ${k}`);
  });

  check("El status de cada pedido = computeOrderStatus, y su historial es coherente", (fail) => {
    for (const o of orders) {
      if (!ORDER_STATUSES.includes(o.status)) fail(`${o.orderNumber}: status inválido ${o.status}`);
      const computed = computeOrderStatus(o);
      if (computed !== o.status) fail(`${o.orderNumber}: status=${o.status} computeOrderStatus=${computed}`);
      const h = o.statusHistory;
      if (!h.length || h[h.length - 1].status !== o.status) fail(`${o.orderNumber}: el historial no termina en ${o.status}`);
      if (h[0].status !== "Procesando" || h[0].at.getTime() !== o.createdAt.getTime() || o.sentToInventoryAt?.getTime() !== o.createdAt.getTime()) fail(`${o.orderNumber}: el primer registro no es la creación`);
      for (let i = 1; i < h.length; i += 1) if (h[i].at < h[i - 1].at) fail(`${o.orderNumber}: historial desordenado`);
      if (o.status === "Entregado" && !(o.delivery?.deliveredAt && o.items.every((i) => i.deliveredAt))) fail(`${o.orderNumber}: Entregado sin entrega completa`);
      if (o.status === "En Tránsito" && !(o.delivery?.route && o.delivery?.dispatchedAt)) fail(`${o.orderNumber}: En Tránsito sin ruta`);
    }
  });

  check("Líneas de pedido coherentes (verificación, empaque, división, lotes)", (fail) => {
    for (const o of orders) {
      for (const i of o.items) {
        const tag = `${o.orderNumber} ${i.product}`;
        // Una línea empacada en Fabricación queda verified sin bodega (packManufacturedLine no la fija).
        const fromFactory = i.packedLocation === "Fabricación" && !i.verifiedWarehouse;
        if (i.verified && !fromFactory && (!i.verifiedWarehouse || !i.verifiedAt)) fail(`${tag}: verificada sin bodega`);
        if (i.verifiedWarehouse && !warehouseNames.has(i.verifiedWarehouse)) fail(`${tag}: bodega inexistente ${i.verifiedWarehouse}`);
        const split = i.fromStockQty != null && i.toManufactureQty != null;
        if (split && i.fromStockQty + i.toManufactureQty !== i.quantity) fail(`${tag}: la división no suma la cantidad`);
        if (i.packed && !i.packedAt) fail(`${tag}: empacada sin fecha`);
        if (i.packed && !split && !["Almacén", "Fabricación"].includes(i.packedLocation)) fail(`${tag}: empacada sin ubicación`);
        if (split && i.packed && !(i.stockPackedAt && i.manufacturePackedAt)) fail(`${tag}: dividida empacada sin las dos partes`);
        if (i.deliveredAt && !i.pickedUpAt) fail(`${tag}: entregada sin recoger`);
        if (i.deliveredAt && !i.packed) fail(`${tag}: entregada sin empacar`);
        if (i.sentToManufacturing) {
          const b = batchById.get(String(i.manufacturingBatch));
          if (!b) fail(`${tag}: lote de fabricación inexistente`);
          else {
            if (b.category !== "Pedido" || b.product !== i.product || (b.color || "") !== (i.color || "")) fail(`${tag}: el lote ${b.batchNumber} no corresponde`);
            if (b.targetQuantity !== (split ? i.toManufactureQty : i.quantity)) fail(`${tag}: meta del lote ${b.batchNumber} ≠ lo pedido`);
            if ((i.packedLocation === "Fabricación" || i.manufacturePackedAt) && !(b.status === "Completado" && b.packedAt && b.producedQuantity >= b.targetQuantity)) fail(`${tag}: empacada en Fabricación con el lote ${b.batchNumber} sin completar`);
          }
        } else if (i.manufacturingBatch) fail(`${tag}: lote sin sentToManufacturing`);
        if (i.packed && !i.verified && i.packedLocation !== "Fabricación") fail(`${tag}: empacada sin verificar`);
      }
    }
  });

  check("Toda ruta completada tiene sus pedidos entregados; estados de ruta coherentes", (fail) => {
    for (const r of docs.routes) {
      const tag = r.code;
      if (r.status === "Completada") {
        if (!r.departedAt || !r.completedAt) fail(`${tag}: Completada sin salida o cierre`);
        for (const id of r.orders) {
          const o = orderById.get(String(id));
          if (!o || !isOrderDelivered(o)) fail(`${tag}: pedido ${o?.orderNumber || id} no entregado`);
        }
        if (!r.deliveries.length) fail(`${tag}: Completada sin entregas`);
      }
      if ((r.status === "En tránsito" || r.status === "Completada") && !r.departedAt) fail(`${tag}: ${r.status} sin salida`);
      if (r.status === "Recolectando" && !(r.driver && r.vehicle && r.orders.length)) fail(`${tag}: Recolectando sin motorista, vehículo o pedidos`);
      if (r.status === "En tránsito") for (const id of r.orders) {
        const o = orderById.get(String(id));
        if (!o || String(o.delivery?.route) !== String(r._id)) fail(`${tag}: el pedido ${o?.orderNumber || id} no apunta a la ruta`);
      }
      for (const d of r.deliveries) {
        const o = orderById.get(String(d.order));
        if (!o) fail(`${tag}: entrega de un pedido inexistente`);
        else if (!d.partial && o.status !== "Entregado") fail(`${tag}: entrega completa de ${o.orderNumber} que no está Entregado`);
        if (r.departedAt && d.at < r.departedAt) fail(`${tag}: entrega antes de la salida`);
      }
      if (!plates.has(r.vehicle)) fail(`${tag}: vehículo inexistente ${r.vehicle}`);
      const driver = employeeById.get(String(r.driver));
      if (!driver || driver.department !== "Logística") fail(`${tag}: motorista inválido`);
      if (r.driver && driver && !driver.isActive && r.status !== "Completada") fail(`${tag}: motorista inactivo en ruta activa`);
    }
    for (const o of orders) {
      if (o.delivery?.route && !docs.routes.some((r) => String(r._id) === String(o.delivery.route))) fail(`${o.orderNumber}: ruta inexistente`);
    }
  });

  check("Ningún motorista ni vehículo en dos rutas activas a la vez", (fail) => {
    const active = docs.routes.filter((r) => r.status !== "Completada");
    for (const field of ["driver", "vehicle"]) {
      const seen = new Map();
      for (const r of active) {
        const k = String(r[field]);
        if (seen.has(k)) fail(`${field} ${k} en ${seen.get(k)} y ${r.code}`);
        seen.set(k, r.code);
      }
      // Historial: ningún intervalo [creación, cierre] se solapa para el mismo motorista/vehículo.
      const byKey = new Map();
      for (const r of docs.routes) {
        const k = String(r[field]);
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push([r.createdAt.getTime(), (r.completedAt || now).getTime(), r.code]);
      }
      for (const list of byKey.values()) {
        list.sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < list.length; i += 1) if (list[i][0] < list[i - 1][1]) fail(`${field}: ${list[i - 1][2]} y ${list[i][2]} se solapan`);
      }
    }
  });

  check("Números ORD / TRAN / LOTE / R / LTE-DIARIO únicos y correlativos", (fail) => {
    const seq = (label, list, prefix, field = "createdAt") => {
      const nums = list.map(([code, at]) => [numberOf(code, prefix), at]);
      if (nums.some(([n]) => n == null)) return fail(`${label}: hay números con formato inválido`);
      const sorted = [...nums].sort((a, b) => a[0] - b[0]);
      sorted.forEach(([n], i) => {
        if (n !== i + 1) fail(`${label}: se esperaba ${i + 1} y hay ${n}`);
      });
      for (let i = 1; i < sorted.length; i += 1) if (sorted[i][1] < sorted[i - 1][1]) return fail(`${label}: los números no siguen el orden de ${field}`);
      return null;
    };
    seq("ORD", orders.map((o) => [o.orderNumber, o.createdAt]), "ORD-2026-");
    seq("TRAN", docs.transactions.map((t) => [t.reference, t.createdAt]), "TRAN-2026-");
    seq("LOTE", docs.productionbatches.map((b) => [b.batchNumber, b.createdAt]), "LOTE-2026-");
    seq("Ruta", docs.routes.map((r) => [r.code, r.createdAt]), "R-2026-");
    seq("LTE-DIARIO", docs.dailybatches.map((d) => [d.dailyBatchNumber, d.createdAt]), "LTE-DIARIO-");
    const counterOf = (id) => docs.counters.find((c) => c._id === id)?.seq;
    if (counterOf("ORD-2026") !== orders.length) fail(`contador ORD-2026 = ${counterOf("ORD-2026")}, hay ${orders.length}`);
    if (counterOf("TRAN-2026") !== docs.transactions.length) fail(`contador TRAN-2026 = ${counterOf("TRAN-2026")}, hay ${docs.transactions.length}`);
    if (counterOf("LOTE-2026") !== docs.productionbatches.length) fail(`contador LOTE-2026 = ${counterOf("LOTE-2026")}, hay ${docs.productionbatches.length}`);
  });

  check("Fechas dentro del rango (1 ene 2026 → ahora)", (fail) => {
    const inside = (label, date, lo = startTs, hi = nowTs) => {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fail(`${label}: fecha inválida`);
      if (date.getTime() < lo || date.getTime() > hi) fail(`${label}: ${date.toISOString()} fuera de rango`);
      return null;
    };
    for (const o of orders) {
      inside(`${o.orderNumber} createdAt`, o.createdAt);
      inside(`${o.orderNumber} updatedAt`, o.updatedAt);
      if (o.updatedAt < o.createdAt) fail(`${o.orderNumber}: updatedAt < createdAt`);
      for (const h of o.statusHistory) inside(`${o.orderNumber} historial`, h.at);
    }
    for (const t of docs.transactions) {
      inside(`${t.reference} createdAt`, t.createdAt);
      inside(`${t.reference} date`, t.date, startTs - 6 * 3600000, T.midnightUTC(todayKey).getTime() + 24 * 3600000);
      if (t.updatedAt < t.createdAt) fail(`${t.reference}: updatedAt < createdAt`);
      if (t.paidAt) inside(`${t.reference} paidAt`, t.paidAt);
    }
    for (const b of docs.productionbatches) {
      for (const f of ["createdAt", "updatedAt", "startedAt", "completedAt", "stoppedAt", "sentToWarehouseAt", "packedAt"]) if (b[f]) inside(`${b.batchNumber} ${f}`, b[f]);
      if (b.updatedAt < b.createdAt) fail(`${b.batchNumber}: updatedAt < createdAt`);
      if (b.startedAt && b.startedAt < b.createdAt) fail(`${b.batchNumber}: inició antes de crearse`);
      if (b.completedAt && b.startedAt && b.completedAt < b.startedAt) fail(`${b.batchNumber}: completado antes de iniciar`);
    }
    for (const r of docs.routes) {
      inside(`${r.code} createdAt`, r.createdAt);
      inside(`${r.code} date`, r.date, startTs - 6 * 3600000, nowTs);
      for (const f of ["departedAt", "completedAt"]) if (r[f]) inside(`${r.code} ${f}`, r[f]);
    }
    for (const c of docs.customers) inside(`cliente ${c.email}`, c.createdAt);
    for (const i of docs.inventoryitems) inside(`inventario ${i.name}`, i.createdAt);
    for (const e of docs.employees) {
      if (e.isActive === false && !e.updatedAt) fail(`${e.email}: inactivo sin fecha`);
      for (const a of e.attendance || []) {
        inside(`asistencia ${e.email}`, a.checkOut);
        const key = a.date.toISOString().slice(0, 10);
        if (key < startKey || key > todayKey) fail(`asistencia ${e.email}: día ${key} fuera de rango`);
      }
    }
    for (const d of docs.dailybatches) if (d.date.toISOString().slice(0, 10) <= todayKey) fail(`${d.dailyBatchNumber}: el lote diario planificado no es de un día futuro`);
  });

  check("Productos, colores, bodegas, líneas, vehículos y categorías existen", (fail) => {
    for (const o of orders) {
      for (const i of o.items) {
        const p = productByName.get(i.product);
        if (!p) fail(`${o.orderNumber}: producto inexistente ${i.product}`);
        else {
          if (p.colors?.length && !p.colors.includes(i.color)) fail(`${o.orderNumber}: color ${i.color} no existe en ${p.name}`);
          if (cents(p.price) !== cents(i.unitPrice)) fail(`${o.orderNumber}: precio de ${p.name} ≠ catálogo`);
          if (!Number.isInteger(i.quantity) || i.quantity < (p.minOrderQuantity || 1)) fail(`${o.orderNumber}: cantidad ${i.quantity} de ${p.name} bajo el mínimo`);
        }
      }
    }
    for (const b of docs.productionbatches) {
      const p = productByName.get(b.product);
      if (!p || (p.colors?.length && !p.colors.includes(b.color))) fail(`${b.batchNumber}: producto/color inexistente`);
      if (b.productionLine && !lineNames.has(b.productionLine)) fail(`${b.batchNumber}: línea inexistente ${b.productionLine}`);
      if (b.destinationWarehouse && !warehouseNames.has(b.destinationWarehouse)) fail(`${b.batchNumber}: bodega inexistente`);
      if (b.status !== "Programado" && !b.productionLine) fail(`${b.batchNumber}: ${b.status} sin línea`);
      if (b.operator) {
        const e = employeeById.get(String(b.operator));
        if (!e || e.department !== "Fabricación") fail(`${b.batchNumber}: operario inválido`);
      }
      if (b.category === "Pedido" && (b.sentToWarehouseAt || b.sentQuantity)) fail(`${b.batchNumber}: un lote de pedido no se envía a bodega`);
      if (b.status === "Completado" && !(b.producedQuantity > 0)) fail(`${b.batchNumber}: Completado sin producción`);
      if (b.sentToWarehouseAt && (b.status !== "Completado" || b.sentQuantity !== b.producedQuantity)) fail(`${b.batchNumber}: envío incoherente`);
    }
    for (const d of docs.dailybatches) {
      const p = productByName.get(d.product);
      if (!p || (p.colors?.length && !p.colors.includes(d.color))) fail(`${d.dailyBatchNumber}: producto/color inexistente`);
    }
    for (const i of docs.inventoryitems) {
      if (i.category === "Producto Terminado") {
        const p = productByName.get(i.name);
        if (!p || (p.colors?.length && !p.colors.includes(i.color))) fail(`inventario: ${i.name} ${i.color} inexistente en el catálogo`);
      }
      if (i.location && !warehouseNames.has(i.location)) fail(`inventario ${i.name}: bodega inexistente ${i.location}`);
    }
    for (const t of docs.transactions) {
      if (t.type === "Gasto" && !categoryNames.has(t.category)) fail(`${t.reference}: categoría de gasto inexistente ${t.category}`);
      if (t.type === "Ingreso" && !["Ventas", "Otros ingresos"].includes(t.category)) fail(`${t.reference}: categoría de ingreso inválida`);
      if (t.status === "Pendiente" && !t.dueDate) fail(`${t.reference}: pendiente sin vencimiento`);
      if (t.status === "Completado" && t.dueDate) fail(`${t.reference}: completado con vencimiento`);
      if (!(t.amount >= 0)) fail(`${t.reference}: monto negativo`);
    }
  });

  check("Gastos mensuales entre el 65 % y el 80 % de las ventas", (fail) => {
    const byMonth = new Map();
    for (const t of docs.transactions) {
      const m = (t.category === "Ventas" ? T.dayKeyOf(t.date) : t.date.toISOString().slice(0, 10)).slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, { sales: 0, expense: 0 });
      const row = byMonth.get(m);
      if (t.category === "Ventas") row.sales += cents(t.amount);
      else if (t.type === "Gasto") row.expense += cents(t.amount);
    }
    for (const [m, row] of byMonth) {
      const ratio = row.expense / Math.max(row.sales, 1);
      if (ratio < 0.65 || ratio > 0.8) fail(`${m}: gastos/ventas = ${(ratio * 100).toFixed(1)} %`);
    }
  });

  check("Asistencia calculada como el sistema", (fail) => {
    const workday = ctx.workSchedule.workdayHours;
    // Los administradores conservados no se tocan: su asistencia es la que ya tenían.
    const untouched = new Set(ctx.admins.map((a) => String(a._id)));
    for (const e of docs.employees) {
      if (untouched.has(String(e._id))) continue;
      const seen = new Set();
      for (const a of e.attendance || []) {
        const key = a.date.toISOString().slice(0, 10);
        if (seen.has(key)) fail(`${e.email}: dos marcaciones el ${key}`);
        seen.add(key);
        if (T.isHoliday(key) || T.dowOf(key) === 0) fail(`${e.email}: marcación en día cerrado ${key}`);
        if (!(a.checkOut > a.checkIn)) fail(`${e.email} ${key}: salida antes de la entrada`);
        const worked = Number(((a.checkOut - a.checkIn) / 3600000).toFixed(2));
        if (Math.abs(worked - a.workedHours) > 0.0001) fail(`${e.email} ${key}: horas trabajadas`);
        if (Math.abs(Math.max(0, worked - workday) - a.overtimeHours) > 0.0001) fail(`${e.email} ${key}: horas extra`);
        if (T.dayKeyOf(a.checkIn) !== key) fail(`${e.email} ${key}: la entrada no es de ese día`);
        if (T.dayKeyOf(e.hireDate) > key) fail(`${e.email}: marcación antes de contratarse`);
      }
    }
  });

  check("Empleados: correos únicos y administradores presentes", (fail) => {
    const emails = new Set();
    for (const e of docs.employees) {
      if (emails.has(e.email)) fail(`correo repetido ${e.email}`);
      emails.add(e.email);
    }
    const admins = ctx.admins.length;
    const present = ctx.admins.filter((a) => docs.employees.some((e) => String(e._id) === String(a._id)) || mode === "memoria").length;
    if (present !== admins) fail("falta algún administrador");
    if (mode !== "memoria" && admins < 1) fail("no hay administradores");
    for (const c of docs.customers) if (!/^[^\s@]+@cliente\.test$/.test(c.email)) fail(`correo de cliente ${c.email}`);
  });

  return { results, totalErrors: results.reduce((s, r) => s + r.errors.length, 0), examples: MAX_EXAMPLES };
}
