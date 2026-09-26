const routesController = {};

import routeModel from "../models/Route.js";
import { sendError, withTransaction } from "../lib/stock.js";
import {
  parseDay,
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
  query.populate("driver", "name lastName phone").populate("orders").populate("deliveries.order", "orderNumber customer.name");

async function sendRoute(res, id) {
  res.json(await populateRoute(routeModel.findById(id)));
}

// Ejecuta una acción de lib/routes.js en una transacción y responde la ruta
// actualizada (poblada).
function routeAction(fn) {
  return async (req, res) => {
    try {
      const route = await withTransaction((session) => fn(req, session));
      await sendRoute(res, route._id);
    } catch (error) {
      sendError(res, error);
    }
  };
}

// GET /routes?date=YYYY-MM-DD (por defecto, hoy)
routesController.getRoutes = async (req, res) => {
  try {
    const date = parseDay(req.query.date);
    res.json(await populateRoute(routeModel.find({ date }).sort({ number: 1 })));
  } catch (error) {
    sendError(res, error);
  }
};

// GET /routes/availability?date=YYYY-MM-DD
routesController.getAvailability = async (req, res) => {
  try {
    res.json(await availability(req.query.date));
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

// POST /routes { zone, driver?, vehicle? }. El número es correlativo por
// día: si otra ruta toma el mismo número a la vez (índice único), se reintenta.
routesController.createRoute = async (req, res) => {
  try {
    let route;
    for (let attempt = 0; attempt < 3 && !route; attempt += 1) {
      try {
        route = await withTransaction((session) => createRoute(req.body, session));
      } catch (error) {
        if (error?.code !== 11000 || attempt === 2) throw error;
      }
    }
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

routesController.addOrder = routeAction((req, session) => addOrder(req.params.id, req.body?.orderId, session));
routesController.removeOrder = routeAction((req, session) => removeOrder(req.params.id, req.params.orderId, session));
routesController.confirmPickup = routeAction((req, session) => confirmPickup(req.params.id, req.body?.location, session));
routesController.depart = routeAction((req, session) => depart(req.params.id, session));
routesController.deliverOrder = routeAction((req, session) => deliverOrder(req.params.id, req.params.orderId, session));
routesController.undeliverOrder = routeAction((req, session) => undeliverOrder(req.params.id, req.params.orderId, session));

export default routesController;
