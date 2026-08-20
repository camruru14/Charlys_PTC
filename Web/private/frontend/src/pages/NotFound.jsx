import { Link } from "react-router-dom";

/*
  404 del panel privado: se renderiza DENTRO de Layout (ver App.jsx), así que
  conserva el Sidebar y el TopBar — el usuario nunca pierde la navegación,
  solo ve que esa ruta puntual no existe.
*/
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-black text-white">
        IC
      </span>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-900">
        Página no encontrada
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        La ruta que buscás no existe o fue movida. Revisá el menú lateral o volvé al Dashboard.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
      >
        Volver al Dashboard
      </Link>
    </div>
  );
}

export default NotFound;
