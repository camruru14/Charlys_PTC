const routesController = {};

import routeModel from "../models/Route.js";
import { sendError, withTransaction } from "../lib/stock.js";
import { recordFor } from "../lib/activity.js";
import {
  routesFilter,
  createRoute,
  updateRoute,
  deleteRoute,
  addOrder,
  removeOrder,
  confirmPickup,
  depart,
  deliverOrder,
  undeliverOrder,
  availability,
} from "../lib/routes.js";

// Pedidos completos (en orden de entrega) y motorista.
const populateRoute = (query) =>
  query.populate("driver", "name lastName phone photo").populate("orders").populate("deliveries.order", "orderNumber customer total items");

async function sendRoute(res, id) {
  res.json(await populateRoute(routeModel.findById(id)));
}

// Registra las novedades de una acción de ruta (burbujas, lib/activity.js):
// `keys` son las pestañas de la ruta; `orderIds`, los pedidos cuyo estado cambió
// (pestaña Pedidos).
async function trackRoute(req, route, action, { keys, orderIds = [] }) {
  await recordFor(req, { keys, entityType: "route", entityId: route._id, action });
  for (const orderId of orderIds) await recordFor(req, { keys: ["pedidos"], entityType: "order", entityId: orderId, action });
}

// Ejecuta una acción de lib/routes.js en una transacción y responde la ruta
// actualizada (poblada). `track(req, route)` (opcional) devuelve { keys, orderIds? }.
function routeAction(fn, action, track) {
  return async (req, res) => {
    try {
      const route = await withTransaction((session) => fn(req, session));
      if (track) await trackRoute(req, route, action, track(req, route));
      await sendRoute(res, route._id);
    } catch (error) {
      sendError(res, error);
    }
  };
}

// GET /routes?from=YYYY-MM-DD&to=YYYY-MM-DD: todas las rutas sin completar más
// las completadas dentro del rango (por defecto, esta semana); ver routesFilter.
// ?date= se conserva por compatibilidad con la app móvil.
routesController.getRoutes = async (req, res) => {
  try {
    res.json(await populateRoute(routeModel.find(routesFilter(req.query)).sort({ createdAt: 1 })));
  } catch (error) {
    sendError(res, error);
  }
};

// GET /routes/availability (no depende del día; ?date= se acepta y se ignora
// por compatibilidad).
routesController.getAvailability = async (req, res) => {
  try {
    res.json(await availability());
  } catch (error) {
    sendError(res, error);
  }
};

// GET /routes/:id
routesController.getRoute = async (req, res) => {
  try {
    const route = await populateRoute(routeModel.findById(req.params.id));
    if (!route) return res.status(404).json({ message: "Ruta no encontrada" });
    res.json(route);
  } catch (error) {
    sendError(res, error);
  }
};

// POST /routes { zone, driver?, vehicle? }. El código R-AAAA-NNNN es el último
// del año + 1: si otra ruta toma el mismo a la vez (índice único), se reintenta.
routesController.createRoute = async (req, res) => {
  try {
    let route;
    for (let attempt = 0; attempt < 5 && !route; attempt += 1) {
      try {
        route = await withTransaction((session) => createRoute(req.body, session));
      } catch (error) {
        if (error?.code !== 11000 || attempt === 4) throw error;
      }
    }
    await trackRoute(req, route, "created", { keys: ["logistica.despacho"] });
    await sendRoute(res.status(201), route._id);
  } catch (error) {
    sendError(res, error);
  }
};

routesController.updateRoute = routeAction((req, session) => updateRoute(req.params.id, req.body, session));

routesController.deleteRoute = async (req, res) => {
  try {
    await withTransaction((session) => deleteRoute(req.params.id, session));
    res.json({ message: "Route deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

const despacho = () => ({ keys: ["logistica.despacho"] });
routesController.addOrder = routeAction((req, session) => addOrder(req.params.id, req.body?.orderId, session), "order-added", despacho);
routesController.removeOrder = routeAction((req, session) => removeOrder(req.params.id, req.params.orderId, session), "order-removed", despacho);
routesController.confirmPickup = routeAction((req, session) => confirmPickup(req.params.id, req.body?.location, session), "pickup", despacho);
// Al salir, todos los pedidos de la ruta pasan a «En Tránsito».
routesController.depart = routeAction((req, session) => depart(req.params.id, session), "departed", (_req, route) => ({
  keys: ["logistica.transito"],
  orderIds: route.orders,
}));
const delivery = (req) => ({ keys: ["logistica.transito"], orderIds: [req.params.orderId] });
routesController.deliverOrder = routeAction((req, session) => deliverOrder(req.params.id, req.params.orderId, session), "delivered", delivery);
routesController.undeliverOrder = routeAction((req, session) => undeliverOrder(req.params.id, req.params.orderId, session), "undelivered", delivery);

export default routesController;
